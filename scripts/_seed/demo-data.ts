/* ============================================================================
 *  Demo Tour seeder — creates a busy, realistic dataset inside an EXISTING
 *  demo organization (org + owner user already created by app/demo/actions.ts
 *  via the same auth pattern as team invites). Every date is relative to
 *  "today" at call time — never hardcoded — so the demo stays fresh forever.
 *
 *  Design goals (this is the sandbox a visitor lands in seconds after
 *  clicking "Demo Tour" — see CLAUDE.md "Demo Tour" / Phase 1 spec):
 *    - Fast: batched createMany + Promise.all wherever rows don't depend on
 *      each other, instead of the sequential per-row awaits the older
 *      seed-demo-video-org.ts / _seed/setup.ts scripts use.
 *    - Correct: reservations must never double-book a unit. We replicate the
 *      exact overlap semantics the API route enforces in
 *      lib/reservation-conflict.ts (half-open interval, CANCELLED/NO_SHOW/
 *      COMPLETED are non-blocking) via an in-memory tracker, since seeding
 *      writes directly through Prisma and bypasses that route's DB-transaction
 *      check entirely.
 *    - Every screen must show data: buildings, units, tenants, a busy
 *      reservation mix (in-house, arriving, overstay, Khareef-priced,
 *      monthly recurring, completed history), invoices/payments in varied
 *      states, expenses, and today's cashier movement.
 * ========================================================================= */

import { prisma } from "@/lib/prisma";
import { generateInvoicesForReservation } from "@/lib/invoice-engine";
import {
  MALE_FIRST,
  FEMALE_FIRST,
  SURNAMES,
  ARABIC_NAMES,
  CORPORATE_NAMES,
} from "./omani-names";

/* ── local, concurrency-safe RNG (the shared _seed/rand.ts module keeps
 *   mutable state at module scope, which is unsafe if two demo requests
 *   seed concurrently — each call here gets its own closure) ──────────── */
function makeRng() {
  let state = (Date.now() ^ (Math.random() * 0xffffffff)) | 0;
  function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    randInt: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)]!,
  };
}

/* ── date helpers — always relative to "now" at call time ──────────────── */
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Maps `items` through `fn` with at most `limit` in flight at once. The
 *  pooled connection (pgbouncer, 13 connections — see DATABASE_URL) can't
 *  sustain one connection per row for anything beyond a handful of rows;
 *  unbounded Promise.all here silently starves the pool and DB calls start
 *  failing with P2024 instead of just running a bit slower. */
async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** The Khareef window (Jul 1 – Aug 31) for whichever year makes it current
 *  or soonest-upcoming relative to `today` — never a hardcoded year. */
function khareefWindow(today: Date): { start: Date; end: Date } {
  const year = today.getMonth() >= 8 ? today.getFullYear() + 1 : today.getFullYear();
  return {
    start: new Date(year, 6, 1), // Jul 1
    end: new Date(year, 7, 31, 23, 59, 59, 999), // Aug 31
  };
}

/** The most recent Khareef window that has already started relative to
 *  `today` — used to pick dates for the demo reservation that showcases
 *  seasonal pricing, so it reads as a recent/current booking rather than
 *  (when today is after Aug 31) a stay booked nearly a year in advance. */
function mostRecentKhareefWindow(today: Date): { start: Date; end: Date } {
  const year = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  return {
    start: new Date(year, 6, 1),
    end: new Date(year, 7, 31, 23, 59, 59, 999),
  };
}

/* ── overlap tracker — mirrors lib/reservation-conflict.ts getUnitConflict:
 *   half-open interval overlap, CANCELLED/NO_SHOW/COMPLETED never block. ── */
const NON_BLOCKING = new Set(["CANCELLED", "NO_SHOW", "COMPLETED"]);
class UnitLedger {
  private bookings = new Map<string, { start: Date; end: Date; status: string }[]>();

