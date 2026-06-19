/**
 * Invoice Engine — invoice generation and payment processing for PMS SaaS.
 *
 * Currency: OMR (Omani Rial) — 3 decimal places (1 OMR = 1000 baisa).
 * All monetary arithmetic uses integer baisa rounding to avoid float drift.
 *
 * Multi-tenancy: every operation is scoped to an organizationId. Queries
 * that cross tenant boundaries will throw.
 *
 * Reservation units: supports both the legacy `unitId` FK on Reservation
 * and the newer `reservationUnits` junction table. Both are handled
 * transparently via getReservationUnitInfos().
 *
 * Key design decisions:
 *  - Short-term (≤30 nights, daily rate): ONE invoice covers the whole stay.
 *  - Monthly (monthly rate OR >30 nights): one invoice per calendar month,
 *    generated on demand / via cron (5 days ahead).
 *  - All invoice generation runs inside $transaction to guarantee sequential
 *    invoice numbers without gaps.
 */

import { prisma } from "@/lib/prisma";
import { getUnitPriceForRange } from "@/lib/pricing";
import { methodNeedsBank, methodRequiresBank } from "@/lib/banks";
import { postBankTxn } from "@/lib/bank-ledger";
import {
  collapseToSegments,
  calculateNights,
  roundOMR,
  toDateString,
  type PriceSegment,
} from "@/lib/reservation-engine";
import type { Prisma } from "@prisma/client";
import { InvoiceStatus, InvoiceType, LineItemCategory, RateType, RateSource } from "@prisma/client";

// ── Re-export so callers can import everything from one place ─────────────────

export type { PriceSegment };

// ── Local types ───────────────────────────────────────────────────────────────

export interface CalendarMonthPeriod {
  monthNumber:  number;   // 1-indexed
  periodStart:  Date;     // inclusive
  periodEnd:    Date;     // inclusive (last day of billing period)
  days:         number;   // calendar days covered
  isFullMonth:  boolean;  // true only if 1st of month → last day of month
}

/** Persisted per-segment snapshot from booking time (QA #28). */
export interface PersistedSegment {
  label?:             string | null;
  startDate?:         string | null;
  endDate?:           string | null;
  nights:             number;
  rateAmount:         number;
  rateSource:         string;
  seasonalPriceName:  string | null;
  subtotal:           number;
}

export interface UnitInfo {
  unitId:             string;
  rateType:           string;       // "daily" | "monthly"
  rateAmount:         number;       // OMR
  rateSource:         string;       // "default_price" | "seasonal_price" | "manual_override"
  seasonalPriceName:  string | null;
  propertyId:         string | null;
  nights?:            number;       // persisted at booking
  subtotal?:          number;       // persisted at booking
  pricingSegments?:   PersistedSegment[] | null; // persisted snapshot (QA #28)
}

export interface GenerateInvoicesResult {
  invoices:      Awaited<ReturnType<typeof prisma.invoice.findFirst>>[];
  totalExpected: number;
}

export interface RecordPaymentParams {
  tenantId:           string;
  amount:             number;
  method:             string;       // PaymentMethod enum value
  reference?:         string;
  notes?:             string;
  orgId:              string;
  userId:             string;
  receivedById?:      string;
  reservationId?:     string;
  bankAccountId?:     string | null; // which bank a non-cash payment settles into
  invoiceAllocations?: { invoiceId: string; amount: number }[];
}

export interface RecordPaymentResult {
  payment:     Awaited<ReturnType<typeof prisma.payment.create>>;
  allocations: Awaited<ReturnType<typeof prisma.paymentAllocation.create>>[];
  overpayment: number;
}

export interface EarlyCheckoutResult {
  updatedInvoice: Awaited<ReturnType<typeof prisma.invoice.findFirst>>;
  cancelledCount: number;
  creditAmount:   number;
}

export interface TenantFinancialSummary {
  totalCharged:       number;
  totalPaid:          number;
  totalRefunded:      number;
  currentBalance:     number;
  invoices: {
    total:      number;
    paid:       number;
    outstanding: number;
    overdue:    number;
    cancelled:  number;
  };
  outstandingInvoices: Awaited<ReturnType<typeof prisma.invoice.findMany>>;
  recentPayments:      Awaited<ReturnType<typeof prisma.payment.findMany>>;
}

export interface PendingMonthlyResult {
  generated: number;
  details:   { reservationId: string; invoiceId: string; monthNumber: number }[];
}

// ── Prisma status/type constants ──────────────────────────────────────────────

const ACTIVE_INVOICE_STATUSES = [
  "PENDING",
  "PARTIALLY_PAID",
  "PARTIAL",
  "DUE",
  // legacy values kept for backward compat
  "ISSUED",
  "DRAFT",
] as const;

const PAID_INVOICE_STATUSES = ["PAID"] as const;

const CANCELLED_STATUSES = ["CANCELLED", "VOID"] as const;

// ── OMR helper (re-exported alias keeps callers DRY) ──────────────────────────

/** Round a number to 3 decimal places (baisa precision). */
export const omr = roundOMR;

// ── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Return midnight UTC for any Date.
 * Normalises time components so date comparisons are unambiguous.
 */
export function toDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

/**
 * Return the last calendar day of the month that contains `date`.
 * e.g. toDay("2026-03-15") → 2026-03-31
 */
export function endOfMonth(date: Date): Date {
  // First day of next month minus one day
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth() + 1, 0),
  );
}

/** First day of the month that contains `date`. */
function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1));
}

/** Add `n` whole calendar days to a Date. */
function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

/** Days between two midnight Dates (b - a in whole days). */
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// ── Sequential number helpers ─────────────────────────────────────────────────

/**
 * Generate the next sequential invoice number for an organisation within the
 * current calendar year.  Format: "INV-YYYY-NNNNN" (zero-padded to 5 digits).
 *
 * MUST be called inside a Prisma $transaction to avoid race conditions.
 */
