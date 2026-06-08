/**
 * Return Engine — handles early-departure returns for daily and monthly reservations.
 *
 * Currency: OMR (Omani Rial) — 3 decimal places.
 * Multi-tenancy: every operation is scoped to organizationId.
 *
 * Core rules:
 *  - DAILY: tenant leaves early → return the remaining nights at original rates
 *  - MONTHLY: only FUTURE billing periods (not yet started) can be returned;
 *    the current period is never prorated
 *  - Return automatically triggers checkout
 *  - Refund processing is a separate step (manager review)
 */

import { prisma } from "@/lib/prisma";
import { getUnitPriceForRange } from "@/lib/pricing";
import {
  roundOMR,
  calculateNights,
  collapseToSegments,
} from "@/lib/reservation-engine";
import {
  buildBillingCyclePeriods,
  getReservationUnitInfos,
  type UnitInfo,
} from "@/lib/invoice-engine";
import type { Prisma } from "@prisma/client";
import { RefundStatus, ReturnType, ReservationStatus } from "@prisma/client";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ReturnLineItemInput {
  unitId:      string | null;
  description: string;
  quantity:    number;   // nights or months
  unitPrice:   number;   // OMR
  lineTotal:   number;   // OMR
}

export interface ReturnPreview {
  returnFrom:        Date;
  returnTo:          Date;
  returnDays:        number;
  returnType:        "DAILY" | "MONTHLY";
  lineItems:         ReturnLineItemInput[];
  returnAmount:      number;
  affectedInvoices:  AffectedInvoice[];
  refundRequired:    boolean;
  refundAmount:      number;
  // For monthly: invoices that will be cancelled
  invoicesToCancel:  string[];   // invoice IDs
}

export interface AffectedInvoice {
  id:           string;
  invoiceNumber: string;
  status:        string;
  totalAmount:   number;
  amountPaid:    number;
  balanceDue:    number;
  periodStart:   Date;
  periodEnd:     Date;
  returnAmount:  number;   // how much of this invoice is returned
  refundNeeded:  number;   // how much cash goes back
}

// ── Number generator ──────────────────────────────────────────────────────────

export async function nextReturnNumber(
  orgId: string,
  tx: Prisma.TransactionClient,
): Promise<string> {
  const year   = new Date().getFullYear().toString();
  const prefix = `RET-${year}-`;

  const last = await tx.return.findFirst({
    where:   { organizationId: orgId, returnNumber: { startsWith: prefix } },
    orderBy: { returnNumber: "desc" },
    select:  { returnNumber: true },
  });

  let seq = 1;
  if (last?.returnNumber) {
    const parts = last.returnNumber.split("-");
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }
  return `${prefix}${String(seq).padStart(5, "0")}`;
}

// ── Helper: UTC midnight Date ─────────────────────────────────────────────────

function toDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + n);
  return next;
}

// ── Return settings (Settings → Returns) ────────────────────────────────────────

export interface ReturnSettings {
  draftPolicy:   "CANCEL" | "CREDIT";       // unissued monthly DRAFT cycles
  balancePolicy: "NET" | "GROSS";           // presentation only
  rateBasis:     "CHARGED" | "PRICE_LIST";  // rate for the returned period
}

async function getReturnSettings(orgId: string): Promise<ReturnSettings> {
  const org = await prisma.organization.findUnique({
    where:  { id: orgId },
    select: { returnDraftPolicy: true, returnBalancePolicy: true, returnRateBasis: true },
  });
  return {
    draftPolicy:   (org?.returnDraftPolicy   as ReturnSettings["draftPolicy"])   ?? "CANCEL",
    balancePolicy: (org?.returnBalancePolicy as ReturnSettings["balancePolicy"]) ?? "NET",
    rateBasis:     (org?.returnRateBasis     as ReturnSettings["rateBasis"])     ?? "CHARGED",
  };
}

/**
 * Build return line items for the returned tail of a DAILY stay from the rate the
 * guest was actually charged (persisted reservationUnit.pricingSegments — QA #28).
 * A night belongs to the returned portion when its date is >= the new checkout.
 * Falls back to the unit's stored rateAmount when no segments are persisted.
 */
