/* ============================================================================
 *  Phase D — Reservations + Invoices
 *
 *  Builds 120 reservations (70 daily + 50 monthly) covering every status the
 *  spec calls out, plus the ten edge cases. Each non-cancelled reservation
 *  triggers `generateInvoicesForReservation()` so the invoice + line-item
 *  rows are populated by the production engine (no math duplicated in this
 *  script).
 * ========================================================================= */

import { prisma } from "@/lib/prisma";
import { generateInvoicesForReservation } from "@/lib/invoice-engine";
import { addDays, daysBetween, fixedDate, TODAY } from "./dates";
import { pick, randInt, chance } from "./rand";
import type { SetupResult, UnitRef } from "./setup";
import type { TenantsResult } from "./tenants";

export interface ReservationRef {
  id:            string;
  tenantId:      string;
  organizationId: string;
  rateType:      "daily" | "monthly";
  status:        string;
  startDate:     Date;
  endDate:       Date;
  invoicesGenerated: boolean;
}

export interface ReservationsResult {
  reservations: ReservationRef[];
  created:      number;
  daily:        number;
  monthly:      number;
}

/* ── Internal helpers ───────────────────────────────────────────────────── */

interface UnitBooking { unitId: string; start: Date; end: Date }

/* Tracks units that are currently in active reservations so the seeder
 * never double-books. Past-completed reservations are not tracked because
 * they free up their unit. */
const activeUsage: UnitBooking[] = [];

function unitFree(unitId: string, start: Date, end: Date): boolean {
  for (const b of activeUsage) {
    if (b.unitId !== unitId) continue;
    if (start < b.end && end > b.start) return false;
  }
  return true;
}

function markActive(unitId: string, start: Date, end: Date): void {
  activeUsage.push({ unitId, start, end });
}

/** Returns `null` when every unit is already booked in the window. Callers
 *  should treat this as "skip this reservation" rather than fatal — the seed
 *  targets are aspirational, and falling short of a few is better than
 *  failing the whole run. */
function pickFreeUnit(units: UnitRef[], start: Date, end: Date): UnitRef | null {
  const free = units.filter((u) => unitFree(u.id, start, end));
  if (free.length === 0) return null;
  return pick(free);
}

/* ── Phase entry point ──────────────────────────────────────────────────── */

