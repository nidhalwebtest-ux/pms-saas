import { prisma } from "@/lib/prisma";
import { createPropertyCore } from "@/app/dashboard/properties/actions";
import type { ImportAdapter, FieldSpec, ImportContext, ParsedRowResult, RowError } from "../types";

/* ============================================================================
 *  Buildings import adapter — the reference implementation. Every other
 *  adapter (units, tenants, reservations, expenses) follows this same shape.
 * ========================================================================= */

export interface BuildingRow {
  name: string;
  type: string;
  city?: string;
  governorate?: string;
  address?: string;
  totalFloors?: number;
  description?: string;
}

const PROPERTY_TYPES = ["RESIDENTIAL", "MIXED", "HOTEL", "COMMERCIAL"];

const FIELDS: FieldSpec[] = [
  {
    key: "name",
    labelKey: "name",
    required: true,
    type: "string",
    aliases: ["name", "building name", "building", "property name", "اسم المبنى", "اسم العقار", "المبنى", "الاسم"],
    exampleEn: ["Al-Wasl Tower", "Coastal Residences"],
    exampleAr: ["برج الوصل", "المساكن الساحلية"],
  },
  {
    key: "type",
    labelKey: "type",
    required: false,
    type: "enum",
    enumValues: PROPERTY_TYPES,
    aliases: ["type", "property type", "building type", "النوع", "نوع المبنى", "نوع العقار"],
    exampleEn: ["RESIDENTIAL", "MIXED"],
    exampleAr: ["سكني", "مختلط"],
  },
  {
    key: "city",
    labelKey: "city",
    required: false,
    type: "string",
    aliases: ["city", "المدينة"],
    exampleEn: ["Salalah", "Salalah"],
    exampleAr: ["صلالة", "صلالة"],
  },
  {
    key: "governorate",
    labelKey: "governorate",
    required: false,
    type: "string",
    aliases: ["governorate", "المحافظة"],
    exampleEn: ["Dhofar", "Dhofar"],
    exampleAr: ["ظفار", "ظفار"],
  },
  {
    key: "address",
    labelKey: "address",
    required: false,
    type: "string",
    aliases: ["address", "العنوان"],
    exampleEn: ["Al Nahdah St, Salalah", "Airport Road, Salalah"],
    exampleAr: ["شارع النهضة، صلالة", "طريق المطار، صلالة"],
  },
  {
    key: "totalFloors",
    labelKey: "totalFloors",
    required: false,
    type: "number",
    aliases: ["total floors", "floors", "عدد الطوابق", "الطوابق"],
    exampleEn: ["4", "6"],
    exampleAr: ["4", "6"],
  },
  {
    key: "description",
    labelKey: "description",
    required: false,
    type: "string",
    aliases: ["description", "notes", "الوصف", "ملاحظات"],
    exampleEn: ["Beachfront building, 20 units", "Family residences near the souq"],
    exampleAr: ["مبنى على الواجهة البحرية، 20 وحدة", "مساكن عائلية قرب السوق"],
  },
];

// Arabic type-name aliases → enum value, so a CSV with "سكني" resolves correctly.
const TYPE_ALIASES: Record<string, string> = {
  "residential": "RESIDENTIAL", "سكني": "RESIDENTIAL",
  "mixed": "MIXED", "مختلط": "MIXED",
  "hotel": "HOTEL", "فندق": "HOTEL", "فندقي": "HOTEL",
  "commercial": "COMMERCIAL", "تجاري": "COMMERCIAL",
};

function resolveType(raw: string | undefined): string | null {
  if (!raw || raw.trim() === "") return "RESIDENTIAL"; // schema default
  const norm = raw.trim().toLowerCase();
  if (PROPERTY_TYPES.includes(raw.trim().toUpperCase())) return raw.trim().toUpperCase();
  return TYPE_ALIASES[norm] ?? null;
}

