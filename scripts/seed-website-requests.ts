/**
 * Dev helper: (1) seed a couple of PENDING website booking requests for the demo
 * org so the inbox + nav badge are populated, and (2) VERIFY the confirm flow by
 * running the exact reservation-creation transaction and rolling it back (proves
 * it produces a valid reservation without polluting real data).
 *
 * Run: PRISMA_USE_DIRECT_URL=1 npx tsx scripts/seed-website-requests.ts
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUnitPriceForRange } from "@/lib/pricing";
import { collapseToSegments, sumSubtotals, calculateNights, calculateGrandTotal } from "@/lib/reservation-engine";
import { computeUnitPricings } from "@/lib/reservation-pricing";
import { getUnitConflict } from "@/lib/reservation-conflict";
import { generateReservationNumber } from "@/lib/reservation-number";

async function main() {
  const site = await prisma.orgWebsite.findFirst({ where: { slug: "demo" }, select: { id: true, organizationId: true } });
  if (!site) throw new Error("demo site not found — run seed-website.ts first");
  const orgId = site.organizationId;

  const units = await prisma.unit.findMany({
    where: { isActive: true, property: { organizationId: orgId, isArchived: false } },
    select: { id: true, name: true, propertyId: true }, take: 3,
  });
  if (units.length === 0) throw new Error("no units");

  const guests = [
    { name: "Ahmed Al Amri", phone: "96891234567", ci: "2027-01-10", co: "2027-01-13" },
    { name: "Sara Balushi", phone: "96899876543", ci: "2027-02-05", co: "2027-02-08" },
  ];

  // (1) Seed PENDING requests (idempotent-ish: skip if one already pending for the unit+dates).
  for (let i = 0; i < guests.length; i++) {
    const g = guests[i]; const u = units[i % units.length];
    const exists = await prisma.websiteBookingRequest.findFirst({
      where: { organizationId: orgId, unitId: u.id, guestPhone: g.phone, status: "PENDING" }, select: { id: true },
    });
    if (exists) { console.log(`  · request already exists for ${g.name}`); continue; }
    const pr = await getUnitPriceForRange(u.id, new Date(g.ci), new Date(g.co));
    const segs = collapseToSegments(pr.dailyBreakdown);
    const total = sumSubtotals(segs.map((s) => s.subtotal));
    const r = await prisma.websiteBookingRequest.create({
      data: {
        organizationId: orgId, orgWebsiteId: site.id, unitId: u.id, buildingId: u.propertyId,
        guestName: g.name, guestPhone: g.phone, guestEmail: null,
        checkIn: new Date(g.ci), checkOut: new Date(g.co), guestsCount: 2, notes: "Looking forward to Khareef!",
        quotedTotal: total, quotedSegments: segs as unknown as Prisma.InputJsonValue,
        status: "PENDING", source: "website", expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      },
      select: { id: true },
    });
    console.log(`  ✓ seeded PENDING request ${r.id} for ${g.name} · ${u.name}`);
  }

  // (2) Verify confirm → reservation, rolled back (no persistence).
  const u = units[0];
  const ci = new Date("2027-06-10"), co = new Date("2027-06-14");
  const pricings = await computeUnitPricings([u.id], "daily", ci, co);
  const grand = calculateGrandTotal(pricings.map((p) => p.subtotal), 0);
  const nights = calculateNights(ci, co);

  const before = await prisma.reservation.count({ where: { organizationId: orgId } });
  try {
    await prisma.$transaction(async (tx) => {
      const conflict = await getUnitConflict(tx, u.id, u.name, ci, co);
      if (conflict) throw new Error("unexpected conflict on future dates");
      const num = await generateReservationNumber(orgId, tx);
      const res = await tx.reservation.create({
        data: {
          reservationNumber: num, organizationId: orgId, startDate: ci, endDate: co,
          status: "CONFIRMED", rateType: "daily", frequency: "DAILY", source: "website",
          totalNights: nights, amount: grand.grandTotal, totalPrice: grand.grandTotal,
          totalAmount: grand.totalAmount, discountAmount: grand.discountAmount, taxAmount: grand.taxAmount,
          grandTotal: grand.grandTotal, amountPaid: 0,
          tenantId: (await tx.tenant.findFirstOrThrow({ where: { organizationId: orgId }, select: { id: true } })).id,
          unitId: u.id,
        },
      });
      await tx.reservationUnit.createMany({
        data: pricings.map((up) => ({
          reservationId: res.id, unitId: up.unitId, rateType: up.rateType, rateAmount: up.rateAmount,
          rateSource: up.rateSource, seasonalPriceName: up.seasonalPriceName, nights: up.nights,
          subtotal: up.subtotal, pricingSegments: up.pricingSegments as unknown as Prisma.InputJsonValue,
        })),
      });
      console.log(`\n  ✓ CONFIRM VERIFIED: would create reservation ${num} · ${nights} nights · total ${grand.grandTotal}`);
      throw new Error("ROLLBACK");
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (e) {
    if (!(e instanceof Error && e.message === "ROLLBACK")) throw e;
  }
  const after = await prisma.reservation.count({ where: { organizationId: orgId } });
  console.log(`  ✓ rolled back cleanly (reservations before=${before}, after=${after})`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
