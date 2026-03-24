import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

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
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { amount, method = "CASH", reference, notes } = body;

  if (!amount || Number(amount) <= 0)
    return NextResponse.json({ error: "Valid amount is required." }, { status: 400 });

  const res = await prisma.reservation.findUnique({
    where: { id },
    select: {
      tenantId: true,
      amountPaid: true,
      grandTotal: true,
      tenant: { select: { organizationId: true } },
    },
  });
  if (!res || res.tenant.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });

  const payAmt = Number(amount);
  const newAmountPaid = Number(res.amountPaid) + payAmt;

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        amount: payAmt,
        method: method as any,
        reference: reference ?? null,
        notes: notes ?? null,
        tenantId: res.tenantId,
        reservationId: id,
      },
    });

    await tx.reservation.update({
      where: { id },
      data: { amountPaid: newAmountPaid },
    });

    await tx.reservationActivity.create({
      data: {
        reservationId: id,
        organizationId: actor.organizationId!,
        action: "PAYMENT_RECORDED",
        description: `Payment of ${payAmt.toFixed(3)} OMR recorded (${method})`,
        performedById: actor.id,
        metadata: { amount: payAmt, method, reference },
      },
    });
  });

  return NextResponse.json({ success: true });
}
