import { prisma } from "@/lib/prisma";
import { createUnit } from "@/app/dashboard/units/actions";
import type { ImportAdapter, FieldSpec, ImportContext, ParsedRowResult, RowError } from "../types";

/* ============================================================================
 *  Units import adapter — depends on Buildings (a unit must resolve to an
 *  existing property by name). Follows the same shape as buildings.ts.
 * ========================================================================= */

export interface UnitRow {
  propertyName: string;
  name: string;
  unitType: string;
  floor?: number;
  bedrooms?: number;
  bathrooms?: number;
  basePrice: number;
  area?: number;
  description?: string;
}

const UNIT_TYPES = ["STUDIO", "ONE_BR", "TWO_BR", "THREE_BR", "SUITE"];

const FIELDS: FieldSpec[] = [
  {
    key: "propertyName",
    labelKey: "propertyName",
    required: true,
    type: "string",
    aliases: ["building", "building name", "property", "property name", "المبنى", "اسم المبنى", "العقار"],
    exampleEn: ["Al-Wasl Tower", "Al-Wasl Tower"],
    exampleAr: ["برج الوصل", "برج الوصل"],
  },
  {
    key: "name",
    labelKey: "name",
    required: true,
    type: "string",
    aliases: ["name", "unit name", "unit", "room", "اسم الوحدة", "الوحدة", "الاسم"],
    exampleEn: ["101", "202"],
    exampleAr: ["101", "202"],
  },
  {
    key: "unitType",
    labelKey: "unitType",
    required: false,
    type: "enum",
    enumValues: UNIT_TYPES,
    aliases: ["type", "unit type", "النوع", "نوع الوحدة"],
    exampleEn: ["ONE_BR", "TWO_BR"],
    exampleAr: ["غرفة نوم واحدة", "غرفتا نوم"],
  },
  {
    key: "floor",
    labelKey: "floor",
    required: false,
    type: "number",
    aliases: ["floor", "الطابق"],
    exampleEn: ["1", "2"],
    exampleAr: ["1", "2"],
  },
  {
    key: "bedrooms",
    labelKey: "bedrooms",
    required: false,
    type: "number",
    aliases: ["bedrooms", "beds", "غرف النوم"],
    exampleEn: ["1", "2"],
    exampleAr: ["1", "2"],
  },
  {
    key: "bathrooms",
    labelKey: "bathrooms",
    required: false,
    type: "number",
    aliases: ["bathrooms", "baths", "الحمامات"],
    exampleEn: ["1", "1"],
    exampleAr: ["1", "1"],
  },
  {
    key: "basePrice",
    labelKey: "basePrice",
    required: true,
    type: "decimal",
    aliases: ["base price", "price", "rate", "daily rate", "السعر", "سعر الوحدة", "السعر الأساسي"],
    exampleEn: ["25.000", "35.500"],
    exampleAr: ["25.000", "35.500"],
  },
  {
    key: "area",
    labelKey: "area",
    required: false,
    type: "decimal",
    aliases: ["area", "size", "sqm", "m2", "المساحة"],
    exampleEn: ["45", "60"],
    exampleAr: ["45", "60"],
  },
  {
    key: "description",
    labelKey: "description",
    required: false,
    type: "string",
    aliases: ["description", "notes", "الوصف", "ملاحظات"],
    exampleEn: ["Sea view, top floor", "Family unit near lobby"],
    exampleAr: ["إطلالة بحرية، الطابق العلوي", "وحدة عائلية قرب المدخل"],
  },
];

// Arabic unit-type aliases → enum value, so a CSV with "استوديو" resolves correctly.
const TYPE_ALIASES: Record<string, string> = {
  "studio": "STUDIO", "استوديو": "STUDIO",
  "one_br": "ONE_BR", "1br": "ONE_BR", "غرفة نوم واحدة": "ONE_BR", "غرفة واحدة": "ONE_BR",
  "two_br": "TWO_BR", "2br": "TWO_BR", "غرفتا نوم": "TWO_BR", "غرفتين": "TWO_BR",
  "three_br": "THREE_BR", "3br": "THREE_BR", "ثلاث غرف نوم": "THREE_BR", "ثلاث غرف": "THREE_BR",
  "suite": "SUITE", "جناح": "SUITE",
};

