import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { recordPayment } from "@/lib/invoice-engine";

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const __denied = await forbiddenIfNo("payments", "CREATE");
  if (__denied) return __denied;
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const {
    amount,
    method = "CASH",
    reference,
    notes,
    bankAccountId,
    // Optional: explicit invoice allocation [{invoiceId, amount}]
    invoiceAllocations,
  } = body;

  if (!amount || Number(amount) <= 0)
    return NextResponse.json({ error: "Valid amount is required." }, { status: 400 });

  const res = await prisma.reservation.findUnique({
    where: { id },
    select: {
      tenantId: true,
      tenant: { select: { organizationId: true } },
    },
  });
  if (!res || res.tenant.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });

  try {
    const result = await recordPayment({
      tenantId:       res.tenantId,
      amount:         Number(amount),
      method,
      reference:      reference ?? undefined,
      notes:          notes ?? undefined,
      orgId:          actor.organizationId!,
      userId:         actor.id,
      receivedById:   actor.id,
      reservationId:  id,
      bankAccountId:  bankAccountId ?? undefined,
      invoiceAllocations: invoiceAllocations ?? undefined,
    });

    // Log activity
    await prisma.reservationActivity.create({
      data: {
        reservationId:  id,
        organizationId: actor.organizationId!,
        action:         "PAYMENT_RECORDED",
        description:    `Payment of ${Number(amount).toFixed(3)} OMR recorded (${method})${result.overpayment > 0 ? ` — overpayment: ${result.overpayment.toFixed(3)} OMR` : ""}`,
        performedById:  actor.id,
        metadata:       {
          amount:        Number(amount),
          method,
          reference,
          paymentId:     result.payment.id,
          allocations:   result.allocations.length,
          overpayment:   result.overpayment,
        },
      },
    });

    return NextResponse.json({
      success:    true,
      paymentId:  result.payment.id,
      allocations: result.allocations.length,
      overpayment: result.overpayment,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Payment recording failed.";
    console.error("[POST /api/reservations/[id]/payments]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