export async function nextInvoiceNumber(
  orgId: string,
  tx: Prisma.TransactionClient,
): Promise<string> {
  const year = new Date().getFullYear().toString();
  const prefix = `INV-${year}-`;

  const last = await tx.invoice.findFirst({
    where: {
      organizationId: orgId,
      invoiceNumber: { startsWith: prefix },
    },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  let seq = 1;
  if (last?.invoiceNumber) {
    const parts = last.invoiceNumber.split("-");
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }

  return `${prefix}${String(seq).padStart(5, "0")}`;
}

/**
 * Generate the next sequential payment number for an organisation within the
 * current calendar year.  Format: "PAY-YYYY-NNNNN".
 *
 * MUST be called inside a Prisma $transaction.
 */
export async function nextPaymentNumber(
  orgId: string,
  tx: Prisma.TransactionClient,
): Promise<string> {
  const year = new Date().getFullYear().toString();
  const prefix = `PAY-${year}-`;

  const last = await tx.payment.findFirst({
    where: {
      organizationId: orgId,
      paymentNumber: { startsWith: prefix },
    },
    orderBy: { paymentNumber: "desc" },
    select: { paymentNumber: true },
  });

  let seq = 1;
  if (last?.paymentNumber) {
    const parts = last.paymentNumber.split("-");
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }

  return `${prefix}${String(seq).padStart(5, "0")}`;
}

// ── Billing cycle period builder ──────────────────────────────────────────────

/**
 * Add N whole months to a UTC Date.
 * Handles end-of-month overflow (e.g. Jan 31 + 1 month = Feb 28).
 */
function addUTCMonths(date: Date, n: number): Date {
  const d = new Date(date);
  const originalDay = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + n);
  // If the day overflowed (e.g. Jan 31 → Mar 3), snap back to last day of target month
  if (d.getUTCDate() !== originalDay) {
    d.setUTCDate(0); // last day of the previous (correct) month
  }
  return d;
}

/**
 * Decompose a reservation stay into billing cycles that follow the check-in day.
 *
 * Rules (per CLAUDE.md: "Billing cycle follows check-in day"):
 *  - Cycle 1 : checkIn        → (checkIn + 1 month - 1 day)   e.g. Apr 10 → May 9
 *  - Cycle 2 : checkIn+1mo    → (checkIn + 2 months - 1 day)  e.g. May 10 → Jun 9
 *  - Last     : truncated at (checkOut - 1 day) if checkOut falls mid-cycle
 *
 * isFullMonth = the natural cycle end date (checkIn+Nmo-1) does NOT exceed checkOut-1,
 * meaning the tenant stays through the entire billing cycle.
 * Full months are charged the flat monthly rate; partial months are pro-rated.
 *
 * @param checkIn  - first night of stay (inclusive)
 * @param checkOut - departure day (exclusive — the morning the guest leaves)
 */
export function buildBillingCyclePeriods(
  checkIn: Date,
  checkOut: Date,
): CalendarMonthPeriod[] {
  const start = toDay(checkIn);
  const end   = toDay(checkOut); // exclusive

  if (end <= start) return [];

  const periods: CalendarMonthPeriod[] = [];
  let monthNumber = 1;
  let periodStart = start;

  while (periodStart < end) {
    // Next billing date = same day N months from check-in
    const nextBilling = addUTCMonths(start, monthNumber); // checkIn + N months

    // The natural end of this cycle (day before next billing date)
    const naturalEnd = addDays(nextBilling, -1);

    // Actual period end: natural end OR day before checkOut, whichever is earlier
    const periodEnd = naturalEnd < end ? naturalEnd : addDays(end, -1);

    if (periodEnd < periodStart) break;

    const days       = daysBetween(periodStart, periodEnd) + 1; // inclusive count
    const isFullMonth = naturalEnd < end; // full cycle fits within stay

    periods.push({
      monthNumber,
      periodStart,
      periodEnd,
      days,
      isFullMonth,
    });

    periodStart = nextBilling; // advance to start of next cycle
    monthNumber++;
  }

  return periods;
}

/**
 * @deprecated Use buildBillingCyclePeriods instead.
 * Kept as alias so external callers (reports, etc.) don't break.
 */
export const buildCalendarMonthPeriods = buildBillingCyclePeriods;

// ── Unit info extraction ──────────────────────────────────────────────────────

/**
 * Return a normalised list of units for a reservation, supporting both the
 * legacy single-unit (unitId FK) and multi-unit (reservationUnits) patterns.
 *
 * Units marked isMovedOut=true in the junction table are excluded.
 */
export function getReservationUnitInfos(reservation: {
  unitId?:            string | null;
  unit?: {
    id:       string;
    basePrice?: number | null;
    property?: { id: string } | null;
  } | null;
  reservationUnits?: {
    unitId:             string;
    rateType:           string;
    rateAmount:         number | { toNumber(): number };
    rateSource:         string;
    seasonalPriceName?: string | null;
    nights?:            number;
    subtotal?:          number | { toNumber(): number };
    pricingSegments?:   unknown;
    isMovedOut?:        boolean;
    unit?: {
      id:       string;
      property?: { id: string } | null;
    } | null;
  }[];
}): UnitInfo[] {
  const infos: UnitInfo[] = [];
  const num = (v: number | { toNumber(): number } | undefined): number | undefined =>
    v == null ? undefined : (typeof v === "object" ? v.toNumber() : v);

  // --- New junction table pattern ---
  if (
    reservation.reservationUnits &&
    reservation.reservationUnits.length > 0
  ) {
    for (const ru of reservation.reservationUnits) {
      if (ru.isMovedOut) continue;
      infos.push({
        unitId:            ru.unitId,
        rateType:          ru.rateType,
        rateAmount:        typeof ru.rateAmount === "object"
                            ? ru.rateAmount.toNumber()
                            : (ru.rateAmount as number),
        rateSource:        ru.rateSource,
        seasonalPriceName: ru.seasonalPriceName ?? null,
        propertyId:        ru.unit?.property?.id ?? null,
        nights:            ru.nights,
        subtotal:          num(ru.subtotal),
        pricingSegments:   Array.isArray(ru.pricingSegments)
                            ? (ru.pricingSegments as PersistedSegment[])
                            : null,
      });
    }
    return infos;
  }

  // --- Legacy single unitId FK ---
  if (reservation.unitId && reservation.unit) {
    infos.push({
      unitId:            reservation.unitId,
      rateType:          "daily",
      rateAmount:        typeof reservation.unit.basePrice === "number"
                          ? reservation.unit.basePrice
                          : 0,
      rateSource:        "default_price",
      seasonalPriceName: null,
      propertyId:        reservation.unit.property?.id ?? null,
    });
  }

  return infos;
}

// ── Map rateSource string → Prisma RateSource enum value ─────────────────────

function mapRateSource(src: string): "DEFAULT_PRICE" | "SEASONAL_PRICE" | "MANUAL_OVERRIDE" {
  const s = src.toLowerCase();
  if (s === "seasonal_price" || s === "seasonal") return "SEASONAL_PRICE";
  if (s === "manual_override" || s === "manual") return "MANUAL_OVERRIDE";
  return "DEFAULT_PRICE";
}

function mapPriceTypeToSource(priceType: "DEFAULT" | "SEASONAL"): "DEFAULT_PRICE" | "SEASONAL_PRICE" {
  return priceType === "SEASONAL" ? "SEASONAL_PRICE" : "DEFAULT_PRICE";
}

// ── Invoice status derivation ─────────────────────────────────────────────────

/**
 * Derive the correct InvoiceStatus given payment amounts.
 * Returns Prisma enum string values.
 */
function deriveInvoiceStatus(
  totalAmount: number,
  amountPaid: number,
  existingStatus: string,
  creditedAmount = 0,
): InvoiceStatus {
  // Never un-cancel an invoice
  if (existingStatus === "CANCELLED" || existingStatus === "VOID") {
    return existingStatus as InvoiceStatus;
  }
  // A DRAFT is not auto-promoted by payments or return credits — it stays DRAFT
  // until explicitly issued (revenue posts on issue).
  if (existingStatus === "DRAFT") return InvoiceStatus.DRAFT;
  // Net owed after cash paid + return credits. Fully settled → PAID. Otherwise
  // PARTIALLY_PAID only when actual cash was paid (a credit-only invoice with no
  // payment stays PENDING — "Partially Paid" would imply money changed hands).
  if (roundOMR(totalAmount - amountPaid - creditedAmount) <= 0) return InvoiceStatus.PAID;
  return amountPaid > 0 ? InvoiceStatus.PARTIALLY_PAID : InvoiceStatus.PENDING;
}

/**
 * Issue DRAFT invoices for a reservation at check-in (QA #43).
 *   - ALL_STARTED: issue every DRAFT whose period has started (periodStart ≤ today)
 *   - FIRST_ONLY:  issue only the earliest DRAFT cycle
 *   - NONE:        leave everything DRAFT
 * Issuing sets status → PENDING and stamps issueDate = now. Returns the count.
 */
export async function issueDraftInvoicesOnCheckIn(
  reservationId: string,
  orgId: string,
  mode: string,
): Promise<number> {
  if (mode === "NONE") return 0;
  const todayD = toDay(new Date());
  const drafts = await prisma.invoice.findMany({
    where:   { reservationId, organizationId: orgId, status: "DRAFT" },
    orderBy: [{ monthNumber: "asc" }, { periodStart: "asc" }],
    select:  { id: true, periodStart: true },
  });
  if (drafts.length === 0) return 0;

  const ids = mode === "FIRST_ONLY"
    ? [drafts[0].id]
    : drafts.filter((d) => toDay(d.periodStart) <= todayD).map((d) => d.id);
  if (ids.length === 0) return 0;

  await prisma.invoice.updateMany({
    where: { id: { in: ids } },
    data:  { status: "PENDING", issueDate: new Date() },
  });
  return ids.length;
}

// ── Generate invoices for a reservation ──────────────────────────────────────

/**
 * Generate invoice(s) for a reservation on creation/confirmation.
 *
 * - Short-term (≤30 nights, daily rate): creates ONE invoice.
 * - Monthly (rate_type=monthly OR >30 nights): creates the FIRST period
 *   invoice only; subsequent invoices are generated by generateNextMonthlyInvoice().
 *
 * Idempotent: if non-cancelled invoices already exist the function returns
 * them unchanged rather than creating duplicates.
 *
 * @returns { invoices, totalExpected }
 */
export async function generateInvoicesForReservation(
  reservationId: string,
  orgId: string,
  userId: string,
): Promise<GenerateInvoicesResult> {
  // 1. Fetch reservation with all needed relations
  const res = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    include: {
      tenant: { select: { organizationId: true } },
      unit: {
        select: {
          id: true,
          name: true,
          basePrice: true,
          property: { select: { id: true } },
        },
      },
      reservationUnits: {
        where: { isMovedOut: false },
        include: {
          unit: {
            select: {
              id: true,
              name: true,
              basePrice: true,
              property: { select: { id: true } },
            },
          },
        },
      },
      invoices: {
        where: { status: { notIn: ["CANCELLED", "VOID"] } },
        select: { id: true, monthNumber: true, status: true },
      },
    },
  });

  // 2. Validate tenant belongs to org
  if (res.tenant.organizationId !== orgId) {
    throw new Error("Reservation tenant does not belong to the specified organisation.");
  }

  // Idempotency: return existing non-cancelled invoices if already generated
  if (res.invoices.length > 0) {
    const existing = await prisma.invoice.findMany({
      where: {
        reservationId,
        organizationId: orgId,
        status: { notIn: ["CANCELLED", "VOID"] },
      },
      include: { lineItems: true, allocations: true },
    });
    return {
      invoices:      existing as any,
      totalExpected: res.expectedInvoiceCount ?? existing.length,
    };
  }

  // 3. Determine billing approach
  const nights = calculateNights(res.startDate, res.endDate);
  const isMonthly =
    res.rateType === "monthly" ||
    res.rateType === "MONTHLY" ||
    nights > 30;

  const unitInfos = getReservationUnitInfos(res as any);

  if (!isMonthly) {
    // ── 4a. SHORT-TERM (daily, ≤30 nights) ────────────────────────────────────
    return await _generateShortTermInvoice(res, unitInfos, orgId, userId, nights);
  } else {
    // ── 4b. MONTHLY — generate ALL billing-cycle invoices up front ────────────
    return await _generateAllMonthlyInvoices(res, unitInfos, orgId, userId);
  }
}

