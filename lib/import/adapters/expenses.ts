import { prisma } from "@/lib/prisma";
import { createExpenseCore } from "@/lib/expense-engine";
import { parseOmrAmount, parseImportDate } from "../value-parsers";
import type { ImportAdapter, FieldSpec, ImportContext, ParsedRowResult, RowError } from "../types";

/* ============================================================================
 *  Expenses import adapter — depends on Buildings (propertyId is required on
 *  Expense) and needs an existing expense category (categoryId is required
 *  too — categories are org-level setup, not something this adapter creates
 *  on the fly, since a typo'd category name should be a validation error the
 *  user fixes, not a silently-created junk category).
 * ========================================================================= */

export interface ExpenseRow {
  categoryName: string;
  propertyName: string;
  description: string;
  amount: number;
  vendorName?: string;
  date?: Date;
  notes?: string;
}

const FIELDS: FieldSpec[] = [
  {
    key: "categoryName",
    labelKey: "categoryName",
    required: true,
    type: "string",
    aliases: ["category", "expense category", "الفئة", "فئة المصروف", "التصنيف"],
    exampleEn: ["Maintenance", "Utilities"],
    exampleAr: ["صيانة", "خدمات"],
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
    key: "description",
    labelKey: "description",
    required: true,
    type: "string",
    aliases: ["description", "details", "الوصف", "التفاصيل"],
    exampleEn: ["AC repair, unit 204", "Monthly electricity bill"],
    exampleAr: ["إصلاح تكييف، وحدة 204", "فاتورة الكهرباء الشهرية"],
  },
  {
    key: "amount",
    labelKey: "amount",
    required: true,
    type: "decimal",
    aliases: ["amount", "cost", "value", "المبلغ", "التكلفة", "القيمة"],
    exampleEn: ["25.000", "150.500"],
    exampleAr: ["25.000", "150.500"],
  },
  {
    key: "vendorName",
    labelKey: "vendorName",
    required: false,
    type: "string",
    aliases: ["vendor", "supplier", "المورد", "البائع"],
    exampleEn: ["Gulf Maintenance Co.", ""],
    exampleAr: ["شركة الخليج للصيانة", ""],
  },
  {
    key: "date",
    labelKey: "date",
    required: false,
    type: "date",
    aliases: ["date", "expense date", "التاريخ", "تاريخ المصروف"],
    exampleEn: ["2026-01-15", "15/01/2026"],
    exampleAr: ["2026-01-15", "15/01/2026"],
  },
  {
    key: "notes",
    labelKey: "notes",
    required: false,
    type: "string",
    aliases: ["notes", "remarks", "ملاحظات"],
    exampleEn: ["Paid in cash", ""],
    exampleAr: ["دُفع نقداً", ""],
  },
];