function chargedDailyReturnLines(
  ui:        UnitInfo,
  newOut:    Date,
  returnDays: number,
): ReturnLineItemInput[] {
  const segments = ui.pricingSegments;
  if (segments && segments.length > 0) {
    const lines: ReturnLineItemInput[] = [];
    for (const seg of segments) {
      if (!seg.startDate) continue;
      const segStart = toDay(new Date(seg.startDate));
      let nights = 0;
      for (let i = 0; i < seg.nights; i++) {
        if (addDays(segStart, i) >= newOut) nights++;
      }
      if (nights > 0) {
        const rate      = seg.rateAmount;
        const lineTotal = roundOMR(rate * nights);
        lines.push({
          unitId:      ui.unitId,
          description: `Unit — ${nights} night(s) × ${rate.toFixed(3)} OMR${seg.seasonalPriceName ? ` (${seg.seasonalPriceName})` : ""}`,
          quantity:    nights,
          unitPrice:   rate,
          lineTotal,
        });
      }
    }
    if (lines.length > 0) return lines;
  }
  // Fallback: stored charged rate × returned nights
  const rate      = ui.rateAmount > 0 ? ui.rateAmount : 0;
  const lineTotal = roundOMR(rate * returnDays);
  return [{
    unitId:      ui.unitId,
    description: `Unit — ${returnDays} night(s) × ${rate.toFixed(3)} OMR`,
    quantity:    returnDays,
    unitPrice:   rate,
    lineTotal,
  }];
}

// ── Calculate daily return preview ────────────────────────────────────────────