// ── Internal: short-term invoice ─────────────────────────────────────────────

async function _generateShortTermInvoice(
  res: any,
  unitInfos: UnitInfo[],
  orgId: string,
  userId: string,
  nights: number,
): Promise<GenerateInvoicesResult> {
  const today = new Date();
  // Invoices generated while the reservation isn't checked in are DRAFT
  // (provisional). Check-in issues them per the org's autoIssueOnCheckIn (QA #43).
  const isCheckedIn = res.status === "CHECKED_IN";
  const discountAmount = roundOMR(Number(res.discountAmount ?? 0));

  const result = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await nextInvoiceNumber(orgId, tx);

    // Build line items for every unit
    const lineItemsData: Prisma.InvoiceLineItemCreateManyInvoiceInput[] = [];
    let subtotal = 0;
    let sortOrder = 0;

    for (const ui of unitInfos) {
      // Resolve unit name from reservation relation
      const unitName = _resolveUnitName(res, ui.unitId) ?? ui.unitId;

      // SOURCE OF TRUTH: the segments snapshotted at booking (QA #28/#32) honor
      // manual overrides and the seasonal rates in effect when booked. Only fall
      // back to recomputing from current UnitPrice records for legacy rows that
      // predate segment persistence.
      const persisted = ui.pricingSegments;
      if (persisted && persisted.length > 0 && persisted.reduce((s, sg) => s + sg.subtotal, 0) > 0) {
        for (const seg of persisted) {
          const lineTotal = roundOMR(seg.subtotal);
          subtotal = roundOMR(subtotal + lineTotal);
          const from = seg.startDate ? seg.startDate.slice(0, 10) : "";
          const to   = seg.endDate ? seg.endDate.slice(0, 10) : "";
          const span = from && to ? ` (${from} – ${to})` : "";
          lineItemsData.push({
            organizationId:    orgId,
            description:       `${unitName} — ${seg.seasonalPriceName ?? "Default"} rate${span}`,
            category:          "ROOM_CHARGE",
            unitId:            ui.unitId,
            quantity:          seg.nights,
            unitPrice:         seg.rateAmount,
            lineTotal,
            rateType:          "DAILY",
            rateSource:        mapRateSource(seg.rateSource),
            seasonalPriceName: seg.seasonalPriceName,
            priceBreakdown:    persisted as any,
            sortOrder:         sortOrder++,
          });
        }
        continue;
      }

      // Fetch daily pricing breakdown (from UnitPrice table) — legacy fallback.
      const pricing = await getUnitPriceForRange(ui.unitId, res.startDate, res.endDate);
      const segments = collapseToSegments(pricing.dailyBreakdown);

      if (segments.length > 0 && segments.reduce((s, seg) => s + seg.subtotal, 0) > 0) {
        // Normal path: use the pricing-engine segments. Defensive guard:
        // segments are derived from a per-day breakdown that is built in the
        // server's local timezone, so a daylight-saving boundary or DB date
        // stored at a non-midnight UTC time could in rare cases yield more
        // days than the reservation actually has. Clamp the total nights
        // billed to the reservation's authoritative `nights` count, scaling
        // each segment proportionally.
        const segNightsTotal = segments.reduce((s, seg) => s + seg.nights, 0);
        const clampRatio = segNightsTotal > nights && segNightsTotal > 0
          ? nights / segNightsTotal
          : 1;

        for (const seg of segments) {
          const billedNights = clampRatio < 1
            ? Math.round(seg.nights * clampRatio)
            : seg.nights;
          const lineTotal = clampRatio < 1
            ? roundOMR(seg.ratePerNight * billedNights)
            : roundOMR(seg.subtotal);
          subtotal = roundOMR(subtotal + lineTotal);

          lineItemsData.push({
            organizationId:    orgId,
            description:       `${unitName} — ${seg.priceName ?? "Default"} rate (${seg.startDate} – ${seg.endDate})`,
            category:          "ROOM_CHARGE",
            unitId:            ui.unitId,
            quantity:          billedNights,
            unitPrice:         seg.ratePerNight,
            lineTotal,
            rateType:          "DAILY",
            rateSource:        mapPriceTypeToSource(seg.priceType),
            seasonalPriceName: seg.priceName,
            priceBreakdown:    segments as any,
            sortOrder:         sortOrder++,
          });
        }
      } else {
        // Fallback: no UnitPrice records — use the rateAmount stored on the reservation unit
        const rate      = ui.rateAmount > 0 ? ui.rateAmount : Number(res.amount ?? 0);
        const lineTotal = roundOMR(rate * nights);
        subtotal        = roundOMR(subtotal + lineTotal);

        lineItemsData.push({
          organizationId:    orgId,
          description:       `${unitName} — ${nights} night(s) × ${rate.toFixed(3)} OMR`,
          category:          "ROOM_CHARGE",
          unitId:            ui.unitId,
          quantity:          nights,
          unitPrice:         rate,
          lineTotal,
          rateType:          "DAILY",
          rateSource:        mapRateSource(ui.rateSource),
          seasonalPriceName: ui.seasonalPriceName,
          sortOrder:         sortOrder++,
        });
      }
    }

    const totalAmount = roundOMR(subtotal - discountAmount);
    const balanceDue  = totalAmount; // no payments yet

    const invoice = await tx.invoice.create({
      data: {
        organizationId: orgId,
        invoiceNumber,
        reservationId:  res.id,
        tenantId:       res.tenantId,
        propertyId:     unitInfos[0]?.propertyId ?? null,
        periodStart:    res.startDate,
        periodEnd:      res.endDate,
        invoiceType:    "SHORT_TERM",
        monthNumber:    null,
        subtotal,
        discountAmount,
        taxAmount:      0,
        totalAmount,
        amountPaid:     0,
        balanceDue,
        status:         isCheckedIn ? "PENDING" : "DRAFT",
        // Placeholder for drafts; overwritten with the real issue time when issued.
        issueDate:      today,
        dueDate:        res.startDate,   // due on check-in
        createdById:    userId,
        lineItems: {
          createMany: { data: lineItemsData },
        },
      },
      include: { lineItems: true, allocations: true },
    });

    return invoice;
  });

  return { invoices: [result] as any, totalExpected: 1 };
}

