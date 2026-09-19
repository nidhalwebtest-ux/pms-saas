import { prisma } from "@/lib/prisma";
import { createReservationCore, MonthlyBlockedError, DoubleBookingError } from "@/lib/reservation-engine-core";
import { getUnitConflict } from "@/lib/reservation-conflict";
import { parseOmrAmount, parseImportDate } from "../value-parsers";
import type { ImportAdapter, FieldSpec, ImportContext, ParsedRowResult, RowError } from "../types";

/* ============================================================================
 *  Reservations import adapter — depends on Tenants and Units. One CSV row
 *  creates exactly one reservation with exactly one unit (matches the
 *  overwhelming majority of real bookings). A stay across multiple units in
 *  one booking isn't representable here — that has to be entered by hand,
 *  same as any other adapter's "the source data doesn't map 1:1" limit.
 *
 *  Tenant is resolved by ID number (the same field tenants.ts uses for its
 *  own duplicate check — the one identifier a migration file is likely to
 *  carry reliably). Unit is resolved by building name + unit name together,
 *  since unit names are only unique within a building, not org-wide.
 * ========================================================================= */

export interface ReservationRow {
  tenantIdNumber: string;
  propertyName: string;
  unitName: string;
  startDate: Date;
  endDate: Date;
  rateType: "daily" | "monthly";
  source?: string;
  notes?: string;
  discountAmount?: number;
}

const FIELDS: FieldSpec[] = [
  {
    key: "tenantIdNumber",
    labelKey: "tenantIdNumber",
    required: true,
    type: "string",
    aliases: ["id number", "tenant id", "guest id", "رقم الهوية"],
    exampleEn: ["12345678", "98765432"],
    exampleAr: ["12345678", "98765432"],
  },
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
    key: "unitName",
    labelKey: "unitName",
    required: true,
    type: "string",
    aliases: ["unit", "unit name", "room", "اسم الوحدة", "الوحدة"],
    exampleEn: ["101", "202"],
    exampleAr: ["101", "202"],
  },
  {
    key: "startDate",
    labelKey: "startDate",
    required: true,
    type: "date",
    aliases: ["check-in", "checkin", "start date", "arrival", "تاريخ الوصول", "تاريخ البداية"],
    exampleEn: ["2026-01-15", "15/01/2026"],
    exampleAr: ["2026-01-15", "15/01/2026"],
  },
  {
    key: "endDate",
    labelKey: "endDate",
    required: true,
    type: "date",
    aliases: ["check-out", "checkout", "end date", "departure", "تاريخ المغادرة", "تاريخ النهاية"],
    exampleEn: ["2026-01-20", "20/01/2026"],
    exampleAr: ["2026-01-20", "20/01/2026"],
  },
  {
    key: "rateType",
    labelKey: "rateType",
    required: false,
    type: "enum",
    enumValues: ["daily", "monthly"],
    aliases: ["rate type", "billing", "نوع السعر"],
    exampleEn: ["daily", "monthly"],
    exampleAr: ["يومي", "شهري"],
  },
  {
    key: "source",
    labelKey: "source",
    required: false,
    type: "string",
    aliases: ["source", "channel", "المصدر"],
    exampleEn: ["walk_in", "booking.com"],
    exampleAr: ["زيارة مباشرة", "بوكينج"],
  },
  {
    key: "discountAmount",
    labelKey: "discountAmount",
    required: false,
    type: "decimal",
    aliases: ["discount", "discount amount", "الخصم"],
    exampleEn: ["0.000", "5.000"],
    exampleAr: ["0.000", "5.000"],
  },
  {
    key: "notes",
    labelKey: "notes",
    required: false,
    type: "string",
    aliases: ["notes", "remarks", "ملاحظات"],
    exampleEn: ["Early check-in requested", ""],
    exampleAr: ["طلب تسجيل دخول مبكر", ""],
  },
];

const RATE_TYPE_ALIASES: Record<string, "daily" | "monthly"> = {
  "daily": "daily", "يومي": "daily",
  "monthly": "monthly", "شهري": "monthly",
};