export async function previewDailyReturn(params: {
  reservationId: string;
  orgId:         string;
  newCheckoutDate: Date;   // the new (earlier) checkout date
  /**
   * If provided, uses this nightly rate for every returned unit instead of
   * looking it up via the price tables. Powers the "override rate" UX in the
   * Return Days modal where the receptionist can charge a different rate for
   * the cancelled portion (e.g. waive the discount that originally applied).
   */
  rateOverride?: number;
}): Promise<ReturnPreview> {
  const { reservationId, orgId, newCheckoutDate, rateOverride } = params;

  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      tenant: { select: { organizationId: true } },
      reservationUnits: {
        where:   { isMovedOut: false },
        include: { unit: { include: { property: true } } },
      },
      unit: { include: { property: true } },
      invoices: {
        where:   { status: { notIn: ["CANCELLED", "VOID"] } },
        orderBy: { periodStart: "asc" },
      },
    },
  });

  if (!res || res.tenant.organizationId !== orgId)
    throw new Error("Reservation not found");

  const newOut   = toDay(newCheckoutDate);
  const origOut  = toDay(res.endDate);
  const checkIn  = toDay(res.startDate);
  const today    = toDay(new Date());

  if (newOut >= origOut)
    throw new Error("New checkout must be before the current checkout date");
  if (newOut <= checkIn)
    throw new Error("New checkout must be after check-in date");
  if (newOut < today)
    throw new Error("New checkout cannot be in the past");

  // Days being returned = newOut..origOut (exclusive end → origOut - newOut days)
  const returnDays = calculateNights(newOut, origOut);
  if (returnDays <= 0) throw new Error("No days to return");

  const unitInfos = getReservationUnitInfos(res as Parameters<typeof getReservationUnitInfos>[0]);
  const settings  = await getReturnSettings(orgId);

  // Calculate return amount. Default basis = CHARGED (the rate the guest was
  // actually charged, from persisted segments). PRICE_LIST re-prices from the
  // current price tables. A manual rateOverride always wins.
  const lineItems: ReturnLineItemInput[] = [];
  let returnAmount = 0;

  for (const ui of unitInfos) {
    if (rateOverride !== undefined && rateOverride >= 0) {
      // Manual override path: a single line item at the chosen nightly rate.
      const lineTotal = roundOMR(rateOverride * returnDays);
      returnAmount    = roundOMR(returnAmount + lineTotal);
      lineItems.push({
        unitId:      ui.unitId,
        description: `Unit — ${returnDays} night(s) × ${rateOverride.toFixed(3)} OMR (manual rate)`,
        quantity:    returnDays,
        unitPrice:   rateOverride,
        lineTotal,
      });
      continue;
    }

    if (settings.rateBasis === "CHARGED") {
      const lines = chargedDailyReturnLines(ui, newOut, returnDays);
      for (const line of lines) {
        returnAmount = roundOMR(returnAmount + line.lineTotal);
        lineItems.push(line);
      }
      continue;
    }

    // PRICE_LIST: re-price the returned segment from the current price tables.
    const pricing  = await getUnitPriceForRange(ui.unitId, newOut, origOut);
    const segments = collapseToSegments(pricing.dailyBreakdown);

    if (segments.length > 0 && segments.reduce((s, seg) => s + seg.subtotal, 0) > 0) {
      for (const seg of segments) {
        const lineTotal = roundOMR(seg.subtotal);
        returnAmount    = roundOMR(returnAmount + lineTotal);
        lineItems.push({
          unitId:      ui.unitId,
          description: `Unit — ${seg.nights} night(s) × ${seg.ratePerNight.toFixed(3)} OMR${seg.priceName ? ` (${seg.priceName})` : ""}`,
          quantity:    seg.nights,
          unitPrice:   seg.ratePerNight,
          lineTotal,
        });
      }
    } else {
      // Fallback to stored rate
      const rate      = ui.rateAmount > 0 ? ui.rateAmount : 0;
      const lineTotal = roundOMR(rate * returnDays);
      returnAmount    = roundOMR(returnAmount + lineTotal);
      lineItems.push({
        unitId:      ui.unitId,
        description: `Unit — ${returnDays} night(s) × ${rate.toFixed(3)} OMR`,
        quantity:    returnDays,
        unitPrice:   rate,
        lineTotal,
      });
    }
  }

  // Find the invoice that covers the returned period (SHORT_TERM invoice for daily)
  const invoice = res.invoices.find((inv) =>
    inv.invoiceType === "SHORT_TERM" || inv.invoiceType === "OVERSTAY"
  ) ?? res.invoices[0];

  const affectedInvoices: AffectedInvoice[] = [];
  let refundRequired = false;
  let refundAmount   = 0;

  if (invoice) {
    const paid     = roundOMR(Number(invoice.amountPaid));
    const total    = roundOMR(Number(invoice.totalAmount));
    const credited = roundOMR(Number(invoice.creditedAmount));
    // Effective charge once THIS return's credit is also applied. Must subtract
    // credits already applied by prior returns, else a second return on an
    // already-paid invoice under-detects the refund.
    const newEffective = roundOMR(total - credited - returnAmount);

    // Refund needed when cash paid now exceeds the remaining effective charge.
    const refundNeeded = roundOMR(Math.max(0, paid - newEffective));
    if (refundNeeded > 0) {
      refundRequired = true;
      refundAmount   = refundNeeded;
    }

    affectedInvoices.push({
      id:            invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status:        invoice.status,
      totalAmount:   total,
      amountPaid:    paid,
      balanceDue:    roundOMR(Number(invoice.balanceDue)),
      periodStart:   invoice.periodStart,
      periodEnd:     invoice.periodEnd,
      returnAmount,
      refundNeeded,
    });
  }

  return {
    returnFrom:       newOut,
    returnTo:         origOut,
    returnDays,
    returnType:       "DAILY",
    lineItems,
    returnAmount,
    affectedInvoices,
    refundRequired,
    refundAmount,
    invoicesToCancel: [],
  };
}

// ── Calculate monthly return preview ─────────────────────────────────────────

