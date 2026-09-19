import { prisma } from "@/lib/prisma";
import { createTenant } from "@/app/dashboard/tenants/actions";
import type { ImportAdapter, FieldSpec, ImportContext, ParsedRowResult, RowError } from "../types";

/* ============================================================================
 *  Tenants import adapter — no dependency on Buildings/Units. Matches
 *  createTenant()'s own required-field set exactly (firstName, lastName,
 *  phone, idNumber, nationality), since that's the real code path this
 *  adapter's createRow calls — a row that passes parseRow/validateRow here
 *  but would still be rejected by createTenant() would be a silent
 *  inconsistency, so the required set is intentionally identical.
 * ========================================================================= */

export interface TenantRow {
  firstName: string;
  lastName: string;
  phone: string;
  idNumber: string;
  nationality: string;
  idType?: string;
  email?: string;
  tenantType?: string;
  source?: string;
  classification?: string;
  city?: string;
  country?: string;
}

const ID_TYPE_VALUES = ["national_id", "passport", "resident_card", "driving_license"];
const TENANT_TYPE_VALUES = ["individual", "family", "corporate", "government"];
const SOURCE_VALUES = [
  "walk_in", "phone", "whatsapp", "website", "booking_com", "airbnb",
  "referral", "returning_guest", "corporate_contract", "other",
];
const CLASSIFICATION_VALUES = ["regular", "vip", "blacklisted"];

const FIELDS: FieldSpec[] = [
  {
    key: "firstName",
    labelKey: "firstName",
    required: true,
    type: "string",
    aliases: ["first name", "firstname", "الاسم الأول", "الاسم"],
    exampleEn: ["Ahmed", "Fatima"],
    exampleAr: ["أحمد", "فاطمة"],
  },
  {
    key: "lastName",
    labelKey: "lastName",
    required: true,
    type: "string",
    aliases: ["last name", "lastname", "surname", "اسم العائلة", "العائلة"],
    exampleEn: ["Al-Balushi", "Al-Harthi"],
    exampleAr: ["البلوشي", "الحارثي"],
  },
  {
    key: "phone",
    labelKey: "phone",
    required: true,
    type: "string",
    aliases: ["phone", "phone number", "mobile", "رقم الهاتف", "الهاتف", "الجوال"],
    exampleEn: ["+96898765432", "+96891234567"],
    exampleAr: ["+96898765432", "+96891234567"],
  },
  {
    key: "idNumber",
    labelKey: "idNumber",
    required: true,
    type: "string",
    aliases: ["id number", "id no", "national id", "passport number", "رقم الهوية", "رقم البطاقة"],
    exampleEn: ["12345678", "87654321"],
    exampleAr: ["12345678", "87654321"],
  },
  {
    key: "nationality",
    labelKey: "nationality",
    required: true,
    type: "string",
    aliases: ["nationality", "الجنسية"],
    exampleEn: ["Omani", "Emirati"],
    exampleAr: ["عماني", "إماراتي"],
  },
  {
    key: "idType",
    labelKey: "idType",
    required: false,
    type: "enum",
    enumValues: ID_TYPE_VALUES,
    aliases: ["id type", "document type", "نوع الهوية"],
    exampleEn: ["national_id", "passport"],
    exampleAr: ["بطاقة وطنية", "جواز سفر"],
  },
  {
    key: "email",
    labelKey: "email",
    required: false,
    type: "string",
    aliases: ["email", "البريد الإلكتروني"],
    exampleEn: ["ahmed@example.com", ""],
    exampleAr: ["ahmed@example.com", ""],
  },
  {
    key: "tenantType",
    labelKey: "tenantType",
    required: false,
    type: "enum",
    enumValues: TENANT_TYPE_VALUES,
    aliases: ["tenant type", "guest type", "نوع النزيل"],
    exampleEn: ["individual", "family"],
    exampleAr: ["فرد", "عائلة"],
  },
  {
    key: "source",
    labelKey: "source",
    required: false,
    type: "enum",
    enumValues: SOURCE_VALUES,
    aliases: ["source", "المصدر"],
    exampleEn: ["walk_in", "whatsapp"],
    exampleAr: ["زيارة مباشرة", "واتساب"],
  },
  {
    key: "classification",
    labelKey: "classification",
    required: false,
    type: "enum",
    enumValues: CLASSIFICATION_VALUES,
    aliases: ["classification", "guest class", "التصنيف"],
    exampleEn: ["regular", "vip"],
    exampleAr: ["عادي", "مميز"],
  },
  {
    key: "city",
    labelKey: "city",
    required: false,
    type: "string",
    aliases: ["city", "المدينة"],
    exampleEn: ["Muscat", "Salalah"],
    exampleAr: ["مسقط", "صلالة"],
  },
  {
    key: "country",
    labelKey: "country",
    required: false,
    type: "string",
    aliases: ["country", "الدولة", "البلد"],
    exampleEn: ["Oman", "UAE"],
    exampleAr: ["عمان", "الإمارات"],
  },
];

