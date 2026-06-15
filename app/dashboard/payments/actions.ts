"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access";
import {
  requireOrgUser,
  assertTenantOwnership,
  assertPaymentOwnership,
} from "@/lib/tenant";

export type ActionResponse = {
  error?: string;
  success?: boolean;
  id?: string;
};

// 1. FETCH OPEN TRANSACTIONS (Used by Client Component)
export async function getTenantFinancials(tenantId: string) {
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch (e: any) { return { invoices: [], balance: 0 }; }
  try { await assertTenantOwnership(tenantId, orgUser.organizationId); } catch { return { invoices: [], balance: 0 }; }

  const unpaidInvoices = await prisma.invoice.findMany({
    where: {
      tenantId: tenantId,
      status: { in: ["ISSUED", "PARTIALLY_PAID", "PENDING", "DUE"] as any },
    },
    orderBy: { dueDate: "asc" },
  });

  const serializedInvoices = unpaidInvoices.map((inv) => ({
    ...inv,
    totalAmount: Number(inv.totalAmount),
    balanceDue: Number(inv.balanceDue),
    // compat alias
    amount: Number(inv.balanceDue),
  }));

  const totalDue = serializedInvoices.reduce((sum, inv) => sum + inv.balanceDue, 0);

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
  if (!(await hasAccess("payments", "CREATE"))) return { error: "forbidden" };

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

  // Verify the tenant belongs to the caller's org
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch (e: any) { return e; }
  try { await assertTenantOwnership(tenantId, orgUser.organizationId); } catch (e: any) { return e; }
  if (isNaN(totalAmount) || totalAmount <= 0)
    return { error: "Amount must be valid" };

  try {
    let firstCreatedPaymentId = ""; // Track the ID to redirect to the receipt

    await prisma.$transaction(async (tx) => {
      let remainingPayment = totalAmount;

      const invoicesToPay = await tx.invoice.findMany({
        where: { id: { in: selectedInvoiceIds } },
        orderBy: { dueDate: "asc" },
      });

      for (const invoice of invoicesToPay) {
        if (remainingPayment <= 0) break;

        const outstanding = Number(invoice.balanceDue);
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

          const newBalanceDue = Math.round((outstanding - amountToApply) * 1000) / 1000;
          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              amountPaid: { increment: amountToApply },
              balanceDue: newBalanceDue,
              status: newBalanceDue <= 0 ? "PAID" : "PARTIALLY_PAID",
              ...(newBalanceDue <= 0 ? { paidDate: new Date() } : {}),
            },
          });
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
  if (!(await hasAccess("payments", "CREATE"))) return { error: "forbidden" };

  const id = formData.get("id") as string;
  const reference = formData.get("reference") as string;
  const notes = formData.get("notes") as string;
  const date = new Date(formData.get("date") as string);

  // Verify the payment belongs to the caller's org
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch (e: any) { return e; }
  try { await assertPaymentOwnership(id, orgUser.organizationId); } catch (e: any) { return e; }

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