export async function previewMonthlyReturn(params: {
  reservationId:   string;
  orgId:           string;
  newCheckoutDate: Date;
}): Promise<ReturnPreview> {
  const { reservationId, orgId, newCheckoutDate } = params;

  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      tenant: { select: { organizationId: true } },
      reservationUnits: {
        where:   { isMovedOut: false },
        include: { unit: { include: { property: true } } },
      },
      unit: { include: { property: true } },
      invoices: {
        where:   { status: { notIn: ["CANCELLED", "VOID"] } },
        orderBy: { periodStart: "asc" },
      },
    },
  });

  if (!res || res.tenant.organizationId !== orgId)
    throw new Error("Reservation not found");

  const newOut  = toDay(newCheckoutDate);
  const origOut = toDay(res.endDate);
  const checkIn = toDay(res.startDate);
  const today   = toDay(new Date());

  if (newOut >= origOut)
    throw new Error("New checkout must be before the current checkout date");
  if (newOut <= checkIn)
    throw new Error("New checkout must be after check-in date");

  // Build all billing periods
  const periods = buildBillingCyclePeriods(res.startDate, res.endDate);

  // Find the current period (today falls within it)
  const currentPeriod = periods.find(
    (p) => toDay(p.periodStart) <= today && today <= toDay(p.periodEnd)
  );

  // Business rule: current period is NOT returnable.
  // Earliest new checkout = start of NEXT period after current.
  const currentPeriodEnd = currentPeriod ? toDay(currentPeriod.periodEnd) : today;
  const earliestCheckout = addOneDay(currentPeriodEnd);

  if (newOut <= currentPeriodEnd) {
    const earliestStr = earliestCheckout.toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
    throw new Error(
      `The current billing period cannot be returned. ` +
      `The earliest checkout date is ${earliestStr}.`
    );
  }

  // Periods that will be returned = those whose periodStart >= newOut
  const periodsToReturn = periods.filter(
    (p) => toDay(p.periodStart) >= newOut
  );

  if (periodsToReturn.length === 0)
    throw new Error("No future billing periods to return");

  const unitInfos = getReservationUnitInfos(res as Parameters<typeof getReservationUnitInfos>[0]);
  const settings  = await getReturnSettings(orgId);

  // Map invoices to periods by periodStart date
  const invoiceByPeriodStart = new Map<string, typeof res.invoices[0]>();
  for (const inv of res.invoices) {
    const key = toDay(inv.periodStart).toISOString();
    invoiceByPeriodStart.set(key, inv);
  }

  const lineItems:         ReturnLineItemInput[] = [];
  const affectedInvoices:  AffectedInvoice[]     = [];
  const invoicesToCancel:  string[]              = [];
  let returnAmount  = 0;
  let refundAmount  = 0;
  let refundRequired = false;

  for (const period of periodsToReturn) {
    const periodKey = toDay(period.periodStart).toISOString();
    const invoice   = invoiceByPeriodStart.get(periodKey);

    // Calculate period return amount using stored rates
    for (const ui of unitInfos) {
      const monthlyRate = ui.rateAmount;
      const periodTotal = roundOMR(monthlyRate);  // full month rate

      returnAmount = roundOMR(returnAmount + periodTotal);

      lineItems.push({
        unitId:      ui.unitId,
        description: `Unit — Month ${period.monthNumber} (${fmtDateShort(period.periodStart)} – ${fmtDateShort(period.periodEnd)}) × ${monthlyRate.toFixed(3)} OMR`,
        quantity:    1,
        unitPrice:   monthlyRate,
        lineTotal:   periodTotal,
      });
    }

    if (invoice) {
      const paid     = roundOMR(Number(invoice.amountPaid));
      const total    = roundOMR(Number(invoice.totalAmount));
      // Full period being returned → entire invoice is cancelled/returned
      const refundNeeded = paid; // If paid, all of it comes back

      if (refundNeeded > 0) {
        refundRequired = true;
        refundAmount   = roundOMR(refundAmount + refundNeeded);
      }

      // Only unissued DRAFT cycles are cancelled, and only under the CANCEL
      // policy. Everything else (issued PENDING/PARTIALLY_PAID/PAID, or DRAFT
      // under CREDIT) gets a return credit applied instead — invoice untouched.
      if (invoice.status === "DRAFT" && settings.draftPolicy === "CANCEL") {
        invoicesToCancel.push(invoice.id);
      }

      affectedInvoices.push({
        id:            invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status:        invoice.status,
        totalAmount:   total,
        amountPaid:    paid,
        balanceDue:    roundOMR(Number(invoice.balanceDue)),
        periodStart:   invoice.periodStart,
        periodEnd:     invoice.periodEnd,
        returnAmount:  total,
        refundNeeded,
      });
    }
  }

  return {
    returnFrom:      newOut,
    returnTo:        origOut,
    returnDays:      periodsToReturn.length,  // months
    returnType:      "MONTHLY",
    lineItems,
    returnAmount,
    affectedInvoices,
    refundRequired,
    refundAmount,
    invoicesToCancel,
  };
}

