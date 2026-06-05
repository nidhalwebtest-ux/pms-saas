import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  getDisplayStatus,
  type StoredStatus,
} from "@/lib/reservation-status";
import {
  calculateNights,
  calculateGrandTotal,
} from "@/lib/reservation-engine";
import { getUnitConflict, type ConflictDetail } from "@/lib/reservation-conflict";
import { computeUnitPricings, findMonthlyBlock } from "@/lib/reservation-pricing";
import { generateInvoicesForReservation } from "@/lib/invoice-engine";

// ── Auth helper ───────────────────────────────────────────────────────────────

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

// ── Reservation number generator ──────────────────────────────────────────────

/**
 * Generate the next per-organization sequential reservation number using the
 * org's configurable format (Settings → Reservations — QA issue #29):
 *   - prefix   (e.g. "RES")
 *   - padding  (zero-pad width, e.g. 5 → "00001")
 *   - resetYearly: when true the number is `${prefix}-${year}-${seq}` and the
 *     sequence restarts each year; when false it's `${prefix}-${seq}` continuous.
 * Scoped to the org so a fresh org starts at 1 and cross-company volume never
 * leaks (QA #18).
 *
 * MUST be called inside a Prisma $transaction (Serializable) so concurrent
 * creates can't read the same "last" number — the @@unique([organizationId,
 * reservationNumber]) constraint is the final backstop. Mirrors nextInvoiceNumber.
 */
async function generateReservationNumber(
  orgId: string,
  tx: Prisma.TransactionClient,
): Promise<string> {
  const org = await tx.organization.findUnique({
    where:  { id: orgId },
    select: {
      reservationNumberPrefix:      true,
      reservationNumberPadding:     true,
      reservationNumberResetYearly: true,
    },
  });

  const base    = (org?.reservationNumberPrefix ?? "RES").trim() || "RES";
  const padding = Math.min(Math.max(org?.reservationNumberPadding ?? 5, 1), 10);
  const reset   = org?.reservationNumberResetYearly ?? true;
  const prefix  = reset ? `${base}-${new Date().getFullYear()}-` : `${base}-`;

  const last = await tx.reservation.findFirst({
    where: {
      organizationId:    orgId,
      reservationNumber: { startsWith: prefix },
    },
    orderBy: { reservationNumber: "desc" },
    select:  { reservationNumber: true },
  });

  let seq = 1;
  if (last?.reservationNumber) {
    const parts = last.reservationNumber.split("-");
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }

  return `${prefix}${String(seq).padStart(padding, "0")}`;
}