  isFree(unitId: string, start: Date, end: Date): boolean {
    const existing = this.bookings.get(unitId) ?? [];
    return existing.every((b) => {
      if (NON_BLOCKING.has(b.status)) return true;
      return !(start < b.end && end > b.start);
    });
  }

  book(unitId: string, start: Date, end: Date, status: string): void {
    const list = this.bookings.get(unitId) ?? [];
    list.push({ start, end, status });
    this.bookings.set(unitId, list);
  }
}

/* ── unit mix — 2 buildings, ~20 units, mixed types, Khareef pricing ────── */
const UNIT_MIX: Array<{
  building: 0 | 1;
  type: "STUDIO" | "ONE_BR" | "TWO_BR";
  floor: number;
  name: string;
  daily: number;
  monthly: number;
}> = [
  // مبنى النور (Al Haffa) — 10 units
  { building: 0, type: "STUDIO", floor: 1, name: "101", daily: 22, monthly: 320 },
  { building: 0, type: "STUDIO", floor: 1, name: "102", daily: 22, monthly: 320 },
  { building: 0, type: "ONE_BR", floor: 1, name: "103", daily: 30, monthly: 420 },
  { building: 0, type: "ONE_BR", floor: 2, name: "201", daily: 32, monthly: 440 },
  { building: 0, type: "ONE_BR", floor: 2, name: "202", daily: 32, monthly: 440 },
  { building: 0, type: "TWO_BR", floor: 2, name: "203", daily: 45, monthly: 620 },
  { building: 0, type: "TWO_BR", floor: 3, name: "301", daily: 48, monthly: 650 },
  { building: 0, type: "ONE_BR", floor: 3, name: "302", daily: 33, monthly: 450 },
  { building: 0, type: "TWO_BR", floor: 4, name: "401", daily: 50, monthly: 680 },
  { building: 0, type: "STUDIO", floor: 4, name: "402", daily: 24, monthly: 340 },

  // شقق الخريف (Al Dahariz) — 10 units
  { building: 1, type: "STUDIO", floor: 1, name: "K-101", daily: 20, monthly: 300 },
  { building: 1, type: "STUDIO", floor: 1, name: "K-102", daily: 20, monthly: 300 },
  { building: 1, type: "ONE_BR", floor: 1, name: "K-103", daily: 28, monthly: 400 },
  { building: 1, type: "ONE_BR", floor: 2, name: "K-201", daily: 30, monthly: 420 },
  { building: 1, type: "ONE_BR", floor: 2, name: "K-202", daily: 30, monthly: 420 },
  { building: 1, type: "TWO_BR", floor: 2, name: "K-203", daily: 42, monthly: 580 },
  { building: 1, type: "TWO_BR", floor: 3, name: "K-301", daily: 44, monthly: 600 },
  { building: 1, type: "ONE_BR", floor: 3, name: "K-302", daily: 31, monthly: 430 },
  { building: 1, type: "TWO_BR", floor: 4, name: "K-401", daily: 46, monthly: 630 },
  { building: 1, type: "STUDIO", floor: 4, name: "K-402", daily: 21, monthly: 310 },
];

const EXPENSE_CATEGORIES = [
  { name: "Maintenance", nameAr: "صيانة", icon: "🔧" },
  { name: "Cleaning", nameAr: "تنظيف", icon: "🧹" },
  { name: "Supplies", nameAr: "مستلزمات", icon: "📦" },
  { name: "Utilities", nameAr: "خدمات", icon: "💡" },
  { name: "Transportation", nameAr: "نقل", icon: "🚗" },
  { name: "Food", nameAr: "طعام", icon: "🍽️" },
  { name: "Other", nameAr: "أخرى", icon: "📋" },
];

export interface SeedDemoResult {
  buildings: number;
  units: number;
  tenants: number;
  reservations: number;
  invoices: number;
  payments: number;
  expenses: number;
  elapsedMs: number;
}

