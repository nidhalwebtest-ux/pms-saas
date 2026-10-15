/**
 * WhatsApp template model shared by the Settings editor (client) and the
 * server (create / send). Pure functions only — safe to import anywhere.
 *
 * Staff write templates with NAMED PMS fields, e.g. «مرحبًا {{guest_name}}».
 * Meta only accepts positional variables ({{1}}, {{2}} …) plus sample values,
 * so `toMetaComponents` numbers them per component and records the mapping in
 * `variableMap`; at send time `buildSendComponents` fills each slot from the
 * record (reservation / invoice / payment) being shared.
 */

export type TemplateCategory = "UTILITY" | "MARKETING";
export type TemplateLanguage = "ar" | "en";
export type TemplatePurpose = "RESERVATION_CONFIRMATION" | "ARRIVAL_REMINDER" | "INVOICE" | "RECEIPT" | "CUSTOM";
/** Document types a template can be sent from (matches the Share button types). */
export type SendDocType = "reservation" | "invoice" | "receipt";

export const PURPOSE_DOC: Record<TemplatePurpose, SendDocType[]> = {
  RESERVATION_CONFIRMATION: ["reservation"],
  ARRIVAL_REMINDER: ["reservation"],
  INVOICE: ["invoice"],
  RECEIPT: ["receipt"],
  CUSTOM: ["reservation", "invoice", "receipt"],
};

// ── PMS fields usable as variables ───────────────────────────────────────────
export type PmsField =
  | "guest_name" | "org_name" | "property_name" | "unit_name"
  | "reservation_number" | "check_in" | "check_out" | "nights"
  | "invoice_number" | "invoice_total" | "amount_due"
  | "receipt_number" | "payment_amount" | "document_link";

/** Which fields each document type can fill. */
export const FIELDS_BY_DOC: Record<SendDocType, PmsField[]> = {
  reservation: ["guest_name", "org_name", "property_name", "unit_name", "reservation_number", "check_in", "check_out", "nights", "amount_due", "document_link"],
  invoice:     ["guest_name", "org_name", "property_name", "unit_name", "reservation_number", "invoice_number", "invoice_total", "amount_due", "document_link"],
  receipt:     ["guest_name", "org_name", "receipt_number", "payment_amount", "invoice_number", "document_link"],
};

export const PMS_FIELDS: PmsField[] = [
  "guest_name", "org_name", "property_name", "unit_name", "reservation_number", "check_in", "check_out", "nights",
  "invoice_number", "invoice_total", "amount_due", "receipt_number", "payment_amount", "document_link",
];

/** Sample values submitted to Meta for review (Meta requires an example per variable). */
export const FIELD_SAMPLES: Record<TemplateLanguage, Record<PmsField, string>> = {
  ar: {
    guest_name: "سالم البلوشي", org_name: "فندق الواحة", property_name: "برج الواحة", unit_name: "204",
    reservation_number: "RES-2026-00123", check_in: "1 يوليو 2026", check_out: "5 يوليو 2026", nights: "4",
    invoice_number: "INV-2026-00045", invoice_total: "120.000 ر.ع", amount_due: "120.000 ر.ع",
    receipt_number: "PAY-2026-00031", payment_amount: "120.000 ر.ع", document_link: "https://binaya.app/Ab3dE7k",
  },
  en: {
    guest_name: "Salim Al Balushi", org_name: "Al Waha Hotel", property_name: "Al Waha Tower", unit_name: "204",
    reservation_number: "RES-2026-00123", check_in: "1 Jul 2026", check_out: "5 Jul 2026", nights: "4",
    invoice_number: "INV-2026-00045", invoice_total: "OMR 120.000", amount_due: "OMR 120.000",
    receipt_number: "PAY-2026-00031", payment_amount: "OMR 120.000", document_link: "https://binaya.app/Ab3dE7k",
  },
};

// ── Editor model ─────────────────────────────────────────────────────────────
export interface TemplateButton {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;          // static URL (URL buttons)
  phone?: string;        // E.164 digits (PHONE_NUMBER buttons)
}
export interface TemplateDraft {
  name: string;
  language: TemplateLanguage;
  category: TemplateCategory;
  purpose: TemplatePurpose;
  header?: string;       // text header (may contain ONE variable)
  body: string;
  footer?: string;
  buttons?: TemplateButton[];
}

export interface VariableMap {
  header: PmsField[];
  body: PmsField[];
}

