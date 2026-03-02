"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type ActionResponse = {
  error?: string;
  success?: boolean;
  id?: string;
};

// 1. FETCH OPEN TRANSACTIONS (Used by Client Component)
export async function getTenantFinancials(tenantId: string) {
  const unpaidInvoices = await prisma.invoice.findMany({
    where: {
      reservation: { tenantId: tenantId },
      status: { in: ["PENDING", "DUE"] as any },
    },
    include: { reservation: { select: { unit: { select: { name: true } } } } },
    orderBy: { dueDate: "asc" },
  });

  const serializedInvoices = unpaidInvoices.map((inv) => ({
    ...inv,
    amount: Number(inv.amount),
  }));

  const totalDue = serializedInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  return { invoices: serializedInvoices, balance: totalDue };
}

// 2. CREATE PAYMENT
export async function createCustomerPayment(
  formData: FormData,
): Promise<ActionResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const tenantId = formData.get("tenantId") as string;
  const totalAmount = parseFloat(formData.get("amount") as string);
  const method = formData.get("method") as any;
  const reference = formData.get("reference") as string;
  const notes = formData.get("notes") as string;
  const date = new Date(formData.get("date") as string);

  const selectedInvoiceIds = (
    (formData.get("selectedInvoices") as string) || ""
  )
    .split(",")
    .filter(Boolean);

  if (!tenantId) return { error: "Tenant is required" };
  if (isNaN(totalAmount) || totalAmount <= 0)
    return { error: "Amount must be valid" };

  try {
    let firstCreatedPaymentId = ""; // Track the ID to redirect to the receipt

    await prisma.$transaction(async (tx) => {
      let remainingPayment = totalAmount;

      const invoicesToPay = await tx.invoice.findMany({
        where: { id: { in: selectedInvoiceIds } },
        orderBy: { dueDate: "asc" },
        include: { payments: true },
      });

      for (const invoice of invoicesToPay) {
        if (remainingPayment <= 0) break;

        const previouslyPaid = invoice.payments.reduce(
          (sum, p) => sum + Number(p.amount),
          0,
        );
        const outstanding = Number(invoice.amount) - previouslyPaid;
        const amountToApply = Math.min(remainingPayment, outstanding);

        if (amountToApply > 0) {
          const newPayment = await tx.payment.create({
            data: {
              tenantId,
              amount: amountToApply,
              method,
              reference,
              notes: `Partial allocation. ${notes}`,
              date,
              invoiceId: invoice.id,
              reservationId: invoice.reservationId,
            },
          });

          if (!firstCreatedPaymentId) firstCreatedPaymentId = newPayment.id;

          if (amountToApply >= outstanding - 0.001) {
            await tx.invoice.update({
              where: { id: invoice.id },
              data: { status: "PAID" },
            });
          }
          remainingPayment -= amountToApply;
        }
      }

      if (remainingPayment > 0) {
        const unappliedPayment = await tx.payment.create({
          data: {
            tenantId,
            amount: remainingPayment,
            method,
            reference,
            notes: `Unapplied credit. ${notes}`,
            date,
          },
        });
        if (!firstCreatedPaymentId) firstCreatedPaymentId = unappliedPayment.id;
      }
    });

    revalidatePath("/dashboard/payments");
    return { success: true, id: firstCreatedPaymentId };
  } catch (error) {
    console.error("Payment Error:", error);
    return { error: "Failed to record payment" };
  }
}

// 3. UPDATE PAYMENT (Metadata Only - strict accounting rule)
export async function updateCustomerPayment(
  formData: FormData,
): Promise<ActionResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const id = formData.get("id") as string;
  const reference = formData.get("reference") as string;
  const notes = formData.get("notes") as string;
  const date = new Date(formData.get("date") as string);

  try {
    await prisma.payment.update({
      where: { id },
      data: { reference, notes, date },
    });

    revalidatePath("/dashboard/payments");
    revalidatePath(`/dashboard/payments/${id}`);
    return { success: true, id };
  } catch (error) {
    console.error("Payment Update Error:", error);
    return { error: "Failed to update payment record." };
  }
}
