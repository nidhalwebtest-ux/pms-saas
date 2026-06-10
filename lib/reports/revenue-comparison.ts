import { getRevenueByBuilding } from "./revenue-by-building";

/**
 * Revenue Comparison — net revenue this period vs the equal-length period
 * immediately before it, per building. Reuses getRevenueByBuilding for both
 * windows and merges by building, computing Δ and Δ%.
 */

const DAY = 86_400_000;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const toDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export interface CmpBuilding {
  id: string;
  name: string;
  current: number;
  prior: number;
  delta: number;
  deltaPct: number | null;   // null when prior is 0 (no baseline → "new")
}
export interface CmpReport {
  kpis: {
    current: number;
    prior: number;
    delta: number;
    deltaPct: number | null;
    buildingCount: number;
  };
  buildings: CmpBuilding[];
  priorFrom: string;   // ISO yyyy-mm-dd
  priorTo: string;
  rangeDays: number;
}

export async function getRevenueComparison(params: {
  orgId: string; from: Date; to: Date; propertyId?: string;
}): Promise<CmpReport> {
  const { orgId, from, to, propertyId } = params;
  const fromMs = toDay(from);
  const toExclusiveMs = toDay(to) + DAY;
  const rangeDays = Math.max(1, Math.round((toExclusiveMs - fromMs) / DAY));

  const priorToExclusiveMs = fromMs;
  const priorFromMs = fromMs - rangeDays * DAY;
  const priorFrom = new Date(priorFromMs);
  const priorTo = new Date(priorToExclusiveMs - DAY);

  const [cur, prev] = await Promise.all([
    getRevenueByBuilding({ orgId, from, to, propertyId }),
    getRevenueByBuilding({ orgId, from: priorFrom, to: priorTo, propertyId }),
  ]);

  const priorById = new Map(prev.buildings.map((b) => [b.id, b.revenue]));
  const curById = new Map(cur.buildings.map((b) => [b.id, { name: b.name, rev: b.revenue }]));
  const ids = new Set([...curById.keys(), ...priorById.keys()]);

  const pctOf = (delta: number, prior: number): number | null => (prior !== 0 ? r3((delta / Math.abs(prior)) * 100) : null);

  const buildings: CmpBuilding[] = [...ids].map((id) => {
    const current = r3(curById.get(id)?.rev ?? 0);
    const prior = r3(priorById.get(id) ?? 0);
    const delta = r3(current - prior);
    const name = curById.get(id)?.name ?? prev.buildings.find((b) => b.id === id)?.name ?? "—";
    return { id, name, current, prior, delta, deltaPct: pctOf(delta, prior) };
  }).sort((a, c) => c.current - a.current || c.delta - a.delta);

  const current = r3(cur.kpis.totalRevenue);
  const prior = r3(prev.kpis.totalRevenue);
  const delta = r3(current - prior);

  return {
    kpis: { current, prior, delta, deltaPct: pctOf(delta, prior), buildingCount: buildings.length },
    buildings,
    priorFrom: ymd(priorFromMs),
    priorTo: ymd(priorToExclusiveMs - DAY),
    rangeDays,
  };
}
