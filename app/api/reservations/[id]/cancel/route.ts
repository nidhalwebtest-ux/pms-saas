import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { canTransitionTo, type StoredStatus } from "@/lib/reservation-status";

async function getActor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, organizationId: true },
  });
  return dbUser?.organizationId ? dbUser : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const __denied = await forbiddenIfNo("resCancel", "VIEW");
  if (__denied) return __denied;
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { reason = "", notes = "" } = body as { reason?: string; notes?: string };

  if (!reason.trim())
    return NextResponse.json({ error: "Cancellation reason is required." }, { status: 400 });

  const res = await prisma.reservation.findUnique({
    where: { id },
    include: {
      tenant:           { select: { organizationId: true } },
      reservationUnits: { select: { unitId: true } },
      payments:         { select: { amount: true } },
      invoices: {
        where: { status: { notIn: ["CANCELLED", "VOID"] } },
        select: { id: true, status: true, amountPaid: true, invoiceNumber: true },
      },
    },
  });

  if (!res || res.tenant.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });

  if (!canTransitionTo(res.status as StoredStatus, "CANCELLED"))
    return NextResponse.json(
      { error: `Cannot cancel a reservation with status "${res.status}".` },
      { status: 409 },
    );

  // Block cancel if any invoice has been partially or fully paid
  const paidInvoices = res.invoices.filter((inv) =>
    ["PAID", "PARTIALLY_PAID", "PARTIAL"].includes(inv.status),
  );
  if (paidInvoices.length > 0) {
    return NextResponse.json(
      {
        error: `Cannot cancel: ${paidInvoices.length} invoice(s) have recorded payments (${paidInvoices.map((i) => i.invoiceNumber).join(", ")}). Cancel those invoices first.`,
      },
      { status: 409 },
    );
  }

  const cancelledReason = notes.trim()
    ? `${reason.trim()}: ${notes.trim()}`
    : reason.trim();

  const totalPaid = res.payments.reduce((s, p) => s + Number(p.amount), 0);
  const hasPayment = totalPaid > 0;

  const unitIds = [
    ...new Set([
      ...(res.unitId ? [res.unitId] : []),
      ...res.reservationUnits.map((ru) => ru.unitId),
    ]),
  ];

  // IDs of PENDING invoices to auto-cancel
  const pendingInvoiceIds = res.invoices
    .filter((inv) => ["PENDING", "DRAFT", "DUE", "ISSUED"].includes(inv.status))
    .map((inv) => inv.id);

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id },
      data: {
        status:          "CANCELLED",
        cancelledReason: cancelledReason,
        cancelledAt:     now,
        refundPending:   hasPayment,
      },
    });

    // Auto-cancel PENDING invoices
    if (pendingInvoiceIds.length > 0) {
      await tx.invoice.updateMany({
        where: { id: { in: pendingInvoiceIds } },
        data: {
          status:          "CANCELLED",
          cancelledReason: `Reservation cancelled: ${cancelledReason}`,
          cancelledAt:     now,
        },
      });
    }

    if (unitIds.length > 0) {
      await tx.unit.updateMany({
        where: { id: { in: unitIds } },
        data:  { status: "AVAILABLE" },
      });
    }
    await tx.reservationActivity.create({
      data: {
        reservationId: id,
        organizationId: actor.organizationId!,
        action: "CANCELLED",
        description: `Reservation cancelled. Reason: ${reason}${notes ? ` — ${notes}` : ""}${pendingInvoiceIds.length > 0 ? ` ${pendingInvoiceIds.length} invoice(s) auto-cancelled.` : ""}${hasPayment ? ` Refund required: ${totalPaid.toFixed(3)} OMR.` : ""}`,
        performedById: actor.id,
        metadata: { reason, notes, refundPending: hasPayment, totalPaid, cancelledInvoiceCount: pendingInvoiceIds.length },
      },
    });
  });

  return NextResponse.json({
    success:              true,
    totalPaid:            totalPaid.toFixed(3),
    refundPending:        hasPayment,
    cancelledInvoices:    pendingInvoiceIds.length,
    message:              `Reservation cancelled.${pendingInvoiceIds.length > 0 ? ` ${pendingInvoiceIds.length} invoice(s) cancelled.` : ""}${hasPayment ? ` Refund of ${totalPaid.toFixed(3)} OMR is pending.` : ""}`,
  });
}