// Arabic value aliases for the enum-like fields — createTenant() stores
// whatever string is given, so these resolve a friendlier CSV value to the
// exact lowercase code the rest of the app (badges, filters) expects.
const ID_TYPE_ALIASES: Record<string, string> = {
  "بطاقة وطنية": "national_id", "هوية وطنية": "national_id",
  "جواز سفر": "passport", "جواز": "passport",
  "بطاقة إقامة": "resident_card", "إقامة": "resident_card",
  "رخصة قيادة": "driving_license",
};
const TENANT_TYPE_ALIASES: Record<string, string> = {
  "فرد": "individual", "عائلة": "family", "شركة": "corporate", "حكومي": "government",
};
const SOURCE_ALIASES: Record<string, string> = {
  "زيارة مباشرة": "walk_in", "هاتف": "phone", "واتساب": "whatsapp", "موقع الويب": "website",
  "بوكينج": "booking_com", "airbnb": "airbnb", "إحالة": "referral",
  "نزيل عائد": "returning_guest", "عقد شركة": "corporate_contract", "أخرى": "other",
};
const CLASSIFICATION_ALIASES: Record<string, string> = {
  "عادي": "regular", "مميز": "vip", "محظور": "blacklisted",
};

function resolveEnum(
  raw: string | undefined,
  values: string[],
  aliases: Record<string, string>,
  fallback: string,
): string | null {
  if (!raw || raw.trim() === "") return fallback;
  const norm = raw.trim().toLowerCase();
  if (values.includes(norm)) return norm;
  return aliases[raw.trim()] ?? aliases[norm] ?? null;
}

// Loose but real phone validation — matches what PhoneInput/libphonenumber
// would reject outright (needs at least a country code + several digits).
// Not full E.164 validation since the CSV format is unpredictable; the goal
// is to catch obviously-broken values ("N/A", "-", empty after trim), not
// to replicate the phone picker's full logic.
function looksLikePhone(raw: string): boolean {
  const digits = raw.replace(/[^\d]/g, "");
  return digits.length >= 7;
}

