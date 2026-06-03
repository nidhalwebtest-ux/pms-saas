import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getDisplayStatus, type StoredStatus } from "@/lib/reservation-status";
import { calculateNights, calculateGrandTotal } from "@/lib/reservation-engine";
import { getUnitConflict, type ConflictDetail } from "@/lib/reservation-conflict";
import { computeUnitPricings, findMonthlyBlock } from "@/lib/reservation-pricing";

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const r = await prisma.reservation.findUnique({
    where: { id },
    include: {
      tenant: {
        select: {
          id: true, firstName: true, lastName: true, fullNameArabic: true,
          phone: true, whatsappNumber: true, email: true,
          nationality: true, classification: true, tenantType: true,
          corporateName: true, corporateContact: true, idType: true, idNumber: true, idExpiryDate: true,
          specialRequests: true, internalNotes: true,
          totalStays: true, totalSpent: true, firstStayDate: true,
          organizationId: true,
        },
      },
      unit: {
        include: { property: { select: { id: true, name: true } } },
      },
      reservationUnits: {
        include: {
          unit: {
            select: {
              id: true, name: true, floor: true, unitType: true,
              property: { select: { id: true, name: true } },
            },
          },
        },
      },
      payments: {
        orderBy: { date: "asc" },
        include: { invoice: { select: { id: true, invoiceNumber: true } } },
      },
      charges: {
        orderBy: { createdAt: "asc" },
        include: { createdBy: { select: { firstName: true, lastName: true } } },
      },
      invoices: {
        orderBy: { periodStart: "asc" },
        select: {
          id: true,
          invoiceNumber: true,
          invoiceType: true,
          monthNumber: true,
          status: true,
          totalAmount: true,
          amountPaid: true,
          balanceDue: true,
          dueDate: true,
          periodStart: true,
          periodEnd: true,
        },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { performedBy: { select: { firstName: true, lastName: true } } },
      },
      returns: {
        where:   { status: "active" },
        orderBy: { createdAt: "desc" },
        include: {
          lineItems: true,
          invoice:   { select: { id: true, invoiceNumber: true } },
          refundProcessedBy: { select: { firstName: true, lastName: true } },
          createdBy:         { select: { firstName: true, lastName: true } },
        },
      },
      contract: { select: { id: true, status: true, signedAt: true, signedByName: true } },
      createdBy: { select: { firstName: true, lastName: true } },
    },
  });

  if (!r) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (r.tenant.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Not found." }, { status: 404 });

  const org = await prisma.organization.findUnique({
    where:  { id: actor.organizationId },
    select: { checkInPolicy: true },
  });

  const dsInfo = getDisplayStatus(r.status as StoredStatus, r.startDate, r.endDate);

  // Merge units (legacy + junction table). The junction table is the source of
  // truth for moved-out info; we also expose the destination unit name so the
  // detail page can render "moved to →" alongside the old unit.
  type ReservationUnitWithUnit = (typeof r.reservationUnits)[number];
  const ruById = new Map<string, ReservationUnitWithUnit>(
    r.reservationUnits.map((ru) => [ru.id, ru]),
  );
  const seen = new Set<string>();
  const units: {
    id: string; name: string; floor: number; unitType: string;
    propertyId: string; propertyName: string;
    rateType: string; rateAmount: string; rateSource: string;
    seasonalPriceName: string | null; nights: number; subtotal: string;
    isMovedOut: boolean;
    movedToUnitId: string | null;
    movedToUnitName: string | null;
    moveDate: string | null;
    moveReason: string | null;
  }[] = [];

  function pushUnit(args: {
    unitId: string; unitName: string; floor: number; unitType: string;
    propertyId: string; propertyName: string;
    ru?: ReservationUnitWithUnit | null;
    fallbackRateType: string; fallbackNights: number; fallbackSubtotal: string;
  }) {
    const { ru } = args;
    const movedTo = ru?.movedToUnitId ? ruById.get(ru.movedToUnitId) : null;
    units.push({
      id: args.unitId, name: args.unitName, floor: args.floor, unitType: args.unitType,
      propertyId: args.propertyId, propertyName: args.propertyName,
      rateType: ru?.rateType ?? args.fallbackRateType,
      rateAmount: ru ? ru.rateAmount.toString() : "0",
      rateSource: ru?.rateSource ?? "default_price",
      seasonalPriceName: ru?.seasonalPriceName ?? null,
      nights: ru?.nights ?? args.fallbackNights,
      subtotal: ru ? ru.subtotal.toString() : args.fallbackSubtotal,
      isMovedOut: ru?.isMovedOut ?? false,
      movedToUnitId: movedTo?.unitId ?? null,
      movedToUnitName: movedTo?.unit.name ?? null,
      moveDate: ru?.moveDate ? ru.moveDate.toISOString() : null,
      moveReason: ru?.moveReason ?? null,
    });
  }

  if (r.unit) {
    const ru = r.reservationUnits.find((x) => x.unitId === r.unit!.id);
    seen.add(r.unit.id);
    pushUnit({
      unitId: r.unit.id, unitName: r.unit.name, floor: r.unit.floor, unitType: r.unit.unitType,
      propertyId: r.unit.property.id, propertyName: r.unit.property.name,
      ru,
      fallbackRateType: r.rateType,
      fallbackNights: r.totalNights,
      fallbackSubtotal: Number(r.grandTotal).toFixed(3),
    });
  }
  for (const ru of r.reservationUnits) {
    if (!seen.has(ru.unitId)) {
      seen.add(ru.unitId);
      pushUnit({
        unitId: ru.unit.id, unitName: ru.unit.name, floor: ru.unit.floor, unitType: ru.unit.unitType,
        propertyId: ru.unit.property.id, propertyName: ru.unit.property.name,
        ru,
        fallbackRateType: ru.rateType,
        fallbackNights: ru.nights,
        fallbackSubtotal: ru.subtotal.toString(),
      });
    }
  }

  const grandTotal   = Number(r.grandTotal ?? r.totalPrice ?? 0);
  const amountPaid   = Number(r.amountPaid ?? 0);
  const chargesTotal = r.charges.reduce((s, c) => s + Number(c.amount), 0);

  return NextResponse.json({
    id: r.id,
    reservationNumber: r.reservationNumber,
    status: r.status,
    displayStatus: dsInfo.label,
    displayStatusBadgeClass: dsInfo.badgeClass,
    displayStatusRowClass: dsInfo.rowClass,
    displayStatusPriority: dsInfo.priority,
    displayStatusUrgent: dsInfo.urgent,
    displayStatusPulse: dsInfo.pulse,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    actualCheckIn: r.actualCheckIn?.toISOString() ?? null,
    actualCheckOut: r.actualCheckOut?.toISOString() ?? null,
    totalNights: r.totalNights,
    rateType: r.rateType,
    source: r.source,
    notes: r.notes,
    cancelledReason: r.cancelledReason,
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
    refundPending: r.refundPending,
    checkInPolicyOverride: r.checkInPolicyOverride,
    orgCheckInPolicy: org?.checkInPolicy ?? "ALLOW_BACK_TO_BACK",
    totalAmount: Number(r.totalAmount).toFixed(3),
    discountAmount: Number(r.discountAmount).toFixed(3),
    taxAmount: Number(r.taxAmount).toFixed(3),
    grandTotal: grandTotal.toFixed(3),
    amountPaid: amountPaid.toFixed(3),
    balanceDue: Math.max(0, grandTotal + chargesTotal - amountPaid).toFixed(3),
    chargesTotal: chargesTotal.toFixed(3),
    tenant: {
      id: r.tenant.id,
      firstName: r.tenant.firstName,
      lastName: r.tenant.lastName,
      fullNameArabic: r.tenant.fullNameArabic,
      phone: r.tenant.phone,
      whatsappNumber: r.tenant.whatsappNumber,
      email: r.tenant.email,
      nationality: r.tenant.nationality,
      classification: r.tenant.classification,
      tenantType: r.tenant.tenantType,
      corporateName: r.tenant.corporateName,
      corporateContact: r.tenant.corporateContact,
      idType: r.tenant.idType,
      idNumber: r.tenant.idNumber,
      specialRequests: r.tenant.specialRequests,
      internalNotes: r.tenant.internalNotes,
      totalStays: r.tenant.totalStays,
      totalSpent: r.tenant.totalSpent.toString(),
      idExpiryDate: r.tenant.idExpiryDate?.toISOString() ?? null,
      firstStayDate: r.tenant.firstStayDate?.toISOString() ?? null,
    },
    units,
    payments: r.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount).toFixed(3),
      date: p.date.toISOString(),
      method: p.method,
      reference: p.reference,
      notes: p.notes,
      invoiceNumber: p.invoice?.invoiceNumber ?? null,
    })),
    charges: r.charges.map((c) => ({
      id: c.id,
      description: c.description,
      amount: Number(c.amount).toFixed(3),
      category: c.category,
      createdAt: c.createdAt.toISOString(),
      createdByName: c.createdBy
        ? `${c.createdBy.firstName ?? ""} ${c.createdBy.lastName ?? ""}`.trim()
        : null,
    })),
    activities: r.activities.map((a) => ({
      id: a.id,
      action: a.action,
      description: a.description,
      performedByName: a.performedBy
        ? `${a.performedBy.firstName ?? ""} ${a.performedBy.lastName ?? ""}`.trim()
        : null,
      createdAt: a.createdAt.toISOString(),
      metadata: a.metadata,
    })),
    invoicesGenerated: r.invoicesGenerated,
    invoices: r.invoices.map((inv) => ({
      id:            inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceType:   inv.invoiceType,
      monthNumber:   inv.monthNumber,
      status:        inv.status,
      totalAmount:   Number(inv.totalAmount).toFixed(3),
      amountPaid:    Number(inv.amountPaid).toFixed(3),
      balanceDue:    Number(inv.balanceDue).toFixed(3),
      dueDate:       inv.dueDate.toISOString(),
      periodStart:   inv.periodStart.toISOString(),
      periodEnd:     inv.periodEnd.toISOString(),
    })),
    returns: r.returns.map((ret) => ({
      id:              ret.id,
      returnNumber:    ret.returnNumber,
      returnFrom:      ret.returnFrom.toISOString(),
      returnTo:        ret.returnTo.toISOString(),
      returnDays:      ret.returnDays,
      returnType:      ret.returnType,
      returnAmount:    Number(ret.returnAmount).toFixed(3),
      refundRequired:  ret.refundRequired,
      refundAmount:    Number(ret.refundAmount).toFixed(3),
      refundStatus:    ret.refundStatus,
      refundMethod:    ret.refundMethod,
      refundReference: ret.refundReference,
      refundDate:      ret.refundDate?.toISOString() ?? null,
      reason:          ret.reason,
      notes:           ret.notes,
      invoiceNumber:   ret.invoice?.invoiceNumber ?? null,
      createdAt:       ret.createdAt.toISOString(),
      createdByName:   ret.createdBy
        ? `${ret.createdBy.firstName ?? ""} ${ret.createdBy.lastName ?? ""}`.trim()
        : null,
      refundProcessedByName: ret.refundProcessedBy
        ? `${ret.refundProcessedBy.firstName ?? ""} ${ret.refundProcessedBy.lastName ?? ""}`.trim()
        : null,
      lineItems: ret.lineItems.map((li) => ({
        id:          li.id,
        description: li.description,
        quantity:    Number(li.quantity),
        unitPrice:   Number(li.unitPrice).toFixed(3),
        lineTotal:   Number(li.lineTotal).toFixed(3),
      })),
    })),
    contract: r.contract ? {
      id:           r.contract.id,
      status:       r.contract.status,
      signedAt:     r.contract.signedAt?.toISOString() ?? null,
      signedByName: r.contract.signedByName,
    } : null,
    createdByName: r.createdBy
      ? `${r.createdBy.firstName ?? ""} ${r.createdBy.lastName ?? ""}`.trim()
      : null,
    createdAt: r.createdAt.toISOString(),
  });
}