const TOKEN_RE = /\{\{\s*([a-z_]+)\s*\}\}/g;

export function extractFields(text: string | undefined): string[] {
  if (!text) return [];
  return [...text.matchAll(TOKEN_RE)].map((m) => m[1]);
}

function numberTokens(text: string): { text: string; fields: PmsField[] } {
  const fields: PmsField[] = [];
  const out = text.replace(TOKEN_RE, (_m, key: string) => {
    fields.push(key as PmsField);
    return `{{${fields.length}}}`;
  });
  return { text: out, fields };
}

/** Convert a draft into Meta's `components` array + the slot → field mapping. */
export function toMetaComponents(d: TemplateDraft): { components: unknown[]; variableMap: VariableMap } {
  const samples = FIELD_SAMPLES[d.language];
  const components: unknown[] = [];
  const variableMap: VariableMap = { header: [], body: [] };

  if (d.header?.trim()) {
    const h = numberTokens(d.header.trim());
    variableMap.header = h.fields;
    components.push({
      type: "HEADER", format: "TEXT", text: h.text,
      ...(h.fields.length ? { example: { header_text: h.fields.map((f) => samples[f]) } } : {}),
    });
  }
  const b = numberTokens(d.body.trim());
  variableMap.body = b.fields;
  components.push({
    type: "BODY", text: b.text,
    ...(b.fields.length ? { example: { body_text: [b.fields.map((f) => samples[f])] } } : {}),
  });
  if (d.footer?.trim()) components.push({ type: "FOOTER", text: d.footer.trim() });
  if (d.buttons?.length) {
    components.push({
      type: "BUTTONS",
      buttons: d.buttons.map((btn) =>
        btn.type === "URL" ? { type: "URL", text: btn.text, url: btn.url }
        : btn.type === "PHONE_NUMBER" ? { type: "PHONE_NUMBER", text: btn.text, phone_number: btn.phone }
        : { type: "QUICK_REPLY", text: btn.text }),
    });
  }
  return { components, variableMap };
}

/** Render a template with values (sample or real) — used by the live preview. */
export function renderText(text: string | undefined, values: Partial<Record<PmsField, string>>): string {
  if (!text) return "";
  return text.replace(TOKEN_RE, (_m, key: string) => values[key as PmsField] ?? `{{${key}}}`);
}

/** Render Meta's positional text ({{1}}…) back to named tokens for display. */
export function namedFromPositional(text: string, fields: string[]): string {
  return text.replace(/\{\{(\d+)\}\}/g, (_m, n: string) => (fields[Number(n) - 1] ? `{{${fields[Number(n) - 1]}}}` : `{{${n}}}`));
}

/** Parameters for POST /messages, filled from the record's values. */
export function buildSendComponents(map: VariableMap, values: Partial<Record<PmsField, string>>): unknown[] {
  const param = (f: PmsField) => ({ type: "text", text: (values[f] ?? "").trim() || "-" });
  const out: unknown[] = [];
  if (map.header.length) out.push({ type: "header", parameters: map.header.map(param) });
  if (map.body.length) out.push({ type: "body", parameters: map.body.map(param) });
  return out;
}

// ── Validation (mirrors Meta's documented rules, so staff get errors before review) ──
export type DraftError =
  | "nameFormat" | "bodyRequired" | "bodyTooLong" | "headerTooLong" | "footerTooLong"
  | "headerVars" | "footerVars" | "unknownField" | "varAtEdge" | "adjacentVars"
  | "tooManyButtons" | "buttonText" | "buttonUrl" | "buttonPhone";

