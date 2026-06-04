import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { canTransitionTo, type StoredStatus } from "@/lib/reservation-status";
import { generateInvoicesForReservation } from "@/lib/invoice-engine";
import { getUnitConflict, getCheckedInOccupant } from "@/lib/reservation-conflict";

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
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Optional per-reservation check-in policy override from the request body.
  // Values: "ALLOW_BACK_TO_BACK" | "REQUIRE_VACANT" | null (clear override).
  let overrideFromBody: "ALLOW_BACK_TO_BACK" | "REQUIRE_VACANT" | null | undefined;
  try {
    const body = await req.json();
    if (body && "checkInPolicyOverride" in body) {
      const v = body.checkInPolicyOverride;
      overrideFromBody =
        v === "ALLOW_BACK_TO_BACK" || v === "REQUIRE_VACANT" ? v : null;
    }
  } catch {
    // No/invalid JSON body — leave override unchanged.
  }

  const res = await prisma.reservation.findUnique({
    where: { id },
    include: {
      tenant:           { select: { organizationId: true, firstName: true, lastName: true } },
      reservationUnits: { select: { unitId: true } },
      contract:         { select: { status: true } },
      invoices: {
        where: { status: { notIn: ["CANCELLED", "VOID"] } },
        select: { id: true, status: true, periodStart: true, invoiceType: true },
      },
    },
  });

  // Effective check-in policy = per-reservation override, else org default.
  const org = await prisma.organization.findUnique({
    where:  { id: actor.organizationId! },
    select: {
      checkInPolicy: true, allowEarlyCheckIn: true,
      requireContractBeforeCheckIn: true, requireContractScope: true,
    },
  });
  // Body override (if provided) wins over the stored one for this check-in.
  const resolvedOverride =
    overrideFromBody !== undefined ? overrideFromBody : res?.checkInPolicyOverride ?? null;
  const effectivePolicy =
    resolvedOverride ?? org?.checkInPolicy ?? "ALLOW_BACK_TO_BACK";


  if (!res || res.tenant.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });

  if (!canTransitionTo(res.status as StoredStatus, "CHECKED_IN"))
    return NextResponse.json(
      { error: `Cannot check in a reservation with status "${res.status}".` },
      { status: 409 },
    );

  // Early check-in guard: when the org disallows early check-in, block checking
  // in before the reservation's start day.
  if (org && org.allowEarlyCheckIn === false) {
    const startDay = new Date(Date.UTC(
      res.startDate.getUTCFullYear(), res.startDate.getUTCMonth(), res.startDate.getUTCDate(),
    ));
    const nowDay = new Date();
    const todayUTC = new Date(Date.UTC(nowDay.getUTCFullYear(), nowDay.getUTCMonth(), nowDay.getUTCDate()));
    if (todayUTC < startDay) {
      return NextResponse.json(
        { error: "Early check-in is disabled. This reservation cannot be checked in before its start date." },
        { status: 409 },
      );
    }
  }

  // Contract gate (QA #24): when enabled, an in-scope reservation needs a SIGNED
  // contract before check-in.
  if (org?.requireContractBeforeCheckIn) {
    const scopeAll  = org.requireContractScope === "ALL";
    const inScope   = scopeAll || res.rateType === "monthly";
    if (inScope && res.contract?.status !== "SIGNED") {
      return NextResponse.json(
        { error: "A signed contract is required before check-in. Create the contract and mark it signed first.", code: "contract_required" },
        { status: 409 },
      );
    }
  }

  const unitIds = [
    ...new Set([
      ...(res.unitId ? [res.unitId] : []),
      ...res.reservationUnits.map((ru) => ru.unitId),
    ]),
  ];

  const unitNames = await prisma.unit.findMany({
    where:  { id: { in: unitIds } },
    select: { id: true, name: true },
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

  try {
    await prisma.$transaction(
      async (tx) => {
        // Re-check availability inside the transaction (double-booking prevention).
        // Guards against checking in a reservation whose unit is already occupied
        // by another overlapping active reservation — and, under Serializable
        // isolation, against two concurrent check-ins on the same unit.
        for (const unitId of unitIds) {
          const unitName = unitNames.find((u) => u.id === unitId)?.name ?? unitId;

          // Always block a true date overlap (any policy).
          const conflict = await getUnitConflict(
            tx, unitId, unitName, res.startDate, res.endDate, id,
          );
          if (conflict) {
            throw new Error(`CONFLICT:${JSON.stringify({ ...conflict, reason: "overlap" })}`);
          }

          // Block double physical occupancy (QA #33): a unit can't have two
          // guests CHECKED_IN at once. Always check — date-range adjacency
          // (getUnitConflict) isn't enough because early check-in can place a
          // second guest into a unit while the first is still mid-stay.
          //  - REQUIRE_VACANT: block on ANY current occupant (must check out first).
          //  - ALLOW_BACK_TO_BACK: still permit a same-day turnover (the prior
          //    guest's stay ends today or earlier), but block if they're still
          //    mid-stay (endDate in the future) — e.g. an early check-in.
          const occupant = await getCheckedInOccupant(tx, unitId, unitName, id);
          if (occupant) {
            const occEnd    = new Date(occupant.endDate);
            const occEndDay = new Date(Date.UTC(occEnd.getUTCFullYear(), occEnd.getUTCMonth(), occEnd.getUTCDate()));
            const occupantStillMidStay = occEndDay > todayDay;
            if (effectivePolicy === "REQUIRE_VACANT" || occupantStillMidStay) {
              throw new Error(`CONFLICT:${JSON.stringify({ ...occupant, reason: "occupied" })}`);
            }
          }
        }

        await tx.reservation.update({
          where: { id },
          data: {
            status: "CHECKED_IN",
            actualCheckIn: today,
            // Persist the override only when the client explicitly sent the field.
            ...(overrideFromBody !== undefined
              ? { checkInPolicyOverride: overrideFromBody }
              : {}),
          },
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
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("CONFLICT:")) {
      const conflict = JSON.parse(msg.slice("CONFLICT:".length));
      const error =
        conflict.reason === "occupied"
          ? `Cannot check in: unit ${conflict.unitName} is still occupied by ${conflict.guestName} (reservation ${conflict.reservationNumber ?? "—"}). Check them out first, or allow back-to-back check-in.`
          : `Cannot check in: unit ${conflict.unitName} is already booked for these dates by ${conflict.guestName} (reservation ${conflict.reservationNumber ?? "—"}).`;
      return NextResponse.json(
        {
          error,
          conflict,
        },
        { status: 409 },
      );
    }
    throw err;
  }

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