export const buildingsAdapter: ImportAdapter<BuildingRow> = {
  recordType: "BUILDINGS",
  labelKey: "buildings",
  fields: FIELDS,
  dependsOn: [],

  async countExisting(organizationId) {
    return prisma.property.count({ where: { organizationId } });
  },

  parseRow(raw, mapping, _opts): ParsedRowResult<BuildingRow> {
    const errors: RowError[] = [];
    const get = (key: string) => {
      const col = mapping[key];
      return col ? (raw[col] ?? "").trim() : "";
    };

    const name = get("name");
    if (!name) errors.push({ field: "name", message: "required" });

    const typeRaw = get("type");
    const type = resolveType(typeRaw || undefined);
    if (type === null) errors.push({ field: "type", message: `invalid_enum:${typeRaw}` });

    let totalFloors: number | undefined;
    const totalFloorsRaw = get("totalFloors");
    if (totalFloorsRaw) {
      const n = Number(totalFloorsRaw);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        errors.push({ field: "totalFloors", message: "not_a_whole_number" });
      } else {
        totalFloors = n;
      }
    }

    if (errors.length > 0) return { ok: false, errors };

    return {
      ok: true,
      data: {
        name,
        type: type!,
        city: get("city") || undefined,
        governorate: get("governorate") || undefined,
        address: get("address") || undefined,
        totalFloors,
        description: get("description") || undefined,
      },
    };
  },

  async validateRow(data, ctx): Promise<RowError[]> {
    const errors: RowError[] = [];

    // Duplicate check — case-insensitive name match within the org. Property
    // has no @@unique on name in the schema, so this is an import-only guard
    // (the manual UI allows duplicates today); duplicateHandling decides what
    // happens next in the engine, not here — this just reports the fact.
    const cacheKey = `building-names:${ctx.organizationId}`;
    let existingNames = ctx.cache.get(cacheKey) as Set<string> | undefined;
    if (!existingNames) {
      const rows = await prisma.property.findMany({
        where: { organizationId: ctx.organizationId },
        select: { name: true },
      });
      existingNames = new Set(rows.map((r) => r.name.trim().toLowerCase()));
      ctx.cache.set(cacheKey, existingNames);
    }
    const isDuplicate = existingNames.has(data.name.trim().toLowerCase());
    if (isDuplicate && ctx.options.duplicateHandling !== "create") {
      // Reported as a "duplicate" error either way; the engine (process-batch)
      // converts this into a silent SKIPPED row when duplicateHandling is
      // "skip" rather than counting it as a failure. "update" is not yet
      // supported for Buildings — treated as "skip" until an update path
      // exists (flagged in the wizard's option description).
      errors.push({ field: "name", message: "duplicate_building_name" });
    }

    return errors;
  },

  async createRow(data, ctx) {
    const result = await createPropertyCore(
      {
        name: data.name,
        type: data.type,
        city: data.city,
        governorate: data.governorate,
        address: data.address,
        totalFloors: data.totalFloors,
        description: data.description,
      },
      ctx.organizationId,
    );
    // Track the name as now-existing so later rows in the same batch correctly
    // flag duplicates against rows imported earlier in this same job.
    const cacheKey = `building-names:${ctx.organizationId}`;
    const existingNames = ctx.cache.get(cacheKey) as Set<string> | undefined;
    existingNames?.add(data.name.trim().toLowerCase());
    return result;
  },

  async undoRow(entityId, organizationId) {
    const property = await prisma.property.findUnique({
      where: { id: entityId },
      select: { organizationId: true },
    });
    if (!property || property.organizationId !== organizationId) {
      throw new Error("not_found");
    }
    const activeReservationCount = await prisma.reservation.count({
      where: { unit: { propertyId: entityId }, status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] } },
    });
    if (activeReservationCount > 0) {
      throw new Error(`blocked_by_reservations:${activeReservationCount}`);
    }
    // Cascade in schema handles units etc., matching deleteProperty's behavior.
    await prisma.property.delete({ where: { id: entityId } });
  },
};
