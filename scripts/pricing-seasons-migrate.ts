/**
 * Group per-unit SEASONAL UnitPrice rows into central Seasons (Pricing
 * Management, Roadmap item 6) — WITHOUT changing any price.
 *
 * Grouping: same organization + exact same name, start/end date, priority,
 * isActive and disallowMonthly → one Season. (No fuzzy matching: "Khareef Peak
 * Rate" and "Khareef 2026 Peak Rate" stay separate; merge them in the UI.)
 *
 * Per group:
 *   - propertyIds     = the buildings of the units that had the row
 *   - SeasonRate(type) = the most common (daily, weekly, monthly) among that
 *                        unit type's units in the group
 *   - SeasonRate(unit) = an override for every unit whose rate differs
 *   - excludedUnitIds  = units of a rated type in those buildings that did NOT
 *                        have the row (so they keep their current prices)
 * Then the migrated UnitPrice rows are deleted.
 *
 * Safety: everything runs in ONE transaction, and before committing it
 * re-prices every unit of every affected organization for every night from 7
 * days before the earliest season to 7 days after the latest — old rows vs new
 * loader — plus the monthly-block check. Any difference → throw → rollback.
 *
 * Dry run (default — reports, writes nothing):
 *   PRISMA_USE_DIRECT_URL=1 npx tsx --env-file=.env scripts/pricing-seasons-migrate.ts
 * Execute:
 *   PRISMA_USE_DIRECT_URL=1 npx tsx --env-file=.env scripts/pricing-seasons-migrate.ts --confirm
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { resolvePrice } from "../lib/pricing";
import { loadUnitPriceRows, type PriceRow } from "../lib/unit-prices";

const CONFIRM = process.argv.includes("--confirm");
const DAY = 24 * 60 * 60 * 1000;
const dec = (v: Prisma.Decimal | null) => (v === null ? null : v.toFixed(3));
const tupleKey = (d: Prisma.Decimal, w: Prisma.Decimal | null, m: Prisma.Decimal) => `${dec(d)}|${dec(w)}|${dec(m)}`;

type Legacy = Prisma.UnitPriceGetPayload<{ include: { unit: { select: { id: true; unitType: true; propertyId: true; property: { select: { organizationId: true } } } } } }>;

async function main() {
  console.log(CONFIRM ? "EXECUTING (single transaction, verified before commit)\n" : "DRY RUN (pass --confirm to write)\n");

  const legacy: Legacy[] = await prisma.unitPrice.findMany({
    where: { priceType: "SEASONAL" },
    include: { unit: { select: { id: true, unitType: true, propertyId: true, property: { select: { organizationId: true } } } } },
  });
  const skipped = legacy.filter((r) => !r.startDate || !r.endDate);
  const rows = legacy.filter((r) => r.startDate && r.endDate);

  // group
  const groups = new Map<string, Legacy[]>();
  for (const r of rows) {
    const k = [r.unit.property.organizationId, (r.name ?? "").trim(), r.startDate!.toISOString(), r.endDate!.toISOString(), r.priority, r.isActive, r.disallowMonthly].join("§");
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }

  // plan each season
  type Plan = {
    orgId: string;
    first: Legacy;
    propertyIds: string[];
    typeRates: { unitType: string; row: Legacy }[];
    overrides: Legacy[];
    excludedUnitIds: string[];
    legacyIds: string[];
  };
  const plans: Plan[] = [];
  for (const g of groups.values()) {
    const first = g[0];
    const orgId = first.unit.property.organizationId;
    const propertyIds = [...new Set(g.map((r) => r.unit.propertyId))];
    const byType = new Map<string, Legacy[]>();
    for (const r of g) byType.set(r.unit.unitType, [...(byType.get(r.unit.unitType) ?? []), r]);

    const typeRates: { unitType: string; row: Legacy }[] = [];
    const overrides: Legacy[] = [];
    for (const [unitType, list] of byType) {
      const counts = new Map<string, Legacy[]>();
      for (const r of list) {
        const k = tupleKey(r.dailyRate, r.weeklyRate, r.monthlyRate);
        counts.set(k, [...(counts.get(k) ?? []), r]);
      }
      const [modeKey, modeRows] = [...counts.entries()].sort((a, b) => b[1].length - a[1].length)[0];
      typeRates.push({ unitType, row: modeRows[0] });
      for (const [k, rs] of counts) if (k !== modeKey) overrides.push(...rs);
    }
    const haveIds = new Set(g.map((r) => r.unitId));
    const excluded = await prisma.unit.findMany({
      where: { propertyId: { in: propertyIds }, unitType: { in: [...byType.keys()] }, id: { notIn: [...haveIds] } },
      select: { id: true },
    });
    plans.push({ orgId, first, propertyIds, typeRates, overrides, excludedUnitIds: excluded.map((u) => u.id), legacyIds: g.map((r) => r.id) });
  }

  // report
  console.log(`Legacy seasonal rows: ${legacy.length} (${skipped.length} without dates — left untouched)`);
  console.log(`→ ${plans.length} central seasons\n`);
  for (const p of plans.sort((a, b) => b.legacyIds.length - a.legacyIds.length)) {
    console.log(
      `• "${p.first.name ?? ""}"  ${p.first.startDate!.toISOString().slice(0, 10)} → ${p.first.endDate!.toISOString().slice(0, 10)}  prio ${p.first.priority}${p.first.isActive ? "" : " (inactive)"}${p.first.disallowMonthly ? " no-monthly" : ""}\n` +
        `    ${p.legacyIds.length} units, ${p.propertyIds.length} building(s); type rates: ${p.typeRates.map((t) => `${t.unitType}=${dec(t.row.dailyRate)}`).join(", ")}; overrides: ${p.overrides.length}; excluded: ${p.excludedUnitIds.length}`,
    );
  }
  if (!CONFIRM) return;

  const orgIds = [...new Set(plans.map((p) => p.orgId))];
  const allUnits = await prisma.unit.findMany({ where: { property: { organizationId: { in: orgIds } } }, select: { id: true, basePrice: true } });
  const unitIds = allUnits.map((u) => u.id);
  const base = new Map(allUnits.map((u) => [u.id, Number(u.basePrice)]));
  const before = await loadUnitPriceRows(unitIds); // no Seasons yet → exactly the legacy rows
  const minStart = Math.min(...rows.map((r) => r.startDate!.getTime())) - 7 * DAY;
  const maxEnd = Math.max(...rows.map((r) => r.endDate!.getTime())) + 7 * DAY;

  await prisma.$transaction(
    async (tx) => {
      for (const p of plans) {
        const season = await tx.season.create({
          data: {
            organizationId: p.orgId,
            name: (p.first.name ?? "Season").trim() || "Season",
            startDate: p.first.startDate!,
            endDate: p.first.endDate!,
            priority: p.first.priority,
            isActive: p.first.isActive,
            disallowMonthly: p.first.disallowMonthly,
            propertyIds: p.propertyIds,
            excludedUnitIds: p.excludedUnitIds,
          },
        });
        await tx.seasonRate.createMany({
          data: [
            ...p.typeRates.map((t) => ({ seasonId: season.id, unitType: t.unitType, dailyRate: t.row.dailyRate, weeklyRate: t.row.weeklyRate, monthlyRate: t.row.monthlyRate })),
            ...p.overrides.map((r) => ({ seasonId: season.id, unitId: r.unitId, dailyRate: r.dailyRate, weeklyRate: r.weeklyRate, monthlyRate: r.monthlyRate })),
          ],
        });
        await tx.unitPrice.deleteMany({ where: { id: { in: p.legacyIds } } });
      }

      // ── verify: every unit, every night, old vs new ──
      const after = await loadUnitPriceRows(unitIds, tx);
      let checks = 0;
      const sig = (r: ReturnType<typeof resolvePrice>) =>
        r ? `${r.priceType}|${r.name ?? ""}|${r.dailyRate.toFixed(3)}|${r.weeklyRate?.toFixed(3) ?? ""}|${r.monthlyRate.toFixed(3)}|${r.priority}` : "none";
      for (const id of unitIds) {
        const b = before.get(id) ?? [], a = after.get(id) ?? [];
        for (let t = minStart; t <= maxEnd; t += DAY) {
          const d = new Date(t);
          const x = sig(resolvePrice(b, d, base.get(id))), y = sig(resolvePrice(a, d, base.get(id)));
          checks++;
          if (x !== y) throw new Error(`PRICE MISMATCH unit ${id} on ${d.toISOString().slice(0, 10)}: before ${x} / after ${y}`);
        }
        // monthly-block flag must be identical too
        const blk = (rs: PriceRow[]) => rs.filter((r) => r.priceType === "SEASONAL" && r.isActive && r.disallowMonthly).map((r) => `${r.startDate?.toISOString()}|${r.endDate?.toISOString()}`).sort().join(",");
        if (blk(b) !== blk(a)) throw new Error(`MONTHLY-BLOCK MISMATCH unit ${id}: ${blk(b)} / ${blk(a)}`);
      }
      console.log(`\nVerified ${checks.toLocaleString()} unit-nights: identical prices. Committing.`);
    },
    { timeout: 120_000, maxWait: 20_000 },
  );
  console.log(`Done: ${plans.length} seasons created, ${plans.reduce((s, p) => s + p.legacyIds.length, 0)} per-unit rows replaced.`);
}

main()
  .catch((e) => { console.error("\nROLLED BACK —", e.message ?? e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