export async function runReservations(
  setup: SetupResult,
  tenantsResult: TenantsResult,
): Promise<ReservationsResult> {
  console.log("⚙︎  Phase D — reservations + invoices");

  const alNoor = setup.orgs.find((o) => o.name === "Al Noor Property Management")!;
  const orgUnits = setup.units.filter((u) => u.organizationId === alNoor.id);
  const orgTenants = tenantsResult.tenants.filter((t) => t.organizationId === alNoor.id);
  // Exclude blacklisted from active reservations.
  const bookableTenants = orgTenants.filter((t) => t.classification !== "blacklisted");
  const owner = setup.users.find((u) => u.role === "OWNER" && u.organizationId === alNoor.id)!;
  const repeatGuestId = tenantsResult.repeatGuestId;

  // Pools by building so we can target low / high occupancy edge cases.
  const alNoorResUnits = orgUnits.filter((u) => setup.properties.find((p) => p.id === u.propertyId)?.name === "Al Noor Residence");
  const khareefUnits   = orgUnits.filter((u) => setup.properties.find((p) => p.id === u.propertyId)?.name === "Khareef Suites");
  const plazaUnits     = orgUnits.filter((u) => setup.properties.find((p) => p.id === u.propertyId)?.name === "Salalah Plaza");

  const reservations: ReservationRef[] = [];

  /* ── DAILY ─────────────────────────────────────────────────────────── */

  // 25 checked-out (Jan-Oct 2025) — historical, free up units
  for (let i = 0; i < 25; i++) {
    const start = addDays(fixedDate(2025, 1 + Math.floor(i / 3), 1), randInt(0, 25));
    const nights = randInt(2, 7);
    const end = addDays(start, nights);
    const r = await createDaily({
      tenant: pick(bookableTenants),
      unit:   pick(alNoorResUnits.concat(khareefUnits, plazaUnits)),
      start, end,
      status: "COMPLETED",
      orgId:  alNoor.id, userId: owner.id,
      track:  false,
    });
    reservations.push(r);
  }

  // 6 Khareef 2025 historical — all COMPLETED, dates inside Jul/Aug 2025
  for (let i = 0; i < 6; i++) {
    const start = addDays(fixedDate(2025, 7, 1), randInt(0, 50));
    const end = addDays(start, randInt(5, 14));
    const r = await createDaily({
      tenant: pick(bookableTenants),
      unit:   pick(orgUnits),
      start, end,
      status: "COMPLETED",
      orgId:  alNoor.id, userId: owner.id,
      track:  false,
    });
    reservations.push(r);
  }

  // 8 cancelled before check-in (mix with/without invoices)
  for (let i = 0; i < 8; i++) {
    const start = addDays(TODAY, randInt(-60, -10));
    const end = addDays(start, randInt(2, 7));
    const r = await createDaily({
      tenant: pick(bookableTenants),
      unit:   pick(orgUnits),
      start, end,
      status: "CANCELLED",
      cancelledReason: pick(["Guest changed plans", "Payment failed", "Better rate elsewhere"]),
      orgId:  alNoor.id, userId: owner.id,
      track:  false,
      generateInvoices: i % 2 === 0,
    });
    reservations.push(r);
  }

  // 4 no-show (invoices cancelled)
  for (let i = 0; i < 4; i++) {
    const start = addDays(TODAY, randInt(-30, -5));
    const end = addDays(start, randInt(2, 5));
    const r = await createDaily({
      tenant: pick(bookableTenants),
      unit:   pick(orgUnits),
      start, end,
      status: "NO_SHOW",
      cancelledReason: "Guest did not arrive",
      orgId:  alNoor.id, userId: owner.id,
      track:  false,
      generateInvoices: true,
    });
    reservations.push(r);
  }

  // 12 currently in-house with varied checkout dates
  // Split: 3 checkout today, 2 overstay 2 days, 3 checkout in next 3 days,
  // 4 checkout 1-2 weeks away
  const inHouseBuckets: Array<{ count: number; offsetMin: number; offsetMax: number }> = [
    { count: 3, offsetMin:  0, offsetMax:  0 },   // today
    { count: 2, offsetMin: -2, offsetMax: -2 },   // overstay
    { count: 3, offsetMin:  1, offsetMax:  3 },
    { count: 4, offsetMin:  7, offsetMax: 14 },
  ];
  for (const bucket of inHouseBuckets) {
    for (let i = 0; i < bucket.count; i++) {
      const nights = randInt(3, 8);
      const offset = bucket.offsetMin === bucket.offsetMax ? bucket.offsetMin : randInt(bucket.offsetMin, bucket.offsetMax);
      const end   = addDays(TODAY, offset);
      const start = addDays(end, -nights);
      const unit  = pickFreeUnit(orgUnits, start, end);
      if (!unit) continue;
      const r = await createDaily({
        tenant: pick(bookableTenants),
        unit,
        start, end,
        status: "CHECKED_IN",
        orgId:  alNoor.id, userId: owner.id,
        track:  true,
      });
      reservations.push(r);
    }
  }

  // 5 arriving today
  for (let i = 0; i < 5; i++) {
    const start = TODAY;
    const end = addDays(start, randInt(2, 7));
    const unit = pickFreeUnit(orgUnits, start, end);
    if (!unit) continue;
    const r = await createDaily({
      tenant: pick(bookableTenants),
      unit,
      start, end,
      status: "CONFIRMED",
      orgId:  alNoor.id, userId: owner.id,
      track:  true,
    });
    reservations.push(r);
  }

  // 10 upcoming (next 30 days)
  for (let i = 0; i < 10; i++) {
    const start = addDays(TODAY, randInt(2, 28));
    const end = addDays(start, randInt(2, 7));
    const unit = pickFreeUnit(orgUnits, start, end);
    if (!unit) continue;
    const r = await createDaily({
      tenant: pick(bookableTenants),
      unit,
      start, end,
      status: "CONFIRMED",
      orgId:  alNoor.id, userId: owner.id,
      track:  true,
    });
    reservations.push(r);
  }

  /* ── DAILY EDGE CASES ──────────────────────────────────────────────── */

  // 1. Khareef 2025 boundary crossing — Jun 28 to Jul 5
  const k25Cross = await createDaily({
    tenant: pick(bookableTenants),
    unit:   pick(orgUnits),
    start:  fixedDate(2025, 6, 28),
    end:    fixedDate(2025, 7, 5),
    status: "COMPLETED",
    orgId:  alNoor.id, userId: owner.id,
    track:  false,
  });
  reservations.push(k25Cross);

  // 1b. Khareef 2025 end boundary — Aug 28 to Sep 4
  const k25EndCross = await createDaily({
    tenant: pick(bookableTenants),
    unit:   pick(orgUnits),
    start:  fixedDate(2025, 8, 28),
    end:    fixedDate(2025, 9, 4),
    status: "COMPLETED",
    orgId:  alNoor.id, userId: owner.id,
    track:  false,
  });
  reservations.push(k25EndCross);

  // 3. Multi-unit reservation with 4 units (one tenant, four rooms)
  const multiTenant = pick(bookableTenants);
  const multiStart = addDays(TODAY, 5);
  const multiEnd = addDays(multiStart, 4);
  const fourUnits = orgUnits
    .filter((u) => unitFree(u.id, multiStart, multiEnd))
    .slice(0, 4);
  const multiRes = await createReservation({
    tenant: multiTenant,
    units: fourUnits,
    start: multiStart, end: multiEnd,
    status: "CONFIRMED",
    rateType: "daily",
    orgId: alNoor.id, userId: owner.id,
    track: true,
  });
  reservations.push(multiRes);

  // 5. Repeat guest — 5 historical reservations for the same tenant
  const repeatTenant = orgTenants.find((t) => t.id === repeatGuestId)!;
  for (let i = 0; i < 5; i++) {
    const start = addDays(fixedDate(2025, 2 + i, 1), randInt(0, 20));
    const end = addDays(start, randInt(3, 6));
    const r = await createDaily({
      tenant: repeatTenant,
      unit:   pick(orgUnits),
      start, end,
      status: "COMPLETED",
      orgId:  alNoor.id, userId: owner.id,
      track:  false,
    });
    reservations.push(r);
  }

  // 8. Extended reservation — created with shorter end, then extended.
  const extendStart = addDays(TODAY, -2);
  const extendOriginalEnd = addDays(extendStart, 3);
  const extendNewEnd = addDays(extendOriginalEnd, 4);
  const extendUnit = pickFreeUnit(orgUnits, extendStart, extendNewEnd);
  if (extendUnit) {
    const extended = await createDaily({
      tenant: pick(bookableTenants),
      unit:   extendUnit,
      start:  extendStart,
      end:    extendNewEnd,
      status: "CHECKED_IN",
      orgId:  alNoor.id, userId: owner.id,
      track:  true,
    });
    reservations.push(extended);
    // Log the extension as an activity so the audit log shows the change.
    await prisma.reservationActivity.create({
      data: {
        reservationId:  extended.id,
        organizationId: alNoor.id,
        action:         "EXTENDED",
        description:    `Stay extended by ${daysBetween(extendOriginalEnd, extendNewEnd)} nights`,
        performedById:  owner.id,
        metadata:       { previousEndDate: extendOriginalEnd.toISOString(), newEndDate: extendNewEnd.toISOString() },
      },
    });
  }

  // 9. Unit changed mid-stay
  const swapStart = addDays(TODAY, -4);
  const swapEnd = addDays(swapStart, 7);
  const originalUnit = pickFreeUnit(orgUnits, swapStart, swapEnd);
  const newUnit = originalUnit
    ? pickFreeUnit(orgUnits.filter((u) => u.id !== originalUnit.id), swapStart, swapEnd)
    : null;
  if (originalUnit && newUnit) {
    const swapRes = await createDaily({
      tenant: pick(bookableTenants),
      unit:   newUnit,
      start:  swapStart,
      end:    swapEnd,
      status: "CHECKED_IN",
      orgId:  alNoor.id, userId: owner.id,
      track:  true,
    });
    reservations.push(swapRes);
    // Mark the original ReservationUnit as moved out + log activity.
    await prisma.reservationUnit.updateMany({
      where: { reservationId: swapRes.id, unitId: newUnit.id },
      data: {
        isMovedOut:    false,
      },
    });
    // Add the original unit as a moved-out row.
    await prisma.reservationUnit.create({
      data: {
        reservationId: swapRes.id,
        unitId:        originalUnit.id,
        rateType:      "DAILY",
        rateAmount:    originalUnit.dailyRate,
        rateSource:    "DEFAULT_PRICE",
        nights:        2,
        subtotal:      originalUnit.dailyRate * 2,
        isMovedOut:    true,
        movedToUnitId: newUnit.id,
        moveReason:    "Tenant requested upgrade",
        moveDate:      addDays(swapStart, 2),
      },
    });
    await prisma.reservationActivity.create({
      data: {
        reservationId:  swapRes.id,
        organizationId: alNoor.id,
        action:         "UNIT_MOVED",
        description:    `Moved from ${originalUnit.name} to ${newUnit.name}`,
        performedById:  owner.id,
        metadata:       { fromUnitId: originalUnit.id, toUnitId: newUnit.id },
      },
    });
  }

  /* ── MONTHLY ────────────────────────────────────────────────────────── */

  // 15 long-term completed monthly (Jan 2025-onwards, 3-6 month stays)
  for (let i = 0; i < 15; i++) {
    const monthsAgo = randInt(8, 18);
    const start = fixedDate(2025, 1, 1);
    start.setMonth(start.getMonth() + (i % 6));
    const months = pick([3, 6]);
    const end = addDays(start, months * 30);
    const r = await createMonthly({
      tenant: pick(bookableTenants),
      unit:   pick(orgUnits),
      start, end,
      status: "COMPLETED",
      orgId: alNoor.id, userId: owner.id,
      track: false,
      months,
    });
    reservations.push(r);
    void monthsAgo;
  }

  // 20 currently active monthly (start dates Jan-Apr 2026, duration 3-6 months)
  // Shortened from 3-12 months — long overlapping monthlies were exhausting
  // unit capacity (33 Al Noor units) when combined with the future-monthly +
  // Khareef-span edge cases.
  for (let i = 0; i < 20; i++) {
    const startMonth = pick([1, 2, 3, 4]);
    const start = fixedDate(2026, startMonth, randInt(1, 25));
    const months = randInt(3, 6);
    const end = addDays(start, months * 30);
    const unit = pickFreeUnit(orgUnits, start, end);
    if (!unit) continue;
    const r = await createMonthly({
      tenant: pick(bookableTenants),
      unit,
      start, end,
      status: "CHECKED_IN",
      orgId: alNoor.id, userId: owner.id,
      track: true,
      months,
    });
    reservations.push(r);
  }

  // 7 future monthly (start dates after today)
  for (let i = 0; i < 7; i++) {
    const start = addDays(TODAY, randInt(15, 90));
    const months = randInt(3, 6);
    const end = addDays(start, months * 30);
    const unit = pickFreeUnit(orgUnits, start, end);
    if (!unit) continue;
    const r = await createMonthly({
      tenant: pick(bookableTenants),
      unit,
      start, end,
      status: "CONFIRMED",
      orgId: alNoor.id, userId: owner.id,
      track: true,
      months,
    });
    reservations.push(r);
  }

  // 8 monthly with returns processed (tenant left early)
  // Phase E handles the return rows; here we just create the reservations.
  for (let i = 0; i < 8; i++) {
    const start = fixedDate(2025, 6, 1);
    start.setMonth(start.getMonth() + i);
    const months = 6;
    const end = addDays(start, months * 30);
    const r = await createMonthly({
      tenant: pick(bookableTenants),
      unit:   pick(orgUnits),
      start, end,
      status: "COMPLETED",
      orgId: alNoor.id, userId: owner.id,
      track: false,
      months,
    });
    reservations.push(r);
  }

  /* ── MONTHLY EDGE CASES ─────────────────────────────────────────────── */

  // 2. Full Khareef 2026 span — single monthly stay Jun 28 to Sep 4
  const khareefSpanStart = fixedDate(2026, 6, 28);
  const khareefSpanEnd   = fixedDate(2026, 9, 4);
  const khareefSpanUnit  = pickFreeUnit(orgUnits, khareefSpanStart, khareefSpanEnd);
  if (khareefSpanUnit) {
    const khareefSpan = await createMonthly({
      tenant: pick(bookableTenants),
      unit:   khareefSpanUnit,
      start:  khareefSpanStart,
      end:    khareefSpanEnd,
      status: "CONFIRMED",
      orgId: alNoor.id, userId: owner.id,
      track: true,
      months: 2,
    });
    reservations.push(khareefSpan);
  }

  console.log(`   • ${reservations.length} reservations`);
  console.log(`   • ${reservations.filter((r) => r.invoicesGenerated).length} reservations with invoices generated`);
  console.log("");

  const dailyCount = reservations.filter((r) => r.rateType === "daily").length;
  const monthlyCount = reservations.filter((r) => r.rateType === "monthly").length;

  return {
    reservations,
    created: reservations.length,
    daily: dailyCount,
    monthly: monthlyCount,
  };
}