// ── Execute daily return (transaction) ────────────────────────────────────────

export async function executeDailyReturn(params: {
  reservationId:   string;
  orgId:           string;
  userId:          string;
  newCheckoutDate: Date;
  reason:          string;
  notes?:          string;
  rateOverride?:   number;
}) {
  const { reservationId, orgId, userId, newCheckoutDate, reason, notes, rateOverride } = params;
  const preview = await previewDailyReturn({ reservationId, orgId, newCheckoutDate, rateOverride });

  return prisma.$transaction(async (tx) => {
    const ret = await _createReturnRecord(tx, {
      reservationId,
      orgId,
      userId,
      preview,
      reason,
      notes,
    });

    // Credit-note model: never change the invoice total or line items. Apply the
    // full returned value as a credit against the invoice (reduces effective
    // charge). Any portion already paid surfaces as an over-payment and is
    // returned via the separate refund step.
    if (preview.affectedInvoices.length > 0) {
      const inv = preview.affectedInvoices[0];
      await applyReturnCredit(tx, inv.id, roundOMR(preview.returnAmount), ret.returnNumber);
    }

    // Get unit IDs
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: {
        reservationUnits: { select: { unitId: true } },
      },
    });
    const unitIds = [
      ...(reservation?.unitId ? [reservation.unitId] : []),
      ...(reservation?.reservationUnits.map((ru) => ru.unitId) ?? []),
    ];

    const now      = new Date();
    const today    = toDay(now);
    const newOut   = toDay(newCheckoutDate);
    // Only auto-checkout if the new checkout date is today or in the past.
    // For a future return (e.g. tenant returns the last month early but is
    // still in the unit), keep the reservation CHECKED_IN and let the
    // natural check-out happen on the new endDate.
    const checkoutNow = newOut <= today;

    await tx.reservation.update({
      where: { id: reservationId },
      data: {
        endDate:        newCheckoutDate,
        ...(checkoutNow && {
          actualCheckOut: now,
          status:         ReservationStatus.COMPLETED,
        }),
        totalNights: calculateNights(
          toDay(reservation!.startDate),
          toDay(newCheckoutDate)
        ),
      },
    });

    // Mark units vacant only when the guest is actually leaving today.
    if (checkoutNow && unitIds.length > 0) {
      await tx.unit.updateMany({
        where: { id: { in: unitIds } },
        data:  { status: "AVAILABLE" },
      });
    }

    // Activity log
    await tx.reservationActivity.create({
      data: {
        reservationId,
        organizationId: orgId,
        action:         "RETURN_PROCESSED",
        description:    `Return processed: ${preview.returnDays} night(s) returned. ` +
                        `Return amount: ${preview.returnAmount.toFixed(3)} OMR. ` +
                        `Refund: ${preview.refundRequired ? `${preview.refundAmount.toFixed(3)} OMR required` : "not required"}. ` +
                        (checkoutNow
                          ? `Checked out automatically.`
                          : `Stay continues until new checkout (${newCheckoutDate.toISOString().slice(0, 10)}).`),
        performedById:  userId,
        metadata: {
          returnId:      ret.id,
          returnNumber:  ret.returnNumber,
          returnAmount:  preview.returnAmount,
          refundRequired: preview.refundRequired,
          refundAmount:  preview.refundAmount,
          autoCheckedOut: checkoutNow,
        },
      },
    });

    return ret;
  });
}

// ── Execute monthly return (transaction) ──────────────────────────────────────