function resolveRateType(raw: string | undefined): "daily" | "monthly" | null {
  if (!raw || raw.trim() === "") return "daily";
  const norm = raw.trim().toLowerCase();
  return RATE_TYPE_ALIASES[norm] ?? null;
}

export const reservationsAdapter: ImportAdapter<ReservationRow> = {
  recordType: "RESERVATIONS",
  labelKey: "reservations",
  fields: FIELDS,
  dependsOn: ["TENANTS", "UNITS"],

  async countExisting(organizationId) {
    return prisma.reservation.count({ where: { organizationId } });
  },

  parseRow(raw, mapping, opts): ParsedRowResult<ReservationRow> {
    const errors: RowError[] = [];
    const get = (key: string) => {
      const col = mapping[key];
      return col ? (raw[col] ?? "").trim() : "";
    };

    const tenantIdNumber = get("tenantIdNumber");
    if (!tenantIdNumber) errors.push({ field: "tenantIdNumber", message: "required" });

    const propertyName = get("propertyName");
    if (!propertyName) errors.push({ field: "propertyName", message: "required" });

    const unitName = get("unitName");
    if (!unitName) errors.push({ field: "unitName", message: "required" });

    let startDate: Date | undefined;
    const startRaw = get("startDate");
    if (!startRaw) {
      errors.push({ field: "startDate", message: "required" });
    } else {
      const parsed = parseImportDate(startRaw, opts.dateFormat);
      if (!parsed.ok) errors.push({ field: "startDate", message: parsed.error ?? "invalid_date" });
      else startDate = parsed.value;
    }

    let endDate: Date | undefined;
    const endRaw = get("endDate");
    if (!endRaw) {
      errors.push({ field: "endDate", message: "required" });
    } else {
      const parsed = parseImportDate(endRaw, opts.dateFormat);
      if (!parsed.ok) errors.push({ field: "endDate", message: parsed.error ?? "invalid_date" });
      else endDate = parsed.value;
    }

    if (startDate && endDate && startDate >= endDate) {
      errors.push({ field: "endDate", message: "checkout_before_checkin" });
    }

    const rateTypeRaw = get("rateType");
    const rateType = resolveRateType(rateTypeRaw || undefined);
    if (rateType === null) errors.push({ field: "rateType", message: `invalid_enum:${rateTypeRaw}` });

    let discountAmount: number | undefined;
    const discountRaw = get("discountAmount");
    if (discountRaw) {
      const parsed = parseOmrAmount(discountRaw);
      if (!parsed.ok) errors.push({ field: "discountAmount", message: parsed.error ?? "invalid_amount" });
      else discountAmount = parsed.value;
    }

    if (errors.length > 0) return { ok: false, errors };

    return {
      ok: true,
      data: {
        tenantIdNumber,
        propertyName,
        unitName,
        startDate: startDate!,
        endDate: endDate!,
        rateType: rateType!,
        source: get("source") || undefined,
        notes: get("notes") || undefined,
        discountAmount,
      },
    };
  },

  async validateRow(data, ctx): Promise<RowError[]> {
    const errors: RowError[] = [];

    const tenantCacheKey = `reservation-import-tenants:${ctx.organizationId}`;
    let tenantsByIdNumber = ctx.cache.get(tenantCacheKey) as Map<string, string> | undefined;
    if (!tenantsByIdNumber) {
      const tenants = await prisma.tenant.findMany({
        where: { organizationId: ctx.organizationId, idNumber: { not: null } },
        select: { id: true, idNumber: true },
      });
      tenantsByIdNumber = new Map(tenants.filter((t) => t.idNumber).map((t) => [t.idNumber!.trim().toLowerCase(), t.id]));
      ctx.cache.set(tenantCacheKey, tenantsByIdNumber);
    }
    const tenantId = tenantsByIdNumber.get(data.tenantIdNumber.trim().toLowerCase());
    if (!tenantId) {
      errors.push({ field: "tenantIdNumber", message: `tenant_not_found:${data.tenantIdNumber}` });
    }

    const unitCacheKey = `reservation-import-units:${ctx.organizationId}`;
    let unitsByKey = ctx.cache.get(unitCacheKey) as Map<string, { id: string; name: string }> | undefined;
    if (!unitsByKey) {
      const units = await prisma.unit.findMany({
        where: { property: { organizationId: ctx.organizationId } },
        select: { id: true, name: true, property: { select: { name: true } } },
      });
      unitsByKey = new Map(
        units.map((u) => [`${u.property.name.trim().toLowerCase()}::${u.name.trim().toLowerCase()}`, { id: u.id, name: u.name }]),
      );
      ctx.cache.set(unitCacheKey, unitsByKey);
    }
    const unitKey = `${data.propertyName.trim().toLowerCase()}::${data.unitName.trim().toLowerCase()}`;
    const unit = unitsByKey.get(unitKey);
    if (!unit) {
      errors.push({ field: "unitName", message: `unit_not_found:${data.propertyName} / ${data.unitName}` });
      return errors; // can't check availability below without a resolved unit
    }

    // Best-effort availability pre-check so an obvious double-booking shows up
    // as a row error before the batch runs, rather than only surfacing as a
    // createRow failure. This is NOT the authoritative check — createRow (via
    // createReservationCore) re-checks inside its own Serializable transaction
    // immediately before writing, same as the manual booking UI, since two
    // rows in the same file (or a concurrent booking) could race this one.
    const conflict = await getUnitConflict(prisma, unit.id, unit.name, data.startDate, data.endDate);
    if (conflict) {
      errors.push({
        field: "unitName",
        message: `unit_unavailable:${conflict.reservationNumber ?? "existing reservation"}`,
      });
    }

    return errors;
  },

  async createRow(data, ctx) {
    const tenantCacheKey = `reservation-import-tenants:${ctx.organizationId}`;
    const tenantsByIdNumber = ctx.cache.get(tenantCacheKey) as Map<string, string> | undefined;
    const tenantId = tenantsByIdNumber?.get(data.tenantIdNumber.trim().toLowerCase());
    if (!tenantId) throw new Error(`tenant_not_found:${data.tenantIdNumber}`);

    const unitCacheKey = `reservation-import-units:${ctx.organizationId}`;
    const unitsByKey = ctx.cache.get(unitCacheKey) as Map<string, { id: string; name: string }> | undefined;
    const unitKey = `${data.propertyName.trim().toLowerCase()}::${data.unitName.trim().toLowerCase()}`;
    const unit = unitsByKey?.get(unitKey);
    if (!unit) throw new Error(`unit_not_found:${data.propertyName} / ${data.unitName}`);

    try {
      const created = await createReservationCore(
        {
          tenantId,
          unitIds: [unit.id],
          unitNames: { [unit.id]: unit.name },
          startDate: data.startDate,
          endDate: data.endDate,
          rateType: data.rateType,
          source: data.source ?? "import",
          notes: data.notes,
          discountAmount: data.discountAmount,
        },
        ctx.organizationId,
        ctx.userId,
      );
      return { id: created.id };
    } catch (err) {
      if (err instanceof DoubleBookingError) {
        throw new Error(`unit_unavailable:${err.conflict?.reservationNumber ?? "existing reservation"}`);
      }
      if (err instanceof MonthlyBlockedError) {
        throw new Error(`monthly_blocked:${err.seasonName ?? "this season"}`);
      }
      throw err;
    }
  },

  async undoRow(entityId, organizationId) {
    const reservation = await prisma.reservation.findUnique({
      where: { id: entityId },
      select: {
        organizationId: true,
        status: true,
        invoices: { select: { amountPaid: true } },
      },
    });
    if (!reservation || reservation.organizationId !== organizationId) {
      throw new Error("not_found");
    }
    // Mirrors the manual cancellation rule (CLAUDE.md): never remove a
    // reservation that has any recorded payment. A freshly-imported row is
    // always PENDING with no check-in/checkout yet, so anything else means
    // it's been acted on since the import ran and undo is no longer safe.
    if (reservation.status !== "PENDING") {
      throw new Error(`blocked_by_status:${reservation.status}`);
    }
    const hasPayments = reservation.invoices.some((inv) => Number(inv.amountPaid) > 0);
    if (hasPayments) {
      throw new Error("blocked_by_payments");
    }
    await prisma.reservation.delete({ where: { id: entityId } });
  },
};