/* ── Reservation builders ───────────────────────────────────────────────── */

interface CreateOpts {
  tenant: { id: string; organizationId: string };
  unit:   UnitRef;
  start:  Date;
  end:    Date;
  status: string;
  cancelledReason?: string;
  orgId:  string;
  userId: string;
  /** Mark the unit as booked in `activeUsage` so later reservations cannot reuse it. */
  track:  boolean;
  /** Override invoice generation. Default true for non-cancelled. */
  generateInvoices?: boolean;
}

async function createDaily(opts: CreateOpts): Promise<ReservationRef> {
  return createReservation({ ...opts, units: [opts.unit], rateType: "daily" });
}

interface CreateMonthlyOpts extends CreateOpts {
  months: number;
}

async function createMonthly(opts: CreateMonthlyOpts): Promise<ReservationRef> {
  return createReservation({
    tenant: opts.tenant, units: [opts.unit],
    start: opts.start, end: opts.end,
    status: opts.status,
    rateType: "monthly",
    cancelledReason: opts.cancelledReason,
    orgId: opts.orgId, userId: opts.userId,
    track: opts.track,
    generateInvoices: opts.generateInvoices,
    expectedInvoiceCount: opts.months,
  });
}

interface CreateReservationOpts {
  tenant: { id: string; organizationId: string };
  units:  UnitRef[];
  start:  Date;
  end:    Date;
  status: string;
  rateType: "daily" | "monthly";
  cancelledReason?: string;
  orgId:  string;
  userId: string;
  track:  boolean;
  generateInvoices?: boolean;
  expectedInvoiceCount?: number;
}