// ── Internal: generate ALL monthly invoices at once ──────────────────────────

/**
 * Generate one invoice per billing cycle for a monthly reservation.
 *
 * Status assignment:
 *  - Cycles whose periodStart <= today  → PENDING  (dueDate = today)
 *  - Future cycles                       → DRAFT    (dueDate = periodStart)
 *
 * All invoices are created sequentially (to preserve invoice number order)
 * but in separate transactions (so a single failure doesn't wipe everything).
 */
async function _generateAllMonthlyInvoices(
  res: any,
  unitInfos: UnitInfo[],
  orgId: string,
  userId: string,
): Promise<GenerateInvoicesResult> {
  const periods = buildBillingCyclePeriods(res.startDate, res.endDate);
  if (periods.length === 0) {
    throw new Error("Could not build billing periods for reservation.");
  }

  const today    = new Date();
  const todayDay = toDay(today);
  // A cycle is issued (PENDING) only once the reservation is checked in AND the
  // cycle's period has started; otherwise it stays DRAFT until check-in (QA #43).
  const isCheckedIn = res.status === "CHECKED_IN";

  const createdInvoices: any[] = [];

  for (const period of periods) {
    const periodStarted = toDay(period.periodStart) <= todayDay;
    const status   = (isCheckedIn && periodStarted) ? InvoiceStatus.PENDING : InvoiceStatus.DRAFT;
    // Due today for current/past cycles; on cycle start for future cycles
    const dueDate  = periodStarted ? todayDay : period.periodStart;

    const invoice = await _createMonthlyInvoice({
      res,
      unitInfos,
      period,
      orgId,
      userId,
      dueDate,
      status,
    });
    createdInvoices.push(invoice);
  }

  // Store the expected total on the reservation
  await prisma.reservation.update({
    where: { id: res.id },
    data:  { expectedInvoiceCount: periods.length },
  });

  return {
    invoices:      createdInvoices,
    totalExpected: periods.length,
  };
}

// ── Internal: create one monthly invoice for a period ────────────────────────

async function _createMonthlyInvoice(opts: {
  res:       any;
  unitInfos: UnitInfo[];
  period:    CalendarMonthPeriod;
  orgId:     string;
  userId:    string;
  dueDate:   Date;
  status?:   InvoiceStatus;
}): Promise<any> {
  const { res, unitInfos, period, orgId, userId } = opts;
  const today = new Date();
  const status: InvoiceStatus = opts.status ?? InvoiceStatus.PENDING;

  // Label for line item description
  const periodLabel = _periodLabel(period);

  return prisma.$transaction(async (tx) => {
    const invoiceNumber = await nextInvoiceNumber(orgId, tx);

    const lineItemsData: Prisma.InvoiceLineItemCreateManyInvoiceInput[] = [];
    let subtotal = 0;
    let sortOrder = 0;

    for (const ui of unitInfos) {
      // Monthly rate: prefer explicit rateAmount, fall back to unit basePrice
      const monthlyRate = ui.rateAmount > 0
        ? ui.rateAmount
        : 0;

      // Pro-rate: full month billed flat; partial month billed as (rate × days / 30)
      const amount = period.isFullMonth
        ? roundOMR(monthlyRate)
        : roundOMR((monthlyRate / 30) * period.days);

      const unitName = _resolveUnitName(res, ui.unitId) ?? ui.unitId;

      // Full month bills flat (qty 1 × monthly rate); a partial month is prorated
      // per-day. Keep qty × unitPrice == lineTotal so the invoice reconciles
      // (a flat monthly rate shown as days × per-day broke for 31-day months).
      const quantity  = period.isFullMonth ? 1 : period.days;
      const unitPrice = period.isFullMonth ? roundOMR(monthlyRate) : roundOMR(monthlyRate / 30);
      const lineTotal = amount;
      subtotal = roundOMR(subtotal + lineTotal);

      lineItemsData.push({
        organizationId:    orgId,
        description:       `${unitName} — ${periodLabel}`,
        category:          "ROOM_CHARGE",
        unitId:            ui.unitId,
        quantity,
        unitPrice,
        lineTotal,
        rateType:          "MONTHLY",
        rateSource:        mapRateSource(ui.rateSource),
        seasonalPriceName: ui.seasonalPriceName,
        priceBreakdown:    [{ period: periodLabel, days: period.days, monthlyRate, amount }] as any,
        sortOrder:         sortOrder++,
      });
    }

    const discountAmount = roundOMR(Number(res.discountAmount ?? 0));
    const totalAmount    = roundOMR(subtotal - discountAmount);
    const balanceDue     = totalAmount;

    const invoice = await tx.invoice.create({
      data: {
        organizationId: orgId,
        invoiceNumber,
        reservationId:  res.id,
        tenantId:       res.tenantId,
        propertyId:     unitInfos[0]?.propertyId ?? null,
        periodStart:    period.periodStart,
        periodEnd:      period.periodEnd,
        invoiceType:    "MONTHLY",
        monthNumber:    period.monthNumber,
        subtotal,
        discountAmount,
        taxAmount:      0,
        totalAmount,
        amountPaid:     0,
        balanceDue,
        status,
        // Placeholder for drafts; overwritten with the real issue time when issued.
        issueDate:      today,
        dueDate:        opts.dueDate,
        createdById:    userId,
        lineItems: {
          createMany: { data: lineItemsData },
        },
      },
      include: { lineItems: true, allocations: true },
    });

    return invoice;
  });
}

// ── Generate the next monthly invoice ────────────────────────────────────────