export async function executeMonthlyReturn(params: {
  reservationId:   string;
  orgId:           string;
  userId:          string;
  newCheckoutDate: Date;
  reason:          string;
  notes?:          string;
}) {
  const { reservationId, orgId, userId, newCheckoutDate, reason, notes } = params;
  const preview = await previewMonthlyReturn({ reservationId, orgId, newCheckoutDate });

  return prisma.$transaction(async (tx) => {
    const ret = await _createReturnRecord(tx, {
      reservationId,
      orgId,
      userId,
      preview,
      reason,
      notes,
    });

    // Unissued DRAFT cycles (CANCEL policy) → cancel outright. Every other
    // affected invoice gets a return credit applied (total/line items untouched);
    // already-paid amounts become a refund tracked on the return.
    const cancelSet = new Set(preview.invoicesToCancel);
    for (const invoiceId of preview.invoicesToCancel) {
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status:         "CANCELLED",
          cancelledAt:    new Date(),
          cancelledReason: `Cancelled — early departure, return ${ret.returnNumber}`,
        },
      });
    }
    for (const ai of preview.affectedInvoices) {
      if (cancelSet.has(ai.id)) continue;
      await applyReturnCredit(tx, ai.id, roundOMR(ai.returnAmount), ret.returnNumber);
    }

    // Get unit IDs
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: { reservationUnits: { select: { unitId: true } } },
    });
    const unitIds = [
      ...(reservation?.unitId ? [reservation.unitId] : []),
      ...(reservation?.reservationUnits.map((ru) => ru.unitId) ?? []),
    ];

    const now      = new Date();
    const today    = toDay(now);
    const newOut   = toDay(newCheckoutDate);
    // Same rule as the daily path: auto-checkout only if the new departure
    // is today or earlier. A 3-month tenant returning the last month while
    // still in May should stay CHECKED_IN; the cancelled future invoices
    // and the new endDate are enough to reflect the change.
    const checkoutNow = newOut <= today;

    await tx.reservation.update({
      where: { id: reservationId },
      data: {
        endDate:        newCheckoutDate,
        ...(checkoutNow && {
          actualCheckOut: now,
          status:         ReservationStatus.COMPLETED,
        }),
        totalNights: calculateNights(
          toDay(reservation!.startDate),
          toDay(newCheckoutDate)
        ),
      },
    });

    if (checkoutNow && unitIds.length > 0) {
      await tx.unit.updateMany({
        where: { id: { in: unitIds } },
        data:  { status: "AVAILABLE" },
      });
    }

    // Activity log
    await tx.reservationActivity.create({
      data: {
        reservationId,
        organizationId: orgId,
        action:         "RETURN_PROCESSED",
        description:    `Return processed: ${preview.returnDays} month(s) returned. ` +
                        `Return amount: ${preview.returnAmount.toFixed(3)} OMR. ` +
                        `Refund: ${preview.refundRequired ? `${preview.refundAmount.toFixed(3)} OMR required` : "not required"}. ` +
                        (checkoutNow
                          ? `Checked out automatically.`
                          : `Stay continues until new checkout (${newCheckoutDate.toISOString().slice(0, 10)}).`),
        performedById:  userId,
        metadata: {
          returnId:       ret.id,
          returnNumber:   ret.returnNumber,
          returnAmount:   preview.returnAmount,
          refundRequired: preview.refundRequired,
          refundAmount:   preview.refundAmount,
          autoCheckedOut: checkoutNow,
          cancelledInvoices: preview.invoicesToCancel.length,
        },
      },
    });

    return ret;
  });
}

// ── Process refund ─────────────────────────────────────────────────────────────