export const expensesAdapter: ImportAdapter<ExpenseRow> = {
  recordType: "EXPENSES",
  labelKey: "expenses",
  fields: FIELDS,
  dependsOn: ["BUILDINGS"],

  async countExisting(organizationId) {
    return prisma.expense.count({ where: { organizationId } });
  },

  parseRow(raw, mapping, opts): ParsedRowResult<ExpenseRow> {
    const errors: RowError[] = [];
    const get = (key: string) => {
      const col = mapping[key];
      return col ? (raw[col] ?? "").trim() : "";
    };

    const categoryName = get("categoryName");
    if (!categoryName) errors.push({ field: "categoryName", message: "required" });

    const propertyName = get("propertyName");
    if (!propertyName) errors.push({ field: "propertyName", message: "required" });

    const description = get("description");
    if (!description) errors.push({ field: "description", message: "required" });

    const amountRaw = get("amount");
    let amount: number | undefined;
    if (!amountRaw) {
      errors.push({ field: "amount", message: "required" });
    } else {
      const parsed = parseOmrAmount(amountRaw);
      if (!parsed.ok) errors.push({ field: "amount", message: parsed.error ?? "invalid_amount" });
      else amount = parsed.value;
    }

    let date: Date | undefined;
    const dateRaw = get("date");
    if (dateRaw) {
      const parsed = parseImportDate(dateRaw, opts.dateFormat);
      if (!parsed.ok) errors.push({ field: "date", message: parsed.error ?? "invalid_date" });
      else date = parsed.value;
    }

    if (errors.length > 0) return { ok: false, errors };

    return {
      ok: true,
      data: {
        categoryName,
        propertyName,
        description,
        amount: amount!,
        vendorName: get("vendorName") || undefined,
        date,
        notes: get("notes") || undefined,
      },
    };
  },

  async validateRow(data, ctx): Promise<RowError[]> {
    const errors: RowError[] = [];

    const catCacheKey = `expense-import-categories:${ctx.organizationId}`;
    let categoriesByName = ctx.cache.get(catCacheKey) as Map<string, string> | undefined;
    if (!categoriesByName) {
      const cats = await prisma.expenseCat.findMany({
        where: { organizationId: ctx.organizationId, isActive: true },
        select: { id: true, name: true, nameAr: true },
      });
      categoriesByName = new Map();
      for (const c of cats) {
        categoriesByName.set(c.name.trim().toLowerCase(), c.id);
        if (c.nameAr) categoriesByName.set(c.nameAr.trim().toLowerCase(), c.id);
      }
      ctx.cache.set(catCacheKey, categoriesByName);
    }
    if (!categoriesByName.has(data.categoryName.trim().toLowerCase())) {
      errors.push({ field: "categoryName", message: `category_not_found:${data.categoryName}` });
    }

    const propCacheKey = `expense-import-properties:${ctx.organizationId}`;
    let propertiesByName = ctx.cache.get(propCacheKey) as Map<string, string> | undefined;
    if (!propertiesByName) {
      const props = await prisma.property.findMany({
        where: { organizationId: ctx.organizationId },
        select: { id: true, name: true },
      });
      propertiesByName = new Map(props.map((p) => [p.name.trim().toLowerCase(), p.id]));
      ctx.cache.set(propCacheKey, propertiesByName);
    }
    if (!propertiesByName.has(data.propertyName.trim().toLowerCase())) {
      errors.push({ field: "propertyName", message: `building_not_found:${data.propertyName}` });
    }

    if (data.vendorName) {
      const vendorCacheKey = `expense-import-vendors:${ctx.organizationId}`;
      let vendorsByName = ctx.cache.get(vendorCacheKey) as Map<string, string> | undefined;
      if (!vendorsByName) {
        const vendors = await prisma.vendor.findMany({
          where: { organizationId: ctx.organizationId, isActive: true },
          select: { id: true, name: true, nameAr: true },
        });
        vendorsByName = new Map();
        for (const v of vendors) {
          vendorsByName.set(v.name.trim().toLowerCase(), v.id);
          if (v.nameAr) vendorsByName.set(v.nameAr.trim().toLowerCase(), v.id);
        }
        ctx.cache.set(vendorCacheKey, vendorsByName);
      }
      if (!vendorsByName.has(data.vendorName.trim().toLowerCase())) {
        errors.push({ field: "vendorName", message: `vendor_not_found:${data.vendorName}` });
      }
    }

    // No duplicate check — unlike a building name or a tenant's ID number, an
    // expense has no natural uniqueness key (the same description/amount can
    // legitimately recur, e.g. a recurring monthly bill), so there's nothing
    // meaningful to flag as a duplicate here.

    return errors;
  },

  async createRow(data, ctx) {
    const catCacheKey = `expense-import-categories:${ctx.organizationId}`;
    const categoriesByName = ctx.cache.get(catCacheKey) as Map<string, string> | undefined;
    const categoryId = categoriesByName?.get(data.categoryName.trim().toLowerCase());
    if (!categoryId) throw new Error(`category_not_found:${data.categoryName}`);

    const propCacheKey = `expense-import-properties:${ctx.organizationId}`;
    const propertiesByName = ctx.cache.get(propCacheKey) as Map<string, string> | undefined;
    const propertyId = propertiesByName?.get(data.propertyName.trim().toLowerCase());
    if (!propertyId) throw new Error(`building_not_found:${data.propertyName}`);

    let vendorId: string | undefined;
    if (data.vendorName) {
      const vendorCacheKey = `expense-import-vendors:${ctx.organizationId}`;
      const vendorsByName = ctx.cache.get(vendorCacheKey) as Map<string, string> | undefined;
      vendorId = vendorsByName?.get(data.vendorName.trim().toLowerCase());
      if (!vendorId) throw new Error(`vendor_not_found:${data.vendorName}`);
    }

    const created = await createExpenseCore(
      {
        categoryId,
        propertyId,
        description: data.description,
        amount: data.amount,
        vendorId,
        notes: data.notes,
        submittedAt: data.date,
      },
      ctx.organizationId,
      ctx.userId,
    );

    return { id: created.id };
  },

  async undoRow(entityId, organizationId) {
    const expense = await prisma.expense.findUnique({
      where: { id: entityId },
      select: { organizationId: true, status: true },
    });
    if (!expense || expense.organizationId !== organizationId) {
      throw new Error("not_found");
    }
    // Approved/processed expenses have already affected reports and (once
    // processed) the cash ledger — deleting them out from under that would
    // silently change historical totals. Only a still-pending expense (never
    // touched by anyone) is safe to undo.
    if (expense.status !== "PENDING") {
      throw new Error(`blocked_by_status:${expense.status}`);
    }
    await prisma.expense.delete({ where: { id: entityId } });
  },
};