/**
 * Generate the next sequential monthly invoice for a reservation.
 * Called manually by receptionist or automatically by generatePendingMonthlyInvoices().
 *
 * @returns the new invoice, or null if all periods have been invoiced.
 */
export async function generateNextMonthlyInvoice(
  reservationId: string,
  orgId: string,
  userId: string,
): Promise<any | null> {
  // 1. Fetch reservation
  const res = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    include: {
      tenant: { select: { organizationId: true } },
      unit: {
        select: {
          id: true,
          name: true,
          basePrice: true,
          property: { select: { id: true } },
        },
      },
      reservationUnits: {
        where: { isMovedOut: false },
        include: {
          unit: {
            select: {
              id: true,
              name: true,
              basePrice: true,
              property: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (res.tenant.organizationId !== orgId) {
    throw new Error("Reservation tenant does not belong to the specified organisation.");
  }

  // Must be active
  if (!["CHECKED_IN", "CONFIRMED"].includes(res.status)) {
    throw new Error(`Cannot generate invoice for reservation with status: ${res.status}`);
  }

  // 2. Find existing invoices (not cancelled)
  const existingInvoices = await prisma.invoice.findMany({
    where: {
      reservationId,
      organizationId: orgId,
      status: { notIn: ["CANCELLED", "VOID"] },
    },
    select: { monthNumber: true },
    orderBy: { monthNumber: "desc" },
  });

  const lastMonthNumber = existingInvoices.reduce(
    (max, inv) => Math.max(max, inv.monthNumber ?? 0),
    0,
  );

  // 3. Build all calendar month periods
  const periods = buildBillingCyclePeriods(res.startDate, res.endDate);

  // 4. Next period is at index = lastMonthNumber (0-indexed)
  const nextPeriod = periods[lastMonthNumber];

  if (!nextPeriod) return null;
  if (nextPeriod.periodStart >= res.endDate) return null;

  const unitInfos = getReservationUnitInfos(res as any);

  // Due date: first day of the period being invoiced
  const dueDate = nextPeriod.periodStart;

  const invoice = await _createMonthlyInvoice({
    res,
    unitInfos,
    period: nextPeriod,
    orgId,
    userId,
    dueDate,
    status: "PENDING",
  });

  return invoice;
}

// ── Handle early checkout ─────────────────────────────────────────────────────

/**
 * Adjust billing when a tenant checks out before the reservation end date.
 *
 * 1. Finds the invoice covering actualCheckoutDate.
 * 2. Recalculates that invoice for the actual days used.
 * 3. Cancels all future invoices.
 * 4. Flags refundPending on the reservation if a credit exists.
 */
export async function handleEarlyCheckout(
  reservationId: string,
  actualCheckoutDate: Date,
  orgId: string,
  userId: string,
): Promise<EarlyCheckoutResult> {
  const checkoutDay = toDay(actualCheckoutDate);
  const today = new Date();
  const checkoutStr = toDateString(checkoutDay);

  // Fetch all non-cancelled invoices for this reservation
  const allInvoices = await prisma.invoice.findMany({
    where: {
      reservationId,
      organizationId: orgId,
      status: { notIn: ["CANCELLED", "VOID"] },
    },
    include: { lineItems: true },
    orderBy: { periodStart: "asc" },
  });

  if (allInvoices.length === 0) {
    throw new Error("No invoices found for reservation.");
  }

  // 1. Find the invoice covering actualCheckoutDate
  const currentInvoice = allInvoices.find((inv) => {
    const ps = toDay(inv.periodStart);
    const pe = toDay(inv.periodEnd);
    return ps <= checkoutDay && checkoutDay <= pe;
  });

  // 2. Find all FUTURE invoices (periodStart > actualCheckoutDate)
  const futureInvoices = allInvoices.filter((inv) => {
    const ps = toDay(inv.periodStart);
    return ps > checkoutDay;
  });

  let updatedInvoice: any = currentInvoice ?? null;
  let creditAmount = 0;

  await prisma.$transaction(async (tx) => {
    // Cancel future invoices
    if (futureInvoices.length > 0) {
      await tx.invoice.updateMany({
        where: { id: { in: futureInvoices.map((i) => i.id) } },
        data: {
          status:         "CANCELLED",
          cancelledReason: `Early checkout on ${checkoutStr}`,
          cancelledAt:    today,
        },
      });
    }

    // Recalculate current invoice if it exists and covers the checkout date
    if (currentInvoice) {
      const periodStart = toDay(currentInvoice.periodStart);
      const actualDays  = daysBetween(periodStart, checkoutDay); // exclusive end

      // Rebuild subtotal from existing line items scaled to actualDays
      // If daily: recalculate via pricing engine; if monthly: pro-rate
      let newSubtotal = 0;

      if (currentInvoice.invoiceType === "MONTHLY") {
        // Pro-rate monthly line items
        for (const li of currentInvoice.lineItems) {
          const originalDays = Number(li.quantity);
          if (originalDays <= 0) continue;
          const newLineTotal = roundOMR((Number(li.lineTotal) / originalDays) * actualDays);
          newSubtotal = roundOMR(newSubtotal + newLineTotal);

          await tx.invoiceLineItem.update({
            where: { id: li.id },
            data: {
              quantity:  actualDays,
              lineTotal: newLineTotal,
            },
          });
        }
      } else {
        // SHORT_TERM daily: recalculate entirely; just scale existing subtotal
        const originalDays = Number(currentInvoice.lineItems.reduce(
          (s, li) => s + Number(li.quantity), 0,
        )) || 1;
        newSubtotal = roundOMR((Number(currentInvoice.subtotal) / originalDays) * actualDays);
      }

      const discountAmount = roundOMR(Number(currentInvoice.discountAmount));
      const newTotal       = roundOMR(newSubtotal - discountAmount);
      const amountPaid     = roundOMR(Number(currentInvoice.amountPaid));
      const newBalance     = roundOMR(newTotal - amountPaid);

      creditAmount = newBalance < 0 ? roundOMR(-newBalance) : 0;

      const newStatus = deriveInvoiceStatus(newTotal, amountPaid, currentInvoice.status);

      updatedInvoice = await tx.invoice.update({
        where: { id: currentInvoice.id },
        data: {
          periodEnd:   checkoutDay,
          subtotal:    newSubtotal,
          totalAmount: newTotal,
          balanceDue:  Math.max(0, newBalance),
          status:      newStatus,
        },
        include: { lineItems: true },
      });

      // Flag reservation if credit is owed
      if (creditAmount > 0) {
        await tx.reservation.update({
          where: { id: reservationId },
          data: { refundPending: true },
        });
      }
    }
  });

  return {
    updatedInvoice,
    cancelledCount: futureInvoices.length,
    creditAmount,
  };
}

// ── Handle overstay ───────────────────────────────────────────────────────────

/**
 * Create an OVERSTAY invoice when a tenant stays beyond their reservation end date.
 * The invoice is immediately ISSUED with dueDate=today.
 */
export async function handleOverstay(
  reservationId: string,
  actualCheckoutDate: Date,
  orgId: string,
  userId: string,
): Promise<any> {
  const res = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    include: {
      tenant:          { select: { organizationId: true } },
      unit:            { select: { id: true, name: true, property: { select: { id: true } } } },
      reservationUnits: {
        where: { isMovedOut: false },
        include: { unit: { select: { id: true, name: true, property: { select: { id: true } } } } },
      },
    },
  });

  if (res.tenant.organizationId !== orgId) {
    throw new Error("Reservation tenant does not belong to the specified organisation.");
  }

  const overstayStart = toDay(res.endDate);
  const overstayEnd   = toDay(actualCheckoutDate);
  const extraDays     = daysBetween(overstayStart, overstayEnd);

  if (extraDays <= 0) {
    throw new Error("actualCheckoutDate is not after reservation.endDate; no overstay to bill.");
  }

  const today    = new Date();
  const unitInfos = getReservationUnitInfos(res as any);

  return prisma.$transaction(async (tx) => {
    const invoiceNumber = await nextInvoiceNumber(orgId, tx);
    const lineItemsData: Prisma.InvoiceLineItemCreateManyInvoiceInput[] = [];
    let subtotal = 0;
    let sortOrder = 0;

    for (const ui of unitInfos) {
      // Get daily pricing for the overstay period
      const pricing  = await getUnitPriceForRange(ui.unitId, overstayStart, overstayEnd);
      const segments = collapseToSegments(pricing.dailyBreakdown);
      const unitName = _resolveUnitName(res, ui.unitId) ?? ui.unitId;

      for (const seg of segments) {
        const lineTotal = roundOMR(seg.subtotal);
        subtotal = roundOMR(subtotal + lineTotal);

        lineItemsData.push({
          organizationId:    orgId,
          description:       `${unitName} — Overstay ${seg.startDate} – ${seg.endDate}`,
          category:          "OVERSTAY",
          unitId:            ui.unitId,
          quantity:          seg.nights,
          unitPrice:         seg.ratePerNight,
          lineTotal,
          rateType:          "DAILY",
          rateSource:        mapPriceTypeToSource(seg.priceType),
          seasonalPriceName: seg.priceName,
          sortOrder:         sortOrder++,
        });
      }
    }

    const totalAmount = subtotal;
    const balanceDue  = totalAmount;

    const invoice = await tx.invoice.create({
      data: {
        organizationId: orgId,
        invoiceNumber,
        reservationId:  res.id,
        tenantId:       res.tenantId,
        propertyId:     unitInfos[0]?.propertyId ?? null,
        periodStart:    overstayStart,
        periodEnd:      overstayEnd,
        invoiceType:    "OVERSTAY",
        monthNumber:    null,
        subtotal,
        discountAmount: 0,
        taxAmount:      0,
        totalAmount,
        amountPaid:     0,
        balanceDue,
        status:         "PENDING",
        issueDate:      today,
        dueDate:        today,
        createdById:    userId,
        notes:          `Overstay: ${extraDays} extra day(s) beyond ${toDateString(overstayStart)}`,
        lineItems: {
          createMany: { data: lineItemsData },
        },
      },
      include: { lineItems: true },
    });

    return invoice;
  });
}

// ── Add extra charge ──────────────────────────────────────────────────────────

/**
 * Add an ad-hoc charge to the appropriate invoice for this reservation.
 *
 * Strategy:
 *  - For DRAFT invoices: append line item directly.
 *  - For ISSUED/PARTIALLY_PAID/PAID invoices: create a new ADDITIONAL invoice.
 *  - If no active invoice exists at all: create a new ADDITIONAL invoice.
 *
 * @param category  - LineItemCategory enum value (default: "OTHER")
 */
export async function addExtraCharge(
  reservationId: string,
  description:   string,
  amount:        number,
  category:      LineItemCategory = LineItemCategory.OTHER,
  orgId:         string,
  userId:        string,
): Promise<any> {
  const chargeAmount = roundOMR(amount);
  if (chargeAmount <= 0) throw new Error("Charge amount must be positive.");

  const today = new Date();
  const todayDay = toDay(today);

  // Fetch reservation basics
  const res = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    select: {
      id:       true,
      tenantId: true,
      rateType: true,
      startDate: true,
      endDate:  true,
      unit:     { select: { property: { select: { id: true } } } },
      reservationUnits: {
        where: { isMovedOut: false },
        select: { unit: { select: { property: { select: { id: true } } } } },
      },
    },
  });

  // Fetch existing non-cancelled invoices
  const existingInvoices = await prisma.invoice.findMany({
    where: {
      reservationId,
      organizationId: orgId,
      status: { notIn: ["CANCELLED", "VOID"] },
    },
    include: { lineItems: true },
    orderBy: { periodStart: "asc" },
  });

  const isMonthly =
    res.rateType === "monthly" || res.rateType === "MONTHLY";

  // Find the "current" pending invoice to amend
  let targetInvoice = existingInvoices.find((inv) => {
    if (inv.status !== "PENDING") return false;
    if (!isMonthly) return true;   // short-term: any draft
    const ps = toDay(inv.periodStart);
    const pe = toDay(inv.periodEnd);
    return ps <= todayDay && todayDay <= pe;
  }) ?? null;

  // If target is non-draft, we need a new ADDITIONAL invoice
  const needsNewInvoice =
    !targetInvoice ||
    !["PENDING"].includes(targetInvoice.status);

  if (needsNewInvoice) {
    // Create new ADDITIONAL invoice
    const propertyId =
      res.reservationUnits?.[0]?.unit?.property?.id ??
      res.unit?.property?.id ??
      null;

    return prisma.$transaction(async (tx) => {
      const invoiceNumber = await nextInvoiceNumber(orgId, tx);

      const invoice = await tx.invoice.create({
        data: {
          organizationId: orgId,
          invoiceNumber,
          reservationId:  res.id,
          tenantId:       res.tenantId,
          propertyId,
          periodStart:    today,
          periodEnd:      today,
          invoiceType:    "ADDITIONAL",
          subtotal:       chargeAmount,
          discountAmount: 0,
          taxAmount:      0,
          totalAmount:    chargeAmount,
          amountPaid:     0,
          balanceDue:     chargeAmount,
          status:         "PENDING",
          issueDate:      today,
          dueDate:        today,
          createdById:    userId,
          lineItems: {
            createMany: {
              data: [{
                organizationId: orgId,
                description,
                category,
                quantity:   1,
                unitPrice:  chargeAmount,
                lineTotal:  chargeAmount,
                sortOrder:  0,
              }],
            },
          },
        },
        include: { lineItems: true },
      });

      return invoice;
    });
  }

  // Append line item to existing DRAFT invoice and recalculate totals
  return prisma.$transaction(async (tx) => {
    const existingLineCount = targetInvoice!.lineItems.length;

    await tx.invoiceLineItem.create({
      data: {
        invoiceId:      targetInvoice!.id,
        organizationId: orgId,
        description,
        category,
        quantity:   1,
        unitPrice:  chargeAmount,
        lineTotal:  chargeAmount,
        sortOrder:  existingLineCount,
      },
    });

    const newSubtotal    = roundOMR(Number(targetInvoice!.subtotal) + chargeAmount);
    const discountAmount = roundOMR(Number(targetInvoice!.discountAmount));
    const newTotal       = roundOMR(newSubtotal - discountAmount);
    const amountPaid     = roundOMR(Number(targetInvoice!.amountPaid));
    const newBalance     = roundOMR(newTotal - amountPaid);

    const updated = await tx.invoice.update({
      where: { id: targetInvoice!.id },
      data: {
        subtotal:    newSubtotal,
        totalAmount: newTotal,
        balanceDue:  Math.max(0, newBalance),
      },
      include: { lineItems: true },
    });

    return updated;
  });
}

// ── Record a payment ──────────────────────────────────────────────────────────

/**
 * Record a payment from a tenant and allocate it across invoices.
 *
 * Two allocation modes:
 *  1. Manual: caller provides `invoiceAllocations` with explicit amounts per invoice.
 *  2. Auto:   invoices for this tenant (outstanding, ordered oldest-first) are
 *             filled greedily until the payment amount is exhausted.
 *
 * After allocation, each affected invoice's status is recalculated and the
 * reservation's amountPaid is updated.
 */
export async function recordPayment(
  params: RecordPaymentParams,
): Promise<RecordPaymentResult> {
  const {
    tenantId,
    amount,
    method,
    reference,
    notes,
    orgId,
    userId,
    receivedById,
    reservationId,
    bankAccountId,
    invoiceAllocations,
  } = params;

  const paymentAmount = roundOMR(amount);
  if (paymentAmount <= 0) throw new Error("Payment amount must be positive.");

  const today = new Date();

  return prisma.$transaction(async (tx) => {
    // Resolve + validate the bank account for non-cash methods.
    let resolvedBankId: string | null = null;
    if (methodNeedsBank(method)) {
      if (bankAccountId) {
        const bank = await tx.bankAccount.findUnique({
          where: { id: bankAccountId },
          select: { organizationId: true, isActive: true },
        });
        if (!bank || bank.organizationId !== orgId) throw new Error("Invalid bank account.");
        resolvedBankId = bankAccountId;
      } else if (methodRequiresBank(method)) {
        throw new Error("A bank account is required for bank transfers.");
      }
    }

    // 1. Generate payment number
    const paymentNumber = await nextPaymentNumber(orgId, tx);

    // 2. Create payment record
    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        organizationId: orgId,
        amount:         paymentAmount,
        date:           today,
        method:         method as any,
        reference:      reference ?? null,
        notes:          notes ?? null,
        isRefund:       false,
        receivedById:   receivedById ?? null,
        tenantId,
        reservationId:  reservationId ?? null,
        bankAccountId:  resolvedBankId,
      },
    });

    // Post the bank ledger row for this inflow (cash stays out of the ledger).
    if (resolvedBankId) {
      await postBankTxn(tx, {
        organizationId: orgId,
        bankAccountId:  resolvedBankId,
        type:           "PAYMENT_IN",
        amount:         paymentAmount,
        date:           today,
        description:    `Payment ${paymentNumber ?? ""}`.trim(),
        reference:      reference ?? null,
        paymentId:      payment.id,
        createdById:    receivedById ?? userId ?? null,
      });
    }

    const createdAllocations: any[] = [];
    let remaining = paymentAmount;

    // Overpayment policy (QA #46/#50): BLOCK only TRUE overpayment — paying more
    // than the total outstanding for the scope — NOT an intentional under-
    // allocation (leaving part as an unapplied credit on purpose).
    {
      const scopeInvoices = await tx.invoice.findMany({
        where: {
          tenantId,
          organizationId: orgId,
          ...(reservationId ? { reservationId } : {}),
          status: { in: ["PENDING", "PARTIALLY_PAID", "PARTIAL", "DUE", "ISSUED"] },
          balanceDue: { gt: 0 },
        },
        select: { balanceDue: true },
      });
      const scopeOutstanding = roundOMR(scopeInvoices.reduce((s, i) => s + Number(i.balanceDue), 0));
      const trueOverpayment  = roundOMR(Math.max(0, paymentAmount - scopeOutstanding));
      if (trueOverpayment > 0) {
        const org = await tx.organization.findUnique({
          where:  { id: orgId },
          select: { overpaymentPolicy: true },
        });
        if ((org?.overpaymentPolicy ?? "WARN") === "BLOCK") {
          throw new Error(`Payment exceeds the outstanding balance by ${trueOverpayment.toFixed(3)} OMR.`);
        }
      }
    }

    if (invoiceAllocations && invoiceAllocations.length > 0) {
      // ── 3a. Manual allocation ──────────────────────────────────────────────
      // Cap each allocation at the invoice's current balanceDue. Anything the
      // caller asks above that stays on `remaining` and becomes overpayment
      // (tenant credit), so the per-invoice amountPaid never exceeds the
      // invoice total.
      for (const alloc of invoiceAllocations) {
        const requested = roundOMR(alloc.amount);
        if (requested <= 0) continue;

        const inv = await tx.invoice.findUnique({
          where:  { id: alloc.invoiceId },
          select: { balanceDue: true, organizationId: true, status: true },
        });
        if (!inv || inv.organizationId !== orgId) continue;
        if (inv.status === "CANCELLED") continue;

        const due      = roundOMR(Number(inv.balanceDue));
        const allocAmt = roundOMR(Math.min(requested, due, remaining));
        if (allocAmt <= 0) continue;

        const allocation = await tx.paymentAllocation.create({
          data: {
            paymentId:      payment.id,
            invoiceId:      alloc.invoiceId,
            organizationId: orgId,
            amount:         allocAmt,
          },
        });
        createdAllocations.push(allocation);

        await _applyAllocationToInvoice(tx, alloc.invoiceId, allocAmt, today);
        remaining = roundOMR(remaining - allocAmt);
      }
    } else {
      // ── 3b. Auto allocation: oldest outstanding invoices first ─────────────
      // Scope to THIS reservation when paying from a reservation (QA #48) — else
      // the payment would spread across the tenant's other reservations. When
      // no reservation context (e.g. the standalone payments page), fall back to
      // tenant-wide oldest-first.
      const outstandingInvoices = await tx.invoice.findMany({
        where: {
          tenantId,
          organizationId: orgId,
          ...(reservationId ? { reservationId } : {}),
          status: { in: ["PENDING", "PARTIALLY_PAID", "PARTIAL", "DUE", "ISSUED"] },
          balanceDue: { gt: 0 },
        },
        orderBy: { dueDate: "asc" },
        select: { id: true, balanceDue: true },
      });

      for (const inv of outstandingInvoices) {
        if (remaining <= 0) break;

        const due      = roundOMR(Number(inv.balanceDue));
        const allocAmt = roundOMR(Math.min(remaining, due));

        const allocation = await tx.paymentAllocation.create({
          data: {
            paymentId:      payment.id,
            invoiceId:      inv.id,
            organizationId: orgId,
            amount:         allocAmt,
          },
        });
        createdAllocations.push(allocation);

        await _applyAllocationToInvoice(tx, inv.id, allocAmt, today);
        remaining = roundOMR(remaining - allocAmt);
      }
    }

    const overpayment = remaining > 0 ? remaining : 0;
    if (overpayment > 0) {
      // Unapplied remainder (true overpayment was already gated above by policy,
      // or this is an intentional under-allocation) → record as a credit.
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          notes: [notes, `Overpayment: ${overpayment} OMR (unapplied credit)`]
                   .filter(Boolean)
                   .join(" | "),
        },
      });
    }

    // 6. Update reservation.amountPaid = sum of all non-refund payments for its invoices
    if (reservationId) {
      await _recalcReservationAmountPaid(tx, reservationId);
    }

    return { payment, allocations: createdAllocations, overpayment };
  });
}

