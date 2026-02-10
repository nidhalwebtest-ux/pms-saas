"use server";

import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

// 1. FETCH OPEN TRANSACTIONS
export async function getTenantFinancials(tenantId: string) {
  // Fetch Unpaid Invoices
  const unpaidInvoices = await prisma.invoice.findMany({
    where: {
      reservation: { tenantId: tenantId },
      status: { in: ["PENDING", "DUE"] as any }, // Cast to match your Enum
    },
    include: { reservation: { select: { unit: { select: { name: true } } } } },
    orderBy: { dueDate: "asc" },
  });

  const serializedInvoices = unpaidInvoices.map((inv) => ({
    ...inv,
    amount: Number(inv.amount), // Convert Decimal -> Number
  }));

  // Calculate Balance
  const totalDue = serializedInvoices.reduce(
    (sum, inv) => sum + Number(inv.amount),
    0,
  );

  return { invoices: serializedInvoices, balance: totalDue };
}

// 2. PROCESS PAYMENT (NetSuite Style)
export async function createCustomerPayment(
  prevState: any,
  formData: FormData,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Extract Form Data
  const tenantId = formData.get("tenantId") as string;
  const totalAmount = parseFloat(formData.get("amount") as string);
  const method = formData.get("method") as any;
  const reference = formData.get("reference") as string;
  const notes = formData.get("notes") as string;
  const date = new Date(formData.get("date") as string);

  // Extract Selected Invoices (We will send these as a comma-separated string or JSON)
  const selectedInvoiceIds = (
    (formData.get("selectedInvoices") as string) || ""
  )
    .split(",")
    .filter(Boolean);

  if (!tenantId) return { error: "Tenant is required" };
  if (totalAmount <= 0) return { error: "Amount must be valid" };

  try {
    await prisma.$transaction(async (tx) => {
      let remainingPayment = totalAmount;

      // 1. Fetch Selected Invoices to check balances
      // We sort by Due Date to apply funds to oldest first (FIFO)
      const invoicesToPay = await tx.invoice.findMany({
        where: { id: { in: selectedInvoiceIds } },
        orderBy: { dueDate: "asc" },
        include: { payments: true }, // Need existing payments to calc balance
      });

      for (const invoice of invoicesToPay) {
        if (remainingPayment <= 0) break;

        // Calculate how much is still owed on this invoice
        const previouslyPaid = invoice.payments.reduce(
          (sum, p) => sum + Number(p.amount),
          0,
        );
        const invoiceTotal = Number(invoice.amount);
        const outstanding = invoiceTotal - previouslyPaid;

        // Determine how much of our current payment goes to THIS invoice
        const amountToApply = Math.min(remainingPayment, outstanding);

        if (amountToApply > 0) {
          // A. Create a Payment Record linked to this Invoice
          // (Splitting the main payment ensures precise accounting per invoice)
          await tx.payment.create({
            data: {
              tenantId,
              amount: amountToApply,
              method: formData.get("method") as any,
              reference: formData.get("reference") as string,
              notes: `Partial allocation. ${formData.get("notes") || ""}`,
              date: new Date(formData.get("date") as string),
              invoiceId: invoice.id,
              reservationId: invoice.reservationId,
            },
          });

          // B. Update Invoice Status
          // If we covered the whole outstanding amount, mark PAID
          // (Using a small epsilon for float comparison safety)
          if (amountToApply >= outstanding - 0.001) {
            await tx.invoice.update({
              where: { id: invoice.id },
              data: { status: "PAID" },
            });
          } else {
            // It remains DUE (or PARTIALLY_PAID if you add that enum later)
            // We don't change status, but the balance will be lower next time.
          }

          remainingPayment -= amountToApply;
        }
      }

      // 2. Handle Unapplied Amount (Overpayment or General Credit)
      if (remainingPayment > 0) {
        await tx.payment.create({
          data: {
            tenantId,
            amount: remainingPayment,
            method: formData.get("method") as any,
            reference: formData.get("reference") as string,
            notes: `Unapplied credit. ${formData.get("notes") || ""}`,
            date: new Date(formData.get("date") as string),
            // No invoiceId, No reservationId (General Credit)
          },
        });
      }
    });
  } catch (error) {
    console.error("Payment Error:", error);
    return { error: "Failed to record payment" };
  }

  revalidatePath("/dashboard/payments");
  return { success: true };
}