/**
 * Seed a full demo dataset into an already-created org + owner user.
 * Everything after unit creation runs in parallel batches — the only
 * unavoidable sequential cost is invoice generation per reservation
 * (real business logic, run via Promise.all across reservations).
 */
export async function seedDemoOrg(orgId: string, userId: string): Promise<SeedDemoResult> {
  const started = Date.now();
  const rng = makeRng();
  const today = startOfDay(new Date());
  const khareef = khareefWindow(today);
  const recentKhareef = mostRecentKhareefWindow(today);

  // ── Buildings (parallel) ────────────────────────────────────────────────
  const [buildingNoor, buildingKhareef] = await Promise.all([
    prisma.property.create({
      data: {
        name: "مبنى النور",
        type: "RESIDENTIAL",
        organizationId: orgId,
        city: "Al Haffa",
        address: "Al Haffa, Salalah",
        totalFloors: 4,
        amenities: ["Wi-Fi", "Free Parking", "Elevator"],
      },
    }),
    prisma.property.create({
      data: {
        name: "شقق الخريف",
        type: "RESIDENTIAL",
        organizationId: orgId,
        city: "Al Dahariz",
        address: "Al Dahariz, Salalah",
        totalFloors: 4,
        amenities: ["Wi-Fi", "Free Parking", "Garden View"],
      },
    }),
  ]);
  const buildings = [buildingNoor, buildingKhareef];

  // ── Units (bounded concurrency; each returns its id so we can attach
  //    prices without a second query round-trip) ─────────────────────────
  const units = await mapLimit(UNIT_MIX, 8, (u) =>
    prisma.unit.create({
      data: {
        name: u.name,
        unitType: u.type,
        floor: u.floor,
        bedrooms: u.type === "STUDIO" ? 0 : u.type === "ONE_BR" ? 1 : 2,
        bathrooms: u.type === "TWO_BR" ? 2 : 1,
        basePrice: u.daily,
        propertyId: buildings[u.building].id,
        amenities: ["Air conditioning", "Wi-Fi", "Kitchen"],
      },
    }),
  );

  // ── Unit prices — DEFAULT + Khareef SEASONAL per unit, one batched insert
  await prisma.unitPrice.createMany({
    data: units.flatMap((unit, i) => {
      const spec = UNIT_MIX[i];
      return [
        {
          priceType: "DEFAULT",
          dailyRate: spec.daily,
          monthlyRate: spec.monthly,
          priority: 1,
          isActive: true,
          unitId: unit.id,
        },
        {
          priceType: "SEASONAL",
          name: "Khareef Peak Rate",
          dailyRate: round3(spec.daily * 1.6),
          monthlyRate: spec.monthly,
          startDate: khareef.start,
          endDate: khareef.end,
          priority: 20,
          isActive: true,
          unitId: unit.id,
        },
        // Also price the most recent past Khareef window so the demo
        // reservation that showcases seasonal pricing (below) can be dated
        // recently rather than up to a year in the future.
        ...(khareef.start.getTime() !== recentKhareef.start.getTime()
          ? [{
              priceType: "SEASONAL",
              name: "Khareef Peak Rate",
              dailyRate: round3(spec.daily * 1.6),
              monthlyRate: spec.monthly,
              startDate: recentKhareef.start,
              endDate: recentKhareef.end,
              priority: 20,
              isActive: true,
              unitId: unit.id,
            }]
          : []),
      ];
    }),
  });

  // ── Expense categories (batched) ────────────────────────────────────────
  await prisma.expenseCat.createMany({
    data: EXPENSE_CATEGORIES.map((c, i) => ({
      organizationId: orgId,
      name: c.name,
      nameAr: c.nameAr,
      icon: c.icon,
      isSystem: true,
      isActive: true,
      sortOrder: i,
    })),
  });
  const expenseCats = await prisma.expenseCat.findMany({ where: { organizationId: orgId } });
  const catByName = new Map(expenseCats.map((c) => [c.name, c]));

  // ── Tenants (parallel) — ~15, mixed individual/family/corporate, 1 VIP ──
  const usedNames = new Set<string>();
  function uniqueName(): { first: string; last: string } {
    for (let tries = 0; tries < 50; tries++) {
      const isMale = rng.pick([true, false]);
      const first = isMale ? rng.pick(MALE_FIRST) : rng.pick(FEMALE_FIRST);
      const last = rng.pick(SURNAMES);
      const key = `${first} ${last}`;
      if (!usedNames.has(key)) {
        usedNames.add(key);
        return { first, last };
      }
    }
    return { first: "Salim", last: `Al Balushi ${usedNames.size}` };
  }

  const tenantSpecs = Array.from({ length: 15 }, (_, i) => {
    if (i === 0) {
      // VIP individual, guaranteed
      const { first, last } = uniqueName();
      return {
        firstName: first,
        lastName: last,
        fullNameArabic: ARABIC_NAMES[i % ARABIC_NAMES.length].full,
        phone: `+968 9${rng.randInt(100000, 999999)}`,
        tenantType: "individual" as const,
        classification: "vip" as const,
        corporateName: null as string | null,
      };
    }
    const kind = rng.randInt(1, 10);
    if (kind <= 2) {
      const corp = rng.pick(CORPORATE_NAMES);
      return {
        firstName: corp,
        lastName: "",
        fullNameArabic: null,
        phone: `+968 9${rng.randInt(100000, 999999)}`,
        tenantType: "corporate" as const,
        classification: "regular" as const,
        corporateName: corp,
      };
    }
    const { first, last } = uniqueName();
    return {
      firstName: first,
      lastName: last,
      fullNameArabic: ARABIC_NAMES[i % ARABIC_NAMES.length]?.full ?? null,
      phone: `+968 9${rng.randInt(100000, 999999)}`,
      tenantType: (kind <= 5 ? "family" : "individual") as "family" | "individual",
      classification: "regular" as const,
      corporateName: null as string | null,
    };
  });

  const tenants = await mapLimit(tenantSpecs, 8, (t) =>
    prisma.tenant.create({
      data: {
        firstName: t.firstName,
        lastName: t.lastName,
        fullNameArabic: t.fullNameArabic,
        phone: t.phone,
        nationality: "Omani",
        tenantType: t.tenantType,
        classification: t.classification,
        corporateName: t.corporateName,
        organizationId: orgId,
        createdById: userId,
      },
    }),
  );

  // ── Reservations — busy, slightly messy mix, no double-booking ─────────
  const ledger = new UnitLedger();
  type ResPlan = {
    unit: (typeof units)[number];
    spec: (typeof UNIT_MIX)[number];
    tenant: (typeof tenants)[number];
    start: Date;
    end: Date;
    status: "CONFIRMED" | "CHECKED_IN" | "COMPLETED";
    frequency: "DAILY" | "MONTHLY";
    actualCheckIn?: Date;
    paidRatio: number; // 0 = unpaid, 1 = fully paid, else partial
    notes?: string;
  };

  const plans: ResPlan[] = [];
  let unitCursor = 0;
  function nextUnit() {
    const u = units[unitCursor % units.length];
    const spec = UNIT_MIX[unitCursor % units.length];
    unitCursor++;
    return { unit: u, spec };
  }
  function nextTenant(usedIdx: Set<number>) {
    let idx = rng.randInt(1, tenants.length - 1);
    let tries = 0;
    while (usedIdx.has(idx) && tries < 20) {
      idx = rng.randInt(1, tenants.length - 1);
      tries++;
    }
    usedIdx.add(idx);
    return tenants[idx];
  }
  const usedTenantIdx = new Set<number>();

  // 5 currently in-house (checked in, spanning today)
  for (let i = 0; i < 5; i++) {
    const { unit, spec } = nextUnit();
    const start = addDays(today, -rng.randInt(1, 4));
    const end = addDays(today, rng.randInt(2, 6));
    plans.push({
      unit, spec, tenant: nextTenant(usedTenantIdx), start, end,
      status: "CHECKED_IN", frequency: "DAILY", actualCheckIn: start,
      paidRatio: rng.pick([1, 1, 0.5]),
    });
  }

  // 2 arriving today (confirmed, start = today)
  for (let i = 0; i < 2; i++) {
    const { unit, spec } = nextUnit();
    const start = today;
    const end = addDays(today, rng.randInt(2, 5));
    plans.push({
      unit, spec, tenant: nextTenant(usedTenantIdx), start, end,
      status: "CONFIRMED", frequency: "DAILY", paidRatio: rng.pick([0, 0.3]),
    });
  }

  // 1 departing today (checked in, end = today)
  {
    const { unit, spec } = nextUnit();
    const start = addDays(today, -rng.randInt(2, 4));
    const end = today;
    plans.push({
      unit, spec, tenant: nextTenant(usedTenantIdx), start, end,
      status: "CHECKED_IN", frequency: "DAILY", actualCheckIn: start, paidRatio: 1,
    });
  }

  // 1 overstay (checked in, end = 2 days ago — still not checked out)
  {
    const { unit, spec } = nextUnit();
    const start = addDays(today, -6);
    const end = addDays(today, -2);
    plans.push({
      unit, spec, tenant: nextTenant(usedTenantIdx), start, end,
      status: "CHECKED_IN", frequency: "DAILY", actualCheckIn: start, paidRatio: 1,
      notes: "Guest requested extension — overstay in progress.",
    });
  }

  // 1 reservation crossing into Khareef (seasonal rate visibly applied) —
  // dated around the most recent Khareef window so it reads as a recent
  // booking rather than one made up to a year in advance.
  {
    const { unit, spec } = nextUnit();
    const start = addDays(recentKhareef.start, -5);
    const end = addDays(recentKhareef.start, 5);
    plans.push({
      unit, spec, tenant: nextTenant(usedTenantIdx), start, end,
      status: "COMPLETED",
      frequency: "DAILY",
      actualCheckIn: start,
      paidRatio: 0.4,
      notes: "Stay spanned the Khareef season — seasonal rate applied from Jul 1.",
    });
  }

  // 1 long-term monthly tenant (recurring invoices)
  {
    const { unit, spec } = nextUnit();
    const start = addMonths(today, -2);
    const end = addMonths(today, 4);
    plans.push({
      unit, spec, tenant: nextTenant(usedTenantIdx), start, end,
      status: "CHECKED_IN", frequency: "MONTHLY", actualCheckIn: start, paidRatio: 1,
    });
  }

  // a few completed past reservations (history)
  for (let i = 0; i < 4; i++) {
    const { unit, spec } = nextUnit();
    const start = addDays(today, -rng.randInt(20, 60));
    const end = addDays(start, rng.randInt(2, 7));
    plans.push({
      unit, spec, tenant: nextTenant(usedTenantIdx), start, end,
      status: "COMPLETED", frequency: "DAILY",
      actualCheckIn: start, paidRatio: 1,
    });
  }

  // Resolve unit conflicts: nudge any accidental overlap on a reused unit
  // forward by a week until free (units cycle every 20 plans, so with ~14
  // plans this rarely triggers, but stay correct regardless).
  for (const p of plans) {
    let guard = 0;
    while (!ledger.isFree(p.unit.id, p.start, p.end) && guard < 20) {
      const shift = 7;
      p.start = addDays(p.start, shift);
      p.end = addDays(p.end, shift);
      guard++;
    }
    ledger.book(p.unit.id, p.start, p.end, p.status);
  }

  // ── Create reservations + reservationUnits (bounded concurrency) ───────
  let resSeq = 1;
  const year = today.getFullYear();
  const createdReservations = await mapLimit(plans, 6, async (p) => {
      const nights = Math.max(1, Math.round((p.end.getTime() - p.start.getTime()) / 86_400_000));
      const rate = p.frequency === "MONTHLY" ? p.spec.monthly : p.spec.daily;
      const amount =
        p.frequency === "MONTHLY"
          ? round3(rate * Math.max(1, Math.round(nights / 30)))
          : round3(rate * nights);

      const reservation = await prisma.reservation.create({
        data: {
          reservationNumber: `DEMO-${year}-${String(resSeq++).padStart(5, "0")}`,
          organizationId: orgId,
          startDate: p.start,
          endDate: p.end,
          actualCheckIn: p.actualCheckIn,
          status: p.status,
          frequency: p.frequency,
          rateType: p.frequency === "MONTHLY" ? "monthly" : "daily",
          source: "walk_in",
          totalNights: nights,
          amount,
          totalAmount: amount,
          grandTotal: amount,
          amountPaid: 0,
          notes: p.notes,
          tenantId: p.tenant.id,
          unitId: p.unit.id,
          createdById: userId,
        },
      });
      await prisma.reservationUnit.create({
        data: {
          reservationId: reservation.id,
          unitId: p.unit.id,
          rateType: p.frequency === "MONTHLY" ? "monthly" : "daily",
          rateAmount: rate,
          rateSource: "DEFAULT",
          nights,
          subtotal: amount,
        },
      });
      if (p.status === "CHECKED_IN") {
        await prisma.unit.update({ where: { id: p.unit.id }, data: { status: "OCCUPIED" } });
      }
      return { reservation, plan: p, amount };
  });

  // ── Invoices — real business logic, run with bounded concurrency across
  //    reservations. nextInvoiceNumber() (lib/invoice-engine.ts) takes a
  //    pessimistic per-org row lock (SELECT ... FOR UPDATE) before reading
  //    the current max invoice number, so concurrent callers safely queue
  //    for the lock instead of racing onto the same number. ─────────────
  const invoiceFailures: string[] = [];
  await mapLimit(createdReservations, 4, async ({ reservation }) => {
    try {
      await generateInvoicesForReservation(reservation.id, orgId, userId);
    } catch (err) {
      console.error(`[seedDemoOrg] invoice generation failed for ${reservation.id}:`, err);
      invoiceFailures.push(reservation.id);
    }
  });
  if (invoiceFailures.length > 0) {
    throw new Error(
      `Invoice generation failed for ${invoiceFailures.length}/${createdReservations.length} reservations`,
    );
  }

  // ── Payments — allocate against each reservation's invoices per paidRatio
  const invoicesByReservation = await prisma.invoice.findMany({
    where: { reservationId: { in: createdReservations.map((c) => c.reservation.id) } },
    orderBy: { periodStart: "asc" },
  });
  const invByRes = new Map<string, typeof invoicesByReservation>();
  for (const inv of invoicesByReservation) {
    if (!inv.reservationId) continue;
    const list = invByRes.get(inv.reservationId) ?? [];
    list.push(inv);
    invByRes.set(inv.reservationId, list);
  }

  let paySeq = 1;
  let paymentCount = 0;
  await mapLimit(createdReservations, 5, async ({ reservation, plan }) => {
      const invoices = (invByRes.get(reservation.id) ?? []).filter(
        (i) => i.status !== "DRAFT" && i.status !== "CANCELLED",
      );
      if (invoices.length === 0) return;

      for (const inv of invoices) {
        const total = Number(inv.totalAmount);
        const payAmount = round3(total * plan.paidRatio);
        if (payAmount <= 0) continue;

        const payment = await prisma.payment.create({
          data: {
            paymentNumber: `DEMO-PAY-${year}-${String(paySeq++).padStart(5, "0")}`,
            organizationId: orgId,
            tenantId: plan.tenant.id,
            reservationId: reservation.id,
            invoiceId: inv.id,
            amount: payAmount,
            method: rng.pick(["CASH", "CARD", "BANK_TRANSFER"]),
            receivedById: userId,
          },
        });
        await prisma.paymentAllocation.create({
          data: { paymentId: payment.id, invoiceId: inv.id, organizationId: orgId, amount: payAmount },
        });
        const newStatus = payAmount >= total ? "PAID" : "PARTIALLY_PAID";
        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            status: newStatus,
            amountPaid: payAmount,
            balanceDue: round3(total - payAmount),
            paidDate: newStatus === "PAID" ? new Date() : null,
          },
        });
        paymentCount++;
      }
  });

  // ── One overdue-30+ invoice: force a DRAFT→PENDING invoice with an old
  //    due date on the completed-history reservations so aging reports and
  //    the "outstanding" tab have a genuinely overdue item to show ───────
  const historicalResIds = createdReservations
    .filter((c) => c.plan.status === "COMPLETED")
    .map((c) => c.reservation.id);
  const overdueInvoice = invoicesByReservation.find(
    (i) => historicalResIds.includes(i.reservationId ?? "") && i.status !== "CANCELLED",
  );
  if (overdueInvoice) {
    await prisma.invoice.update({
      where: { id: overdueInvoice.id },
      data: {
        status: "PENDING",
        issueDate: addDays(today, -45),
        dueDate: addDays(today, -35),
        amountPaid: 0,
        balanceDue: overdueInvoice.totalAmount,
      },
    });
  }

  // ── Expenses across categories/states ───────────────────────────────────
  const expenseStatuses = ["PENDING", "APPROVED", "PROCESSED", "PROCESSED", "APPROVED"] as const;
  await prisma.expense.createMany({
    data: expenseStatuses.map((status, i) => {
      const cat = catByName.get(
        ["Maintenance", "Cleaning", "Supplies", "Utilities", "Transportation"][i],
      )!;
      return {
        expenseNumber: `DEMO-EXP-${year}-${String(i + 1).padStart(5, "0")}`,
        organizationId: orgId,
        categoryId: cat.id,
        description: `${cat.name} — ${buildings[i % 2].name}`,
        amount: round3(rng.randInt(20, 220)),
        propertyId: buildings[i % 2].id,
        status,
        submittedById: userId,
        reviewedById: status !== "PENDING" ? userId : null,
        processedById: status === "PROCESSED" ? userId : null,
        paymentMethod: status === "PROCESSED" ? "petty_cash" : null,
      };
    }),
  });

  // ── Cashier daybook — a cash drawer + today's open reconciliation with
  //    an opening balance and today's cash movements already reflected ───
  const cashDrawer = await prisma.bankAccount.create({
    data: {
      organizationId: orgId,
      type: "CASH",
      bankName: "Cash Drawer",
      label: "Main Cashier",
      propertyId: buildings[0].id,
      openingBalance: 150,
      isActive: true,
      isDefault: true,
    },
  }).catch(() => null);
  if (cashDrawer) {
    const todaysCashPayments = round3(rng.randInt(30, 120));
    await prisma.cashierSession.create({
      data: {
        organizationId: orgId,
        propertyId: buildings[0].id,
        cashierId: userId,
        businessDate: today,
        openingBalance: 150,
        closingBalance: round3(150 + todaysCashPayments),
        systemCash: round3(150 + todaysCashPayments),
        status: "OPEN",
      },
    }).catch(() => {});
  }

  return {
    buildings: buildings.length,
    units: units.length,
    tenants: tenants.length,
    reservations: createdReservations.length,
    invoices: invoicesByReservation.length,
    payments: paymentCount,
    expenses: expenseStatuses.length,
    elapsedMs: Date.now() - started,
  };
}
