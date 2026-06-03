import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

// Contract endpoints for a reservation (QA #24, Phase 1).
//   POST  → create a DRAFT contract (if none exists)
//   PATCH → { action: "sign", signedByName } | { action: "cancel" }

async function getActor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { id: true, organizationId: true },
  });
  return dbUser?.organizationId ? dbUser : null;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const res = await prisma.reservation.findUnique({
    where:  { id },
    select: { id: true, organizationId: true, contract: { select: { id: true } } },
  });
  if (!res || res.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  if (res.contract)
    return NextResponse.json({ error: "A contract already exists for this reservation." }, { status: 409 });

  const contract = await prisma.contract.create({
    data: {
      reservationId:  id,
      organizationId: actor.organizationId!,
      status:         "DRAFT",
      createdById:    actor.id,
    },
  });
  return NextResponse.json({ contract });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  const res = await prisma.reservation.findUnique({
    where:  { id },
    select: { id: true, organizationId: true, contract: { select: { id: true, status: true } } },
  });
  if (!res || res.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  if (!res.contract)
    return NextResponse.json({ error: "This reservation has no contract." }, { status: 404 });

  if (action === "sign") {
    const signedByName = ((body.signedByName as string) ?? "").trim();
    if (!signedByName)
      return NextResponse.json({ error: "Signer name is required." }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id: res.contract!.id },
        data:  { status: "SIGNED", signedAt: new Date(), signedByName, signedById: actor.id },
      });
      await tx.reservationActivity.create({
        data: {
          reservationId:  id,
          organizationId: actor.organizationId!,
          action:         "CONTRACT_SIGNED",
          description:    `Contract marked signed by ${signedByName}.`,
          performedById:  actor.id,
        },
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "cancel") {
    await prisma.contract.update({
      where: { id: res.contract.id },
      data:  { status: "CANCELLED" },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