// ── PUT /api/reservations/[id] — edit a reservation (QA #30) ───────────────────
//
// Editing is only allowed BEFORE check-in and BEFORE invoices exist: stored
// status must be PENDING or CONFIRMED and invoicesGenerated must be false.
// Re-validates availability (excluding this reservation), recomputes pricing +
// segments via the shared helper, and replaces the reservation_units rows.
const EDITABLE_STATUSES = ["PENDING", "CONFIRMED"];

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.reservation.findUnique({
    where:  { id },
    select: { id: true, organizationId: true, status: true, invoicesGenerated: true },
  });
  if (!existing || existing.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });

  if (!EDITABLE_STATUSES.includes(existing.status))
    return NextResponse.json(
      { error: "not_editable", reason: "status", message: `A ${existing.status.toLowerCase()} reservation can't be edited.` },
      { status: 409 },
    );
  if (existing.invoicesGenerated)
    return NextResponse.json(
      { error: "not_editable", reason: "invoices", message: "This reservation has generated invoices. Cancel the invoices first, or cancel and rebook." },
      { status: 409 },
    );

  const body = await req.json();
  const {
    tenantId,
    unitIds,
    startDate: startStr,
    endDate:   endStr,
    rateType,
    source,
    notes,
    discountAmount: discountRaw = 0,
    unitOverrides = [] as { unitId: string; rateAmount: number }[],
  } = body;

  // ── Validation (mirrors POST) ─────────────────────────────────────────────
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

  const tenant = await prisma.tenant.findUnique({
    where:  { id: tenantId },
    select: { organizationId: true },
  });
  if (!tenant || tenant.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const unitRecords = await prisma.unit.findMany({
    where:   { id: { in: unitIds } },
    include: { property: { select: { organizationId: true } } },
  });
  if (unitRecords.length !== unitIds.length)
    return NextResponse.json({ error: "One or more units not found." }, { status: 404 });
  for (const u of unitRecords) {
    if (u.property.organizationId !== actor.organizationId)
      return NextResponse.json({ error: "Unauthorized access to unit." }, { status: 403 });
  }

  // Block monthly during seasons flagged disallowMonthly (QA #27).
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

  const unitPricings = await computeUnitPricings(unitIds, rt, startDate, endDate, unitOverrides);
  const totalNights  = calculateNights(startDate, endDate);
  const discount     = Math.max(0, Number(discountRaw) || 0);
  const grandResult  = calculateGrandTotal(unitPricings.map((u) => u.subtotal), discount);

  try {
    const updated = await prisma.$transaction(
      async (tx) => {
        // Re-check availability, excluding THIS reservation so its own units
        // don't count as conflicts.
        for (const unitId of unitIds) {
          const unitName = unitRecords.find((u) => u.id === unitId)?.name ?? unitId;
          const conflict = await getUnitConflict(tx, unitId, unitName, startDate, endDate, id);
          if (conflict) throw new Error(`CONFLICT:${JSON.stringify(conflict)}`);
        }

        const res = await tx.reservation.update({
          where: { id },
          data: {
            startDate,
            endDate,
            rateType:       rt,
            source:         source ?? "walk_in",
            notes:          notes ?? null,
            frequency:      rt === "monthly" ? "MONTHLY" : "DAILY",
            totalNights,
            amount:         grandResult.grandTotal,
            totalPrice:     grandResult.grandTotal,
            totalAmount:    grandResult.totalAmount,
            discountAmount: grandResult.discountAmount,
            taxAmount:      grandResult.taxAmount,
            grandTotal:     grandResult.grandTotal,
            tenantId,
            unitId: unitIds.length === 1 ? unitIds[0] : null,
          },
        });

        // Replace the reservation_units snapshot.
        await tx.reservationUnit.deleteMany({ where: { reservationId: id } });
        await tx.reservationUnit.createMany({
          data: unitPricings.map((up) => ({
            reservationId:     id,
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

        await tx.reservationActivity.create({
          data: {
            reservationId: id,
            organizationId: actor.organizationId!,
            // No generic "EDITED" action in the enum; DATES_CHANGED is the
            // closest fit for a full re-save (dates/units/rates).
            action: "DATES_CHANGED",
            description: `Reservation edited — ${startStr} → ${endStr}, ${unitIds.length} unit(s), total ${grandResult.grandTotal.toFixed(3)} OMR.`,
            performedById: actor.id,
            metadata: {
              startDate: startDate.toISOString(),
              endDate:   endDate.toISOString(),
              unitIds,
              rateType:  rt,
              grandTotal: grandResult.grandTotal,
            },
          },
        });

        return res;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json({ reservation: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("CONFLICT:")) {
      try {
        const conflict = JSON.parse(msg.replace("CONFLICT:", "")) as ConflictDetail;
        if (conflict) return NextResponse.json({ error: "double_booking", conflict }, { status: 409 });
      } catch { /* fall through */ }
      return NextResponse.json(
        { error: "Unit is no longer available for the selected dates." },
        { status: 409 },
      );
    }
    console.error("[PUT /api/reservations/[id]]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
