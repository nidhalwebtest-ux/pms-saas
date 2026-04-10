import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { generateInvoicesForReservation } from "@/lib/invoice-engine";

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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const res = await prisma.reservation.findUnique({
    where: { id },
    include: { tenant: { select: { organizationId: true } } },
  });

  if (!res || res.tenant.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });

  if (!["PENDING", "CONFIRMED", "CHECKED_IN"].includes(res.status))
    return NextResponse.json(
      { error: `Cannot generate invoices for a reservation with status "${res.status}".` },
      { status: 409 },
    );

  // Check if already generated — return existing invoices instead of duplicating
  if (res.invoicesGenerated) {
    const existing = await prisma.invoice.findMany({
      where: { reservationId: id, status: { notIn: ["CANCELLED", "VOID"] } },
      orderBy: { periodStart: "asc" },
    });
    return NextResponse.json({
      success: true,
      alreadyGenerated: true,
      invoiceCount: existing.length,
      message: `${existing.length} invoice(s) already exist for this reservation.`,
    });
  }

  let result;
  try {
    result = await generateInvoicesForReservation(id, actor.organizationId!, actor.id);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Invoice generation failed.";
    console.error("[generate-invoices]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Mark invoices as generated on the reservation
  await prisma.reservation.update({
    where: { id },
    data: {
      invoicesGenerated:     true,
      invoicesGeneratedAt:   new Date(),
      invoicesGeneratedById: actor.id,
    },
  });

  // Log activity
  await prisma.reservationActivity.create({
    data: {
      reservationId:  id,
      organizationId: actor.organizationId!,
      action:         "CHARGE_ADDED",
      description:    `${result.invoices.length} invoice(s) generated (total expected: ${result.totalExpected})`,
      performedById:  actor.id,
      metadata:       {
        invoiceCount:   result.invoices.length,
        totalExpected:  result.totalExpected,
      },
    },
  });

  return NextResponse.json({
    success:      true,
    invoiceCount: result.invoices.length,
    totalExpected: result.totalExpected,
    message:      `${result.invoices.length} invoice(s) generated successfully.`,
  });
}