export function validateDraft(d: TemplateDraft): DraftError[] {
  const errs = new Set<DraftError>();
  if (!/^[a-z0-9_]{1,512}$/.test(d.name)) errs.add("nameFormat");
  const body = d.body.trim();
  if (!body) errs.add("bodyRequired");
  if (body.length > 1024) errs.add("bodyTooLong");
  if ((d.header ?? "").trim().length > 60) errs.add("headerTooLong");
  if ((d.footer ?? "").trim().length > 60) errs.add("footerTooLong");
  if (extractFields(d.header).length > 1) errs.add("headerVars");
  if (extractFields(d.footer).length > 0) errs.add("footerVars");
  for (const f of [...extractFields(d.header), ...extractFields(body)]) {
    if (!PMS_FIELDS.includes(f as PmsField)) errs.add("unknownField");
  }
  // Meta rejects bodies that start/end with a variable or have two variables side by side.
  if (/^\{\{[^}]+\}\}/.test(body) || /\{\{[^}]+\}\}[\s.!?،؟]*$/.test(body)) errs.add("varAtEdge");
  if (/\}\}\s*\{\{/.test(body)) errs.add("adjacentVars");
  const btns = d.buttons ?? [];
  if (btns.length > 3) errs.add("tooManyButtons");
  for (const b of btns) {
    if (!b.text.trim() || b.text.length > 25) errs.add("buttonText");
    if (b.type === "URL" && !/^https:\/\/\S+$/.test(b.url ?? "")) errs.add("buttonUrl");
    if (b.type === "PHONE_NUMBER" && !/^\+?\d{8,15}$/.test(b.phone ?? "")) errs.add("buttonPhone");
  }
  return [...errs];
}

/** Fields a template uses that the given document type can't fill. */
export function unsupportedFields(map: VariableMap, doc: SendDocType): PmsField[] {
  const ok = new Set(FIELDS_BY_DOC[doc]);
  return [...map.header, ...map.body].filter((f) => !ok.has(f));
}

// ── Starter templates (Arabic + English, UTILITY) ────────────────────────────
export const STARTERS: TemplateDraft[] = [
  {
    name: "binaya_reservation_confirmation", language: "ar", category: "UTILITY", purpose: "RESERVATION_CONFIRMATION",
    header: "تأكيد الحجز",
    body: "مرحبًا {{guest_name}}، تم تأكيد حجزك رقم {{reservation_number}} في {{property_name}} من {{check_in}} إلى {{check_out}}.\nتفاصيل الحجز: {{document_link}}\nنتطلع لاستقبالك.",
    footer: "شكرًا لاختيارك لنا",
  },
  {
    name: "binaya_reservation_confirmation", language: "en", category: "UTILITY", purpose: "RESERVATION_CONFIRMATION",
    header: "Booking confirmed",
    body: "Hello {{guest_name}}, your reservation {{reservation_number}} at {{property_name}} is confirmed from {{check_in}} to {{check_out}}.\nDetails: {{document_link}}\nWe look forward to welcoming you.",
    footer: "Thank you for choosing us",
  },
  {
    name: "binaya_arrival_reminder", language: "ar", category: "UTILITY", purpose: "ARRIVAL_REMINDER",
    body: "مرحبًا {{guest_name}}، نذكّرك بموعد وصولك إلى {{property_name}} يوم {{check_in}}. رقم الحجز {{reservation_number}}.\nنتطلع لاستقبالك.",
  },
  {
    name: "binaya_arrival_reminder", language: "en", category: "UTILITY", purpose: "ARRIVAL_REMINDER",
    body: "Hello {{guest_name}}, a reminder that your arrival at {{property_name}} is on {{check_in}}. Reservation {{reservation_number}}.\nWe look forward to welcoming you.",
  },
  {
    name: "binaya_invoice", language: "ar", category: "UTILITY", purpose: "INVOICE",
    header: "فاتورة جديدة",
    body: "مرحبًا {{guest_name}}، فاتورتك رقم {{invoice_number}} بقيمة {{invoice_total}} جاهزة.\nعرض الفاتورة: {{document_link}}\nشكرًا لك.",
  },
  {
    name: "binaya_invoice", language: "en", category: "UTILITY", purpose: "INVOICE",
    header: "New invoice",
    body: "Hello {{guest_name}}, your invoice {{invoice_number}} for {{invoice_total}} is ready.\nView invoice: {{document_link}}\nThank you.",
  },
  {
    name: "binaya_payment_receipt", language: "ar", category: "UTILITY", purpose: "RECEIPT",
    header: "إيصال دفع",
    body: "مرحبًا {{guest_name}}، استلمنا دفعتك بمبلغ {{payment_amount}}. رقم الإيصال {{receipt_number}}.\nعرض الإيصال: {{document_link}}\nشكرًا لك.",
  },
  {
    name: "binaya_payment_receipt", language: "en", category: "UTILITY", purpose: "RECEIPT",
    header: "Payment receipt",
    body: "Hello {{guest_name}}, we received your payment of {{payment_amount}}. Receipt {{receipt_number}}.\nView receipt: {{document_link}}\nThank you.",
  },
];
