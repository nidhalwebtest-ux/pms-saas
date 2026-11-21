import { prisma } from "@/lib/prisma";
import type { AreaOption } from "./area-label";

/** Sensible starter areas, seeded once if the table is empty. */
const DEFAULT_AREAS = [
  { name: "Al Haffa", nameAr: "الحافة", color: "#2563eb", sortOrder: 0 },
  { name: "Al Dahariz", nameAr: "الدحاريز", color: "#16a34a", sortOrder: 1 },
  { name: "City Center", nameAr: "وسط المدينة", color: "#d97706", sortOrder: 2 },
];

/**
 * All area classifications, ordered for display. Auto-seeds the defaults the
 * first time so the form/filter dropdowns aren't empty on a fresh install.
 */
export async function getAreaClassifications(): Promise<AreaOption[]> {
  let rows = await prisma.areaClassification.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  if (rows.length === 0) {
    await prisma.areaClassification.createMany({ data: DEFAULT_AREAS });
    rows = await prisma.areaClassification.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }
  return rows.map((r) => ({ id: r.id, name: r.name, nameAr: r.nameAr, color: r.color }));
}