export async function processRefund(params: {
  returnId:   string;
  orgId:      string;
  userId:     string;
  amount:     number;
  method:     string;
  reference?: string;
  notes?:     string;
}) {
  const { returnId, orgId, userId, amount, method, reference, notes } = params;

  const ret = await prisma.return.findUnique({
    where: { id: returnId },
    include: {
      reservation: { select: { id: true, tenantId: true } },
      tenant:      { select: { id: true, organizationId: true } },
    },
  });

  if (!ret || ret.organizationId !== orgId)
    throw new Error("Return not found");
  if (ret.refundStatus === "COMPLETED")
    throw new Error("Refund already processed");
  if (!ret.refundRequired)
    throw new Error("No refund required for this return");

  return prisma.$transaction(async (tx) => {
    const now = new Date();

    // Update return record
    const updated = await tx.return.update({
      where: { id: returnId },
      data: {
        refundStatus:           RefundStatus.COMPLETED,
        refundAmount:           amount,
        refundMethod:           method,
        refundReference:        reference ?? null,
        refundDate:             now,
        refundProcessedById:    userId,
      },
    });

    // Create a refund payment (negative entry in ledger)
    const tenantId     = ret.tenant.id;
    const reservationId = ret.reservation?.id;

    await tx.payment.create({
      data: {
        tenantId,
        reservationId: reservationId ?? null,
        organizationId: orgId,
        amount,
        method:       method as any,
        reference:    reference ?? null,
        notes:        notes ?? `Refund for return ${ret.returnNumber}`,
        isRefund:     true,
        receivedById: userId,
        date:         now,
      },
    });

    // Activity log on reservation
    if (reservationId) {
      await tx.reservationActivity.create({
        data: {
          reservationId,
          organizationId: orgId,
          action:         "REFUND_PROCESSED",
          description:    `Refund of ${amount.toFixed(3)} OMR processed via ${method} for return ${ret.returnNumber}`,
          performedById:  userId,
          metadata: { returnId, amount, method, reference },
        },
      });
    }

    return updated;
  });
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Apply a return credit to an invoice WITHOUT changing its total or line items
 * (credit-note model). balanceDue = total − paid − credited (net, clamped ≥ 0);
 * status re-derived (DRAFT stays DRAFT; PAID when fully settled by cash+credit).
 */
async function applyReturnCredit(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  creditAmount: number,
  returnNumber: string,
) {
  if (creditAmount <= 0) return;
  const invoice = await tx.invoice.findUnique({
    where:  { id: invoiceId },
    select: { status: true, totalAmount: true, amountPaid: true, creditedAmount: true, notes: true },
  });
  if (!invoice || invoice.status === "CANCELLED" || invoice.status === "VOID") return;

  const total       = roundOMR(Number(invoice.totalAmount));
  const paid        = roundOMR(Number(invoice.amountPaid));
  const credited    = roundOMR(Number(invoice.creditedAmount) + creditAmount);
  const balanceDue  = roundOMR(Math.max(0, total - paid - credited));

  let status = invoice.status;
  if (status !== "DRAFT") {
    // Fully settled (cash + credit) → PAID. Otherwise PARTIALLY_PAID only when
    // real cash was paid; a credit-only invoice stays PENDING.
    status = balanceDue <= 0 ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "PENDING";
  }

  const creditNote = `Credited by return ${returnNumber}: ${creditAmount.toFixed(3)} OMR`;
  await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      creditedAmount: credited,
      balanceDue,
      status,
      notes: invoice.notes ? `${invoice.notes}\n${creditNote}` : creditNote,
    },
  });
}

async function _createReturnRecord(
  tx: Prisma.TransactionClient,
  params: {
    reservationId: string;
    orgId:         string;
    userId:        string;
    preview:       ReturnPreview;
    reason:        string;
    notes?:        string;
  }
) {
  const { reservationId, orgId, userId, preview, reason, notes } = params;

  // Resolve tenantId
  const res = await tx.reservation.findUnique({
    where:  { id: reservationId },
    select: { tenantId: true },
  });
  if (!res) throw new Error("Reservation not found");

  const returnNumber = await nextReturnNumber(orgId, tx);
  const invoiceId    = preview.affectedInvoices[0]?.id ?? null;

  const ret = await tx.return.create({
    data: {
      returnNumber,
      organizationId: orgId,
      reservationId,
      tenantId:       res.tenantId,
      invoiceId,
      returnFrom:     preview.returnFrom,
      returnTo:       preview.returnTo,
      returnDays:     preview.returnDays,
      returnType:     preview.returnType as ReturnType,
      returnAmount:   preview.returnAmount,
      refundRequired: preview.refundRequired,
      refundAmount:   preview.refundAmount,
      refundStatus:   preview.refundRequired
                        ? RefundStatus.PENDING
                        : RefundStatus.NOT_REQUIRED,
      reason,
      notes:          notes ?? null,
      status:         "active",
      createdById:    userId,
      lineItems: {
        create: preview.lineItems.map((li) => ({
          organizationId: orgId,
          unitId:         li.unitId ?? null,
          description:    li.description,
          quantity:       li.quantity,
          unitPrice:      li.unitPrice,
          lineTotal:      li.lineTotal,
        })),
      },
    },
    include: { lineItems: true },
  });

  return ret;
}

function addOneDay(d: Date): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function fmtDateShort(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