function resolveUnitType(raw: string | undefined): string | null {
  if (!raw || raw.trim() === "") return "ONE_BR"; // schema default
  const norm = raw.trim().toLowerCase();
  if (UNIT_TYPES.includes(raw.trim().toUpperCase())) return raw.trim().toUpperCase();
  return TYPE_ALIASES[norm] ?? null;
}

// Matches UnitForm.tsx's UNIT_TYPES table — used to default bedrooms/
// bathrooms from the unit type when the CSV doesn't specify them.
// createUnit()'s own `parseInt(...) ?? 1` fallback for a missing FormData
// field actually evaluates to NaN (parseInt never returns null/undefined),
// so this adapter always sends an explicit value rather than relying on it.
const TYPE_DEFAULTS: Record<string, { bedrooms: number; bathrooms: number }> = {
  STUDIO:   { bedrooms: 0, bathrooms: 1 },
  ONE_BR:   { bedrooms: 1, bathrooms: 1 },
  TWO_BR:   { bedrooms: 2, bathrooms: 1 },
  THREE_BR: { bedrooms: 3, bathrooms: 2 },
  SUITE:    { bedrooms: 2, bathrooms: 2 },
};

/** Parses a non-negative decimal with at most 3 places — matches the
 *  project's OMR precision rule. Returns null (not NaN/0) on anything that
 *  doesn't cleanly parse, so callers can tell "absent" from "invalid". */
function parseDecimal3(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d{1,3})?$/.test(trimmed)) return null;
  return Number(trimmed);
}

function parseWholeNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