// ── Internal: apply allocation to an invoice ──────────────────────────────────

async function _applyAllocationToInvoice(
  tx:       Prisma.TransactionClient,
  invoiceId: string,
  amount:    number,
  today:     Date,
): Promise<void> {
  const invoice = await tx.invoice.findUniqueOrThrow({
    where:  { id: invoiceId },
    select: { totalAmount: true, amountPaid: true, creditedAmount: true, status: true },
  });

  const totalAmount = roundOMR(Number(invoice.totalAmount));
  const credited    = roundOMR(Number(invoice.creditedAmount));
  const amountPaid  = roundOMR(Number(invoice.amountPaid) + amount);
  // balanceDue is net of return credits (credit-note model).
  const balanceDue  = roundOMR(Math.max(0, totalAmount - amountPaid - credited));
  const newStatus   = deriveInvoiceStatus(totalAmount, amountPaid, invoice.status, credited);

  await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      amountPaid,
      balanceDue,
      status:   newStatus,
      paidDate: newStatus === "PAID" ? today : null,
    },
  });
}

// ── Internal: recalculate reservation.amountPaid ──────────────────────────────

async function _recalcReservationAmountPaid(
  tx:            Prisma.TransactionClient,
  reservationId: string,
): Promise<void> {
  // Sum all non-refund payment amounts linked to this reservation's invoices
  const allocations = await tx.paymentAllocation.findMany({
    where: {
      invoice: { reservationId },
      payment: { isRefund: false },
    },
    select: { amount: true },
  });

  const totalPaid = allocations.reduce(
    (sum, a) => roundOMR(sum + Number(a.amount)),
    0,
  );

  await tx.reservation.update({
    where: { id: reservationId },
    data:  { amountPaid: totalPaid },
  });
}

