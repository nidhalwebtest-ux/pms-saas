import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { canTransitionTo, type StoredStatus } from "@/lib/reservation-status";
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

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const res = await prisma.reservation.findUnique({
    where: { id },
    include: {
      tenant:           { select: { organizationId: true, firstName: true, lastName: true } },
      reservationUnits: { select: { unitId: true } },
      invoices: {
        where: { status: { notIn: ["CANCELLED", "VOID"] } },
        select: { id: true, status: true, periodStart: true, invoiceType: true },
      },
    },
  });


  if (!res || res.tenant.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });

  if (!canTransitionTo(res.status as StoredStatus, "CHECKED_IN"))
    return NextResponse.json(
      { error: `Cannot check in a reservation with status "${res.status}".` },
      { status: 409 },
    );

  const unitIds = [
    ...new Set([
      ...(res.unitId ? [res.unitId] : []),
      ...res.reservationUnits.map((ru) => ru.unitId),
    ]),
  ];

  const unitNames = await prisma.unit.findMany({
    where:  { id: { in: unitIds } },
    select: { name: true },
  });
  const unitLabel = unitNames.map((u) => u.name).join(", ");

  const today    = new Date();
  const todayDay = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

  // Determine which invoices need their due date set to today:
  //  - DAILY/SHORT_TERM: all PENDING invoices → due today
  //  - MONTHLY: invoices whose periodStart <= today → due today
  const isMonthly = res.rateType === "monthly" || res.rateType === "MONTHLY";

  const invoiceIdsForDueDate = res.invoices
    .filter((inv) => ["PENDING", "DRAFT", "DUE", "ISSUED"].includes(inv.status))
    .filter((inv) => {
      if (!isMonthly) return true;
      const ps = new Date(inv.periodStart);
      const psDay = new Date(Date.UTC(ps.getFullYear(), ps.getMonth(), ps.getDate()));
      return psDay <= todayDay;
    })
    .map((inv) => inv.id);

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id },
      data: { status: "CHECKED_IN", actualCheckIn: today },
    });

    if (unitIds.length > 0) {
      await tx.unit.updateMany({
        where: { id: { in: unitIds } },
        data:  { status: "OCCUPIED" },
      });
    }

    // Set due date to today for already-existing relevant invoices
    if (invoiceIdsForDueDate.length > 0) {
      await tx.invoice.updateMany({
        where: { id: { in: invoiceIdsForDueDate } },
        data:  { dueDate: todayDay },
      });
    }

    await tx.reservationActivity.create({
      data: {
        reservationId:  id,
        organizationId: actor.organizationId!,
        action:         "CHECKED_IN",
        description:    `Checked in${unitLabel ? ` — Units ${unitLabel} marked as Occupied` : ""}`,
        performedById:  actor.id,
        metadata:       { unitIds, unitNames: unitNames.map((u) => u.name) },
      },
    });
  });

  // ── Auto-generate invoices on check-in (if not yet generated) ───────────────
  let generatedCount = 0;
  if (!res.invoicesGenerated) {
    try {
      const invoiceResult = await generateInvoicesForReservation(
        id,
        actor.organizationId!,
        actor.id,
      );
      generatedCount = invoiceResult.invoices.length;

      await prisma.reservation.update({
        where: { id },
        data: {
          invoicesGenerated:     true,
          invoicesGeneratedAt:   new Date(),
          invoicesGeneratedById: actor.id,
        },
      });

      await prisma.reservationActivity.create({
        data: {
          reservationId:  id,
          organizationId: actor.organizationId!,
          action:         "CHARGE_ADDED",
          description:    `${generatedCount} invoice(s) auto-generated on check-in`,
          performedById:  actor.id,
          metadata:       { invoiceCount: generatedCount, totalExpected: invoiceResult.totalExpected },
        },
      });
    } catch (invErr) {
      // Log but don't fail check-in if invoice generation has an error
      console.error("[check-in] auto-generate invoices failed:", invErr);
    }
  }

  return NextResponse.json({
    success:        true,
    message:        `${res.tenant.firstName} ${res.tenant.lastName} checked in${unitLabel ? ` to ${unitLabel}` : ""}${generatedCount > 0 ? `. ${generatedCount} invoice(s) generated.` : ""}.`,
    invoicesGenerated: generatedCount,
  });
}
