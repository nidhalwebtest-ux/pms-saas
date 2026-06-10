import { getOccupancyByBuilding } from "./occupancy-by-building";
import { getRevenueByBuilding } from "./revenue-by-building";
import { getAvgLengthOfStay } from "./avg-length-of-stay";

/**
 * Khareef Performance — a per-building dashboard for the monsoon peak season
 * (Salalah's Khareef, ~21 Jun–21 Sep). Combines the occupancy, revenue, and
 * length-of-stay aggregations over the chosen window into one view:
 *   occupancy %, net revenue, ADR (= net revenue / occupied nights), stays.
 * No new data logic — it merges three verified aggregations by building.
 */

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export interface KhareefBuilding {
  id: string;
  name: string;
  unitCount: number;
  occupiedNights: number;
  availableNights: number;
  occupancy: number;     // 0..1
  revenue: number;       // net
  adr: number;           // net revenue / occupied nights
  stays: number;         // arrivals in window
}
export interface KhareefReport {
  kpis: {
    revenue: number;
    occupancy: number;   // overall 0..1
    adr: number;         // overall
    occupiedNights: number;
    availableNights: number;
    stays: number;
    buildingCount: number;
    unitCount: number;
  };
  buildings: KhareefBuilding[];
  rangeDays: number;
}

export async function getKhareefPerformance(params: {
  orgId: string; from: Date; to: Date; propertyId?: string;
}): Promise<KhareefReport> {
  const [occ, rev, los] = await Promise.all([
    getOccupancyByBuilding(params),
    getRevenueByBuilding(params),
    getAvgLengthOfStay(params),
  ]);

  const revById = new Map(rev.buildings.map((b) => [b.id, b.revenue]));
  const staysById = new Map(los.buildings.map((b) => [b.id, b.stayCount]));

  const buildings: KhareefBuilding[] = occ.buildings.map((b) => {
    const revenue = r3(revById.get(b.id) ?? 0);
    return {
      id: b.id, name: b.name, unitCount: b.unitCount,
      occupiedNights: b.occupiedNights, availableNights: b.availableNights, occupancy: b.occupancy,
      revenue,
      adr: b.occupiedNights > 0 ? r3(revenue / b.occupiedNights) : 0,
      stays: staysById.get(b.id) ?? 0,
    };
  }).sort((a, c) => c.revenue - a.revenue || c.occupancy - a.occupancy);

  const revenue = r3(buildings.reduce((s, b) => s + b.revenue, 0));
  const occupiedNights = buildings.reduce((s, b) => s + b.occupiedNights, 0);
  const availableNights = buildings.reduce((s, b) => s + b.availableNights, 0);
  const stays = buildings.reduce((s, b) => s + b.stays, 0);

  return {
    kpis: {
      revenue,
      occupancy: availableNights > 0 ? r3(occupiedNights / availableNights) : 0,
      adr: occupiedNights > 0 ? r3(revenue / occupiedNights) : 0,
      occupiedNights,
      availableNights,
      stays,
      buildingCount: buildings.length,
      unitCount: buildings.reduce((s, b) => s + b.unitCount, 0),
    },
    buildings,
    rangeDays: occ.rangeDays,
  };
}