// ── Tenant financial summary ───────────────────────────────────────────────────

/**
 * Return a comprehensive financial summary for a tenant:
 *   - Totals charged, paid, refunded and current balance.
 *   - Invoice counts broken down by status.
 *   - All outstanding invoices (for display).
 *   - Last 10 payments.
 */
export async function getTenantFinancialSummary(
  tenantId: string,
  orgId: string,
): Promise<TenantFinancialSummary> {
  const today = new Date();

  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({
      where: { tenantId, organizationId: orgId },
      include: { lineItems: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.payment.findMany({
      where: { tenantId, organizationId: orgId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Totals
  const nonCancelledInvoices = invoices.filter(
    (inv) => !["CANCELLED", "VOID"].includes(inv.status),
  );
  const totalCharged = nonCancelledInvoices.reduce(
    (sum, inv) => roundOMR(sum + Number(inv.totalAmount)),
    0,
  );
  // Return credits applied to invoices (credit-note model): reduce the effective
  // charge without touching the frozen invoice total.
  const totalCredited = nonCancelledInvoices.reduce(
    (sum, inv) => roundOMR(sum + Number(inv.creditedAmount ?? 0)),
    0,
  );

  const nonRefundPayments = payments.filter((p) => !p.isRefund);
  const refundPayments    = payments.filter((p) => p.isRefund);

  const totalPaid = nonRefundPayments.reduce(
    (sum, p) => roundOMR(sum + Number(p.amount)),
    0,
  );
  const totalRefunded = refundPayments.reduce(
    (sum, p) => roundOMR(sum + Number(p.amount)),
    0,
  );

  // Net owed = effective charges (charged − credited) − cash in + cash refunded.
  const currentBalance = roundOMR(totalCharged - totalCredited - totalPaid + totalRefunded);

  // Invoice counts
  const paidInvoices = nonCancelledInvoices.filter(
    (inv) => ["PAID"].includes(inv.status),
  );
  const cancelledInvoices = invoices.filter((inv) =>
    ["CANCELLED", "VOID"].includes(inv.status),
  );
  const outstandingInvoicesList = nonCancelledInvoices.filter((inv) =>
    ["ISSUED", "PARTIALLY_PAID", "DRAFT", "PENDING", "PARTIAL", "DUE"].includes(inv.status),
  );
  // Overdue = a *billed* invoice (DRAFT excluded — not yet issued, no revenue
  // posted) whose due date is strictly in the past, with a remaining balance.
  const overdueInvoices = outstandingInvoicesList.filter(
    (inv) =>
      inv.status !== "DRAFT" &&
      toDay(inv.dueDate) < toDay(today) &&
      Number(inv.balanceDue) > 0,
  );

  return {
    totalCharged,
    totalPaid,
    totalRefunded,
    currentBalance,
    invoices: {
      total:      invoices.length,
      paid:       paidInvoices.length,
      outstanding: outstandingInvoicesList.length,
      overdue:    overdueInvoices.length,
      cancelled:  cancelledInvoices.length,
    },
    outstandingInvoices: outstandingInvoicesList as any,
    recentPayments:      payments.slice(0, 10) as any,
  };
}

// ── Generate pending monthly invoices (cron job) ──────────────────────────────

/**
 * Scan all CHECKED_IN monthly reservations and auto-generate invoices that
 * are due within the next 5 days.
 *
 * Designed to be called from a daily cron job or scheduled task.
 *
 * @param orgId - if provided, restricts to one organisation (for multi-tenant crons)
 */
export async function generatePendingMonthlyInvoices(
  orgId?: string,
): Promise<PendingMonthlyResult> {
  const today       = new Date();
  const horizon     = addDays(today, 5);

  // Find all checked-in monthly reservations
  const reservations = await prisma.reservation.findMany({
    where: {
      status:   "CHECKED_IN",
      rateType: { in: ["monthly", "MONTHLY"] },
      ...(orgId ? { tenant: { organizationId: orgId } } : {}),
    },
    select: {
      id:       true,
      startDate: true,
      endDate:  true,
      tenant:   { select: { organizationId: true } },
      invoices: {
        where: { status: { notIn: ["CANCELLED", "VOID"] } },
        select: { monthNumber: true },
      },
    },
  });

  const details: { reservationId: string; invoiceId: string; monthNumber: number }[] = [];

  for (const res of reservations) {
    const resOrgId = res.tenant.organizationId;
    if (!resOrgId) continue;

    const periods = buildBillingCyclePeriods(res.startDate, res.endDate);

    const lastMonthNumber = res.invoices.reduce(
      (max, inv) => Math.max(max, inv.monthNumber ?? 0),
      0,
    );

    const nextPeriod = periods[lastMonthNumber];
    if (!nextPeriod) continue;
    if (nextPeriod.periodStart >= res.endDate) continue;

    // Generate if the next period starts within the 5-day horizon
    if (nextPeriod.periodStart <= horizon) {
      // Check not already created (race safety)
      const alreadyExists = await prisma.invoice.findFirst({
        where: {
          reservationId: res.id,
          monthNumber:   lastMonthNumber + 1,
          status:        { notIn: ["CANCELLED", "VOID"] },
        },
        select: { id: true },
      });
      if (alreadyExists) continue;

      // Use a sentinel userId for auto-generated invoices
      const invoice = await generateNextMonthlyInvoice(
        res.id,
        resOrgId,
        "system",
      );

      if (invoice) {
        details.push({
          reservationId: res.id,
          invoiceId:     invoice.id,
          monthNumber:   lastMonthNumber + 1,
        });
      }
    }
  }

  return { generated: details.length, details };
}

// ── Private utilities ─────────────────────────────────────────────────────────

/** Resolve a human-readable unit name from the reservation's loaded relations. */
function _resolveUnitName(res: any, unitId: string): string | null {
  // Try junction table first
  if (res.reservationUnits) {
    const ru = res.reservationUnits.find((u: any) => u.unitId === unitId || u.unit?.id === unitId);
    if (ru?.unit?.name) return ru.unit.name;
  }
  // Fall back to legacy unit relation
  if (res.unit?.id === unitId && res.unit?.name) return res.unit.name;
  return null;
}

/** Build a human-readable label for a billing period. */
function _periodLabel(period: CalendarMonthPeriod): string {
  const opts: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" };
  const monthLabel = period.periodStart.toLocaleString("en-US", opts);
  if (period.isFullMonth) return monthLabel;
  const startStr = toDateString(period.periodStart);
  const endStr   = toDateString(period.periodEnd);
  return `${monthLabel} (${startStr} – ${endStr})`;
}