async function createReservation(opts: CreateReservationOpts): Promise<ReservationRef> {
  const nights = Math.max(1, daysBetween(opts.start, opts.end));
  const subtotalPerUnit = opts.rateType === "daily"
    ? nights * opts.units[0]!.dailyRate
    : Math.ceil(nights / 30) * opts.units[0]!.monthlyRate;
  const grandTotal = opts.units.length * subtotalPerUnit;

  const isCancelled = opts.status === "CANCELLED";
  const isNoShow    = opts.status === "NO_SHOW";
  const isCompleted = opts.status === "COMPLETED";
  const isCheckedIn = opts.status === "CHECKED_IN";

  const actualCheckIn  = isCheckedIn || isCompleted ? opts.start : null;
  const actualCheckOut = isCompleted ? opts.end : null;

  const reservation = await prisma.reservation.create({
    data: {
      startDate:        opts.start,
      endDate:          opts.end,
      actualCheckIn,
      actualCheckOut,
      status:           opts.status as any,
      frequency:        opts.rateType === "monthly" ? "MONTHLY" : "DAILY",
      totalNights:      nights,
      amount:           grandTotal,
      totalAmount:      grandTotal,
      discountAmount:   0,
      taxAmount:        0,
      grandTotal,
      totalPrice:       grandTotal,
      rateType:         opts.rateType,
      source:           "walk_in",
      cancelledReason:  opts.cancelledReason,
      cancelledAt:      isCancelled || isNoShow ? new Date() : null,
      expectedInvoiceCount: opts.expectedInvoiceCount,
      organizationId:   opts.orgId,
      tenantId:         opts.tenant.id,
      unitId:           opts.units[0]!.id, // legacy single-unit pointer
      createdById:      opts.userId,
    },
  });

  // ReservationUnit rows for every unit
  for (const u of opts.units) {
    await prisma.reservationUnit.create({
      data: {
        reservationId: reservation.id,
        unitId:        u.id,
        rateType:      opts.rateType === "monthly" ? "MONTHLY" : "DAILY",
        rateAmount:    opts.rateType === "monthly" ? u.monthlyRate : u.dailyRate,
        rateSource:    "DEFAULT_PRICE",
        nights,
        subtotal:      subtotalPerUnit,
      },
    });
  }

  // CREATED activity
  await prisma.reservationActivity.create({
    data: {
      reservationId:  reservation.id,
      organizationId: opts.orgId,
      action:         "CREATED",
      description:    `Reservation created (${opts.rateType}, ${nights} nights, ${opts.units.length} unit(s))`,
      performedById:  opts.userId,
    },
  });

  // Status-specific activities
  if (isCheckedIn || isCompleted) {
    await prisma.reservationActivity.create({
      data: {
        reservationId:  reservation.id,
        organizationId: opts.orgId,
        action:         "CHECKED_IN",
        description:    `Check-in completed`,
        performedById:  opts.userId,
      },
    });
  }
  if (isCompleted) {
    await prisma.reservationActivity.create({
      data: {
        reservationId:  reservation.id,
        organizationId: opts.orgId,
        action:         "CHECKED_OUT",
        description:    `Check-out completed`,
        performedById:  opts.userId,
      },
    });
  }
  if (isCancelled) {
    await prisma.reservationActivity.create({
      data: {
        reservationId:  reservation.id,
        organizationId: opts.orgId,
        action:         "CANCELLED",
        description:    opts.cancelledReason ?? "Reservation cancelled",
        performedById:  opts.userId,
      },
    });
  }
  if (isNoShow) {
    await prisma.reservationActivity.create({
      data: {
        reservationId:  reservation.id,
        organizationId: opts.orgId,
        action:         "NO_SHOW",
        description:    "Guest did not arrive",
        performedById:  opts.userId,
      },
    });
  }

  if (opts.track) {
    // A CHECKED_IN reservation whose end date is already in the past is an
    // OVERSTAY — the guest is physically still in the unit, so the room is NOT
    // free for a same-day-turnover check-in. Extend its effective occupancy to
    // tomorrow so unitFree() won't hand this unit to an overlapping current
    // in-house stay (which previously produced two CHECKED_IN reservations on
    // one unit). Half-open intervals still allow legitimate back-to-back stays
    // for non-overstaying reservations.
    const isOverstay = opts.status === "CHECKED_IN" && opts.end <= TODAY;
    const effectiveEnd = isOverstay ? addDays(TODAY, 1) : opts.end;
    for (const u of opts.units) markActive(u.id, opts.start, effectiveEnd);
  }

  // Invoices
  let invoicesGenerated = false;
  const shouldGenerate = opts.generateInvoices ?? !(isCancelled || isNoShow);
  if (shouldGenerate) {
    try {
      await generateInvoicesForReservation(reservation.id, opts.orgId, opts.userId);
      invoicesGenerated = true;

      // For cancelled/no-show with invoices, mark them CANCELLED.
      if (isCancelled || isNoShow) {
        await prisma.invoice.updateMany({
          where: { reservationId: reservation.id },
          data:  { status: "CANCELLED", cancelledAt: new Date() },
        });
      }
    } catch (err) {
      // Surface but do not abort the whole seed.
      console.warn(`     warn: invoice generation failed for ${reservation.id}: ${(err as Error).message}`);
    }
  }

  // Mark in-house reservations' units as OCCUPIED
  if (isCheckedIn) {
    await prisma.unit.updateMany({
      where: { id: { in: opts.units.map((u) => u.id) } },
      data:  { status: "OCCUPIED" },
    });
  }

  return {
    id:             reservation.id,
    tenantId:       opts.tenant.id,
    organizationId: opts.orgId,
    rateType:       opts.rateType,
    status:         opts.status,
    startDate:      opts.start,
    endDate:        opts.end,
    invoicesGenerated,
  };
}

// Avoid unused-import warning.
void chance;