export const unitsAdapter: ImportAdapter<UnitRow> = {
  recordType: "UNITS",
  labelKey: "units",
  fields: FIELDS,
  dependsOn: ["BUILDINGS"],

  async countExisting(organizationId) {
    return prisma.unit.count({ where: { property: { organizationId } } });
  },

  parseRow(raw, mapping, _opts): ParsedRowResult<UnitRow> {
    const errors: RowError[] = [];
    const get = (key: string) => {
      const col = mapping[key];
      return col ? (raw[col] ?? "").trim() : "";
    };

    const propertyName = get("propertyName");
    if (!propertyName) errors.push({ field: "propertyName", message: "required" });

    const name = get("name");
    if (!name) errors.push({ field: "name", message: "required" });

    const unitTypeRaw = get("unitType");
    const unitType = resolveUnitType(unitTypeRaw || undefined);
    if (unitType === null) errors.push({ field: "unitType", message: `invalid_enum:${unitTypeRaw}` });

    let floor: number | undefined;
    const floorRaw = get("floor");
    if (floorRaw) {
      const n = parseWholeNumber(floorRaw);
      if (n === null) errors.push({ field: "floor", message: "not_a_whole_number" });
      else floor = n;
    }

    let bedrooms: number | undefined;
    const bedroomsRaw = get("bedrooms");
    if (bedroomsRaw) {
      const n = parseWholeNumber(bedroomsRaw);
      if (n === null) errors.push({ field: "bedrooms", message: "not_a_whole_number" });
      else bedrooms = n;
    }

    let bathrooms: number | undefined;
    const bathroomsRaw = get("bathrooms");
    if (bathroomsRaw) {
      const n = parseWholeNumber(bathroomsRaw);
      if (n === null) errors.push({ field: "bathrooms", message: "not_a_whole_number" });
      else bathrooms = n;
    }

    const basePriceRaw = get("basePrice");
    let basePrice: number | null = null;
    if (!basePriceRaw) {
      errors.push({ field: "basePrice", message: "required" });
    } else {
      basePrice = parseDecimal3(basePriceRaw);
      if (basePrice === null) errors.push({ field: "basePrice", message: "invalid_decimal" });
    }

    let area: number | undefined;
    const areaRaw = get("area");
    if (areaRaw) {
      const n = parseDecimal3(areaRaw);
      if (n === null) errors.push({ field: "area", message: "invalid_decimal" });
      else area = n;
    }

    if (errors.length > 0) return { ok: false, errors };

    return {
      ok: true,
      data: {
        propertyName,
        name,
        unitType: unitType!,
        floor,
        bedrooms,
        bathrooms,
        basePrice: basePrice!,
        area,
        description: get("description") || undefined,
      },
    };
  },

  async validateRow(data, ctx): Promise<RowError[]> {
    const errors: RowError[] = [];

    // Resolve the building by name (case-insensitive) — cached per job so
    // every row in the same file doesn't re-query the property list.
    const propCacheKey = `unit-import-properties:${ctx.organizationId}`;
    let propertiesByName = ctx.cache.get(propCacheKey) as Map<string, string> | undefined;
    if (!propertiesByName) {
      const props = await prisma.property.findMany({
        where: { organizationId: ctx.organizationId },
        select: { id: true, name: true },
      });
      propertiesByName = new Map(props.map((p) => [p.name.trim().toLowerCase(), p.id]));
      ctx.cache.set(propCacheKey, propertiesByName);
    }
    const propertyId = propertiesByName.get(data.propertyName.trim().toLowerCase());
    if (!propertyId) {
      errors.push({ field: "propertyName", message: `building_not_found:${data.propertyName}` });
      return errors; // can't check duplicates below without a resolved property
    }

    // Duplicate check — same name within the same building (case-insensitive).
    // Unit has no @@unique on (propertyId, name) in the schema, so — same as
    // Buildings — this is an import-only guard reported as a fact; the engine
    // (process-batch) decides what to do with it based on duplicateHandling.
    const dupCacheKey = `unit-import-names:${ctx.organizationId}:${propertyId}`;
    let existingNames = ctx.cache.get(dupCacheKey) as Set<string> | undefined;
    if (!existingNames) {
      const rows = await prisma.unit.findMany({
        where: { propertyId },
        select: { name: true },
      });
      existingNames = new Set(rows.map((r) => r.name.trim().toLowerCase()));
      ctx.cache.set(dupCacheKey, existingNames);
    }
    const isDuplicate = existingNames.has(data.name.trim().toLowerCase());
    if (isDuplicate && ctx.options.duplicateHandling !== "create") {
      errors.push({ field: "name", message: "duplicate_unit_name" });
    }

    return errors;
  },

  async createRow(data, ctx) {
    const propCacheKey = `unit-import-properties:${ctx.organizationId}`;
    const propertiesByName = ctx.cache.get(propCacheKey) as Map<string, string> | undefined;
    const propertyId = propertiesByName?.get(data.propertyName.trim().toLowerCase());
    if (!propertyId) throw new Error(`building_not_found:${data.propertyName}`);

    const typeDefaults = TYPE_DEFAULTS[data.unitType] ?? TYPE_DEFAULTS.ONE_BR;

    const fd = new FormData();
    fd.set("propertyId", propertyId);
    fd.set("name", data.name);
    fd.set("unitType", data.unitType);
    fd.set("basePrice", String(data.basePrice));
    fd.set("floor", String(data.floor ?? 0));
    fd.set("bedrooms", String(data.bedrooms ?? typeDefaults.bedrooms));
    fd.set("bathrooms", String(data.bathrooms ?? typeDefaults.bathrooms));
    if (data.area !== undefined) fd.set("area", String(data.area));
    if (data.description) fd.set("description", data.description);
    fd.set("active", "true");

    const result = await createUnit(fd);
    if (result.error || !result.id) {
      throw new Error(result.error ?? "create_failed");
    }

    // Track the name as now-existing so later rows in the same batch
    // correctly flag duplicates against rows imported earlier in this job.
    const dupCacheKey = `unit-import-names:${ctx.organizationId}:${propertyId}`;
    const existingNames = ctx.cache.get(dupCacheKey) as Set<string> | undefined;
    existingNames?.add(data.name.trim().toLowerCase());

    return { id: result.id };
  },

  async undoRow(entityId, organizationId) {
    const unit = await prisma.unit.findUnique({
      where: { id: entityId },
      select: { property: { select: { organizationId: true } } },
    });
    if (!unit || unit.property.organizationId !== organizationId) {
      throw new Error("not_found");
    }
    const activeReservationCount = await prisma.reservation.count({
      where: {
        OR: [{ unitId: entityId }, { reservationUnits: { some: { unitId: entityId } } }],
        status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
      },
    });
    if (activeReservationCount > 0) {
      throw new Error(`blocked_by_reservations:${activeReservationCount}`);
    }
    await prisma.unit.delete({ where: { id: entityId } });
  },
};