// ── GET /api/reservations ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp         = new URL(req.url).searchParams;
  const search     = sp.get("search")     ?? "";
  const propertyId = sp.get("propertyId") ?? "";
  const dateFrom   = sp.get("dateFrom")   ?? "";
  const dateTo     = sp.get("dateTo")     ?? "";
  const rateType   = sp.get("rateType")   ?? "";
  const source     = sp.get("source")     ?? "";

  const where: Prisma.ReservationWhereInput = {
    tenant: { organizationId: actor.organizationId! },
    ...(search ? {
      OR: [
        { reservationNumber: { contains: search, mode: "insensitive" } },
        { tenant: { firstName:  { contains: search, mode: "insensitive" } } },
        { tenant: { lastName:   { contains: search, mode: "insensitive" } } },
        { tenant: { phone:      { contains: search } } },
        { unit:   { name:       { contains: search, mode: "insensitive" } } },
        { reservationUnits: { some: { unit: { name: { contains: search, mode: "insensitive" } } } } },
      ],
    } : {}),
    ...(propertyId ? {
      OR: [
        { unit: { propertyId } },
        { reservationUnits: { some: { unit: { propertyId } } } },
      ],
    } : {}),
    ...(dateFrom ? { startDate: { gte: new Date(dateFrom) } } : {}),
    ...(dateTo   ? { startDate: { lte: new Date(dateTo)   } } : {}),
    ...(rateType ? { rateType } : {}),
    ...(source   ? { source }   : {}),
  };

  const raws = await prisma.reservation.findMany({
    where,
    include: {
      tenant: {
        select: {
          id: true, firstName: true, lastName: true,
          phone: true, nationality: true, classification: true,
          tenantType: true, corporateName: true,
        },
      },
      unit: {
        include: { property: { select: { id: true, name: true } } },
      },
      reservationUnits: {
        include: {
          unit: {
            select: {
              id: true, name: true, floor: true,
              property: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { startDate: "desc" },
    take: 500,
  });

  const today = new Date();
  const reservations = raws.map((r) => {
    const dsInfo = getDisplayStatus(r.status as StoredStatus, r.startDate, r.endDate, today);

    // Merge legacy unit + multi-unit, dedup by id
    const seen  = new Set<string>();
    const units: { id: string; name: string; floor: number; propertyId: string; propertyName: string }[] = [];
    if (r.unit) {
      seen.add(r.unit.id);
      units.push({ id: r.unit.id, name: r.unit.name, floor: r.unit.floor, propertyId: r.unit.property.id, propertyName: r.unit.property.name });
    }
    for (const ru of r.reservationUnits) {
      if (!seen.has(ru.unit.id)) {
        seen.add(ru.unit.id);
        units.push({ id: ru.unit.id, name: ru.unit.name, floor: ru.unit.floor, propertyId: ru.unit.property.id, propertyName: ru.unit.property.name });
      }
    }

    const grandTotal = Number(r.grandTotal ?? r.totalPrice ?? 0);
    const amountPaid = Number(r.amountPaid ?? 0);

    return {
      id:                      r.id,
      reservationNumber:       r.reservationNumber,
      status:                  r.status,
      displayStatus:           dsInfo.label,
      displayStatusBadgeClass: dsInfo.badgeClass,
      displayStatusRowClass:   dsInfo.rowClass,
      displayStatusPriority:   dsInfo.priority,
      displayStatusUrgent:     dsInfo.urgent,
      displayStatusPulse:      dsInfo.pulse,
      startDate:               r.startDate.toISOString(),
      endDate:                 r.endDate.toISOString(),
      actualCheckIn:           r.actualCheckIn?.toISOString()  ?? null,
      actualCheckOut:          r.actualCheckOut?.toISOString() ?? null,
      totalNights:             r.totalNights,
      rateType:                r.rateType,
      grandTotal:              grandTotal.toFixed(3),
      amountPaid:              amountPaid.toFixed(3),
      balanceDue:              Math.max(0, grandTotal - amountPaid),
      source:                  r.source,
      notes:                   r.notes,
      cancelledReason:         r.cancelledReason,
      tenant:                  r.tenant,
      units,
      createdAt:               r.createdAt.toISOString(),
    };
  });

  return NextResponse.json({ reservations });
}

// ── POST /api/reservations ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    tenantId,
    unitIds,           // string[]  — at least one unit
    startDate: startStr,
    endDate:   endStr,
    rateType,          // "daily" | "monthly"
    source,
    notes,
    discountAmount: discountRaw = 0,
    // Custom rate overrides: [{unitId, rateAmount}]
    unitOverrides = [] as { unitId: string; rateAmount: number }[],
  } = body;

  // ── Basic validation ──────────────────────────────────────────────────────

  if (!tenantId || !Array.isArray(unitIds) || unitIds.length === 0)
    return NextResponse.json({ error: "tenantId and at least one unitId are required." }, { status: 400 });

  if (!startStr || !endStr)
    return NextResponse.json({ error: "startDate and endDate are required." }, { status: 400 });

  const startDate = new Date(startStr);
  const endDate   = new Date(endStr);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()))
    return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD." }, { status: 400 });

  if (startDate >= endDate)
    return NextResponse.json({ error: "checkOut must be after checkIn." }, { status: 400 });

  const rt: "daily" | "monthly" = rateType === "monthly" ? "monthly" : "daily";

  // ── Verify tenant belongs to org ──────────────────────────────────────────

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { organizationId: true },
  });
  if (!tenant || tenant.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  // ── Verify units belong to org and compute pricing ─────────────────────────

  const unitRecords = await prisma.unit.findMany({
    where: { id: { in: unitIds } },
    include: { property: { select: { organizationId: true } } },
  });

  if (unitRecords.length !== unitIds.length)
    return NextResponse.json({ error: "One or more units not found." }, { status: 404 });

  for (const u of unitRecords) {
    if (u.property.organizationId !== actor.organizationId)
      return NextResponse.json({ error: "Unauthorized access to unit." }, { status: 403 });
  }

  // Block monthly reservations during seasons flagged disallowMonthly (QA #27).
  if (rt === "monthly") {
    const block = await findMonthlyBlock(unitIds, startDate, endDate);
    if (block) {
      const unitName = unitRecords.find((u) => u.id === block.unitId)?.name ?? "this unit";
      return NextResponse.json(
        { error: `Monthly bookings aren't allowed for ${unitName} during ${block.name ?? "this season"}.`, code: "monthly_blocked" },
        { status: 409 },
      );
    }
  }

  // Compute pricing + persisted segments per unit (shared with the edit PUT).
  const unitPricings = await computeUnitPricings(unitIds, rt, startDate, endDate, unitOverrides);

  const totalNightsVal = calculateNights(startDate, endDate);
  const discount    = Math.max(0, Number(discountRaw) || 0);
  const grandResult = calculateGrandTotal(
    unitPricings.map((u) => u.subtotal),
    discount,
  );

  const totalNights = totalNightsVal;

  // Auto-generate invoice(s) for in-scope reservations when the org opts in
  // (QA #24/#34 — "contract" = invoice). Read-only settings fetch.
  const orgInvoiceSettings = await prisma.organization.findUnique({
    where:  { id: actor.organizationId! },
    select: { autoGenerateInvoiceOnCreate: true, requireInvoiceScope: true },
  });
  const autoGenerateInvoice =
    !!orgInvoiceSettings?.autoGenerateInvoiceOnCreate &&
    (orgInvoiceSettings.requireInvoiceScope === "ALL" || rt === "monthly");

  // ── Serializable transaction (double-booking prevention) ──────────────────

  try {
    const reservation = await prisma.$transaction(
      async (tx) => {
        // Re-check availability inside the transaction
        for (const unitId of unitIds) {
          const unitName = unitRecords.find((u) => u.id === unitId)?.name ?? unitId;
          const conflict = await getUnitConflict(tx, unitId, unitName, startDate, endDate);
          if (conflict) {
            throw new Error(`CONFLICT:${JSON.stringify(conflict)}`);
          }
        }

        const resNumber = await generateReservationNumber(actor.organizationId!, tx);

        const res = await tx.reservation.create({
          data: {
            reservationNumber: resNumber,
            organizationId: actor.organizationId!,
            startDate,
            endDate,
            status:         "PENDING",
            rateType:       rt,
            source:         source ?? "walk_in",
            notes:          notes ?? null,
            frequency:      rt === "monthly" ? "MONTHLY" : "DAILY",
            totalNights,
            amount:         grandResult.grandTotal,  // compat
            totalPrice:     grandResult.grandTotal,  // compat
            totalAmount:    grandResult.totalAmount,
            discountAmount: grandResult.discountAmount,
            taxAmount:      grandResult.taxAmount,
            grandTotal:     grandResult.grandTotal,
            amountPaid:     0,
            tenantId,
            // unitId stays null for multi-unit; set for single-unit for compat
            unitId: unitIds.length === 1 ? unitIds[0] : null,
            createdById: actor.id,
          },
        });

        // Create ReservationUnit rows
        await tx.reservationUnit.createMany({
          data: unitPricings.map((up) => ({
            reservationId:     res.id,
            unitId:            up.unitId,
            rateType:          up.rateType,
            rateAmount:        up.rateAmount,
            rateSource:        up.rateSource,
            seasonalPriceName: up.seasonalPriceName,
            nights:            up.nights,
            subtotal:          up.subtotal,
            pricingSegments:   up.pricingSegments as unknown as Prisma.InputJsonValue,
          })),
        });

        return res;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // Auto-generate invoice(s) once the reservation is committed (QA #34). The
    // invoice engine runs its own transaction; failure here shouldn't fail the
    // booking, so it's best-effort and logged.
    if (autoGenerateInvoice) {
      try {
        await generateInvoicesForReservation(reservation.id, actor.organizationId!, actor.id);
        // Mirror the manual "Generate Invoices" route so the flag stays in sync
        // (drives the edit guard + detail UI).
        await prisma.reservation.update({
          where: { id: reservation.id },
          data:  { invoicesGenerated: true, invoicesGeneratedAt: new Date(), invoicesGeneratedById: actor.id },
        });
      } catch (e) {
        console.error("[POST /api/reservations] auto-generate invoice failed:", e);
      }
    }

    return NextResponse.json({ reservation }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("CONFLICT:")) {
      try {
        const conflict = JSON.parse(msg.replace("CONFLICT:", "")) as ConflictDetail;
        if (conflict) {
          return NextResponse.json({ error: "double_booking", conflict }, { status: 409 });
        }
      } catch {
        // fallback
      }
      return NextResponse.json(
        { error: "Unit is no longer available for the selected dates." },
        { status: 409 },
      );
    }
    console.error("[POST /api/reservations]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
