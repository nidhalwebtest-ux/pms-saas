import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
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
  const __denied = await forbiddenIfNo("reservations", "CREATE");
  if (__denied) return __denied;
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { description, amount, category = "other" } = body;

  if (!description || !amount || Number(amount) <= 0)
    return NextResponse.json({ error: "description and amount are required." }, { status: 400 });

  const res = await prisma.reservation.findUnique({
    where: { id },
    select: { tenant: { select: { organizationId: true } }, grandTotal: true, totalPrice: true },
  });
  if (!res || res.tenant.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });

  const chargeAmt = Number(amount);

  await prisma.$transaction(async (tx) => {
    await tx.reservationCharge.create({
      data: {
        reservationId: id,
        organizationId: actor.organizationId!,
        description,
        amount: chargeAmt,
        category,
        createdById: actor.id,
      },
    });

    // Log activity
    await tx.reservationActivity.create({
      data: {
        reservationId: id,
        organizationId: actor.organizationId!,
        action: "CHARGE_ADDED",
        description: `Extra charge added: ${description} — ${chargeAmt.toFixed(3)} OMR`,
        performedById: actor.id,
        metadata: { description, amount: chargeAmt, category },
      },
    });
  });

  return NextResponse.json({ success: true });
}