export const tenantsAdapter: ImportAdapter<TenantRow> = {
  recordType: "TENANTS",
  labelKey: "tenants",
  fields: FIELDS,
  dependsOn: [],

  async countExisting(organizationId) {
    return prisma.tenant.count({ where: { organizationId } });
  },

  parseRow(raw, mapping, _opts): ParsedRowResult<TenantRow> {
    const errors: RowError[] = [];
    const get = (key: string) => {
      const col = mapping[key];
      return col ? (raw[col] ?? "").trim() : "";
    };

    const firstName = get("firstName");
    if (!firstName) errors.push({ field: "firstName", message: "required" });
    else if (firstName.length < 2) errors.push({ field: "firstName", message: "too_short" });

    const lastName = get("lastName");
    if (!lastName) errors.push({ field: "lastName", message: "required" });
    else if (lastName.length < 2) errors.push({ field: "lastName", message: "too_short" });

    const phone = get("phone");
    if (!phone) errors.push({ field: "phone", message: "required" });
    else if (!looksLikePhone(phone)) errors.push({ field: "phone", message: "invalid_phone" });

    const idNumber = get("idNumber");
    if (!idNumber) errors.push({ field: "idNumber", message: "required" });

    const nationality = get("nationality");
    if (!nationality) errors.push({ field: "nationality", message: "required" });

    const idTypeRaw = get("idType");
    const idType = resolveEnum(idTypeRaw || undefined, ID_TYPE_VALUES, ID_TYPE_ALIASES, "national_id");
    if (idType === null) errors.push({ field: "idType", message: `invalid_enum:${idTypeRaw}` });

    const tenantTypeRaw = get("tenantType");
    const tenantType = resolveEnum(tenantTypeRaw || undefined, TENANT_TYPE_VALUES, TENANT_TYPE_ALIASES, "individual");
    if (tenantType === null) errors.push({ field: "tenantType", message: `invalid_enum:${tenantTypeRaw}` });

    const sourceRaw = get("source");
    const source = resolveEnum(sourceRaw || undefined, SOURCE_VALUES, SOURCE_ALIASES, "walk_in");
    if (source === null) errors.push({ field: "source", message: `invalid_enum:${sourceRaw}` });

    const classificationRaw = get("classification");
    const classification = resolveEnum(classificationRaw || undefined, CLASSIFICATION_VALUES, CLASSIFICATION_ALIASES, "regular");
    if (classification === null) errors.push({ field: "classification", message: `invalid_enum:${classificationRaw}` });

    const email = get("email");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ field: "email", message: "invalid_email" });
    }

    if (errors.length > 0) return { ok: false, errors };

    return {
      ok: true,
      data: {
        firstName,
        lastName,
        phone,
        idNumber,
        nationality,
        idType: idType!,
        email: email || undefined,
        tenantType: tenantType!,
        source: source!,
        classification: classification!,
        city: get("city") || undefined,
        country: get("country") || undefined,
      },
    };
  },

  async validateRow(data, ctx): Promise<RowError[]> {
    const errors: RowError[] = [];

    // Duplicate check — createTenant() itself blocks on idNumber within the
    // org, so this mirrors that exactly (not a looser import-only guard like
    // Buildings' name check, which has no DB constraint behind it).
    const cacheKey = `tenant-import-idnumbers:${ctx.organizationId}`;
    let existingIdNumbers = ctx.cache.get(cacheKey) as Set<string> | undefined;
    if (!existingIdNumbers) {
      const rows = await prisma.tenant.findMany({
        where: { organizationId: ctx.organizationId, idNumber: { not: null } },
        select: { idNumber: true },
      });
      existingIdNumbers = new Set(rows.map((r) => r.idNumber!.trim().toLowerCase()));
      ctx.cache.set(cacheKey, existingIdNumbers);
    }
    const isDuplicate = existingIdNumbers.has(data.idNumber.trim().toLowerCase());
    if (isDuplicate && ctx.options.duplicateHandling !== "create") {
      errors.push({ field: "idNumber", message: "duplicate_id_number" });
    }

    return errors;
  },

  async createRow(data, ctx) {
    const fd = new FormData();
    fd.set("firstName", data.firstName);
    fd.set("lastName", data.lastName);
    fd.set("phone", data.phone);
    fd.set("idNumber", data.idNumber);
    fd.set("nationality", data.nationality);
    fd.set("idType", data.idType ?? "national_id");
    fd.set("tenantType", data.tenantType ?? "individual");
    fd.set("source", data.source ?? "walk_in");
    fd.set("classification", data.classification ?? "regular");
    if (data.email) fd.set("email", data.email);
    if (data.city) fd.set("city", data.city);
    if (data.country) fd.set("country", data.country);
    fd.set("tags_json", "[]");

    const result = await createTenant(fd);
    if (result.error || !result.id) {
      throw new Error(result.error ?? "create_failed");
    }

    // Track the id number as now-existing so later rows in the same batch
    // correctly flag duplicates against rows imported earlier in this job.
    const cacheKey = `tenant-import-idnumbers:${ctx.organizationId}`;
    const existingIdNumbers = ctx.cache.get(cacheKey) as Set<string> | undefined;
    existingIdNumbers?.add(data.idNumber.trim().toLowerCase());

    return { id: result.id };
  },

  async undoRow(entityId, organizationId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: entityId },
      select: { organizationId: true },
    });
    if (!tenant || tenant.organizationId !== organizationId) {
      throw new Error("not_found");
    }
    const activeReservationCount = await prisma.reservation.count({
      where: { tenantId: entityId, status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] } },
    });
    if (activeReservationCount > 0) {
      throw new Error(`blocked_by_reservations:${activeReservationCount}`);
    }
    const invoiceCount = await prisma.invoice.count({ where: { tenantId: entityId } });
    if (invoiceCount > 0) {
      throw new Error(`blocked_by_invoices:${invoiceCount}`);
    }
    await prisma.tenant.delete({ where: { id: entityId } });
  },
};
