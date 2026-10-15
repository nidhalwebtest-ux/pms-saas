/**
 * WhatsApp Business integration — server-side service (SERVER ONLY).
 *
 * All functions take the caller's organizationId (from the session) and only
 * ever read/write that org's rows. The access token is decrypted here, used for
 * the Graph call, and never returned to callers that render UI.
 */
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "./crypto";
import * as graph from "./graph";
import {
  toMetaComponents, buildSendComponents, validateDraft, unsupportedFields, FIELD_SAMPLES,
  type TemplateDraft, type VariableMap, type PmsField, type SendDocType, type TemplateLanguage,
} from "./template-model";
import { shortCode } from "@/lib/share-token";

export type ServiceResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; detail?: string };

const fail = (error: string, detail?: string) => ({ ok: false as const, error, detail });
function graphFail(e: unknown, fallback = "graph") {
  if (e instanceof graph.GraphError) {
    if (e.code === 190) return fail("tokenInvalid", e.message);          // expired / revoked token
    if (e.code === 100 || e.status === 400) return fail(fallback, e.userMessage || e.message);
    if (e.code === 131030) return fail("recipientNotAllowed", e.message); // test number allow-list
    return fail(fallback, e.userMessage || e.message);
  }
  return fail(fallback, e instanceof Error ? e.message : undefined);
}

/** Digits only, Oman default for bare 8-digit local numbers (mirrors utils/whatsapp waNumber). */
export function toWaPhone(phone: string | null | undefined): string {
  let d = (phone ?? "").replace(/[^\d]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 8) d = "968" + d;
  return d;
}

// ── Account ──────────────────────────────────────────────────────────────────
export interface AccountView {
  connected: boolean;
  wabaId?: string;
  phoneNumberId?: string;
  displayPhone?: string;
  verifiedName?: string | null;
  qualityRating?: string | null;
  status?: string;
  lastError?: string | null;
  tokenLast4?: string;
  webhookSubscribed?: boolean;
  connectedAt?: string;
}

export async function getAccountView(organizationId: string): Promise<AccountView> {
  const a = await prisma.whatsAppAccount.findUnique({ where: { organizationId } });
  if (!a) return { connected: false };
  return {
    connected: true, wabaId: a.wabaId, phoneNumberId: a.phoneNumberId, displayPhone: a.displayPhone,
    verifiedName: a.verifiedName, qualityRating: a.qualityRating, status: a.status, lastError: a.lastError,
    tokenLast4: a.tokenLast4, webhookSubscribed: !!a.webhookSubscribedAt, connectedAt: a.createdAt.toISOString(),
  };
}

async function loadAccount(organizationId: string) {
  const a = await prisma.whatsAppAccount.findUnique({ where: { organizationId } });
  if (!a) return null;
  return { ...a, token: decryptSecret(a.accessTokenEnc) };
}

/**
 * Manual connection: verify the credentials against Meta (the phone number must
 * belong to the WABA), subscribe Binaya's app to the WABA webhooks, store the
 * token encrypted, then import the WABA's existing templates.
 */
export async function connectManual(
  organizationId: string, userId: string,
  input: { wabaId: string; phoneNumberId: string; accessToken: string },
): Promise<ServiceResult<AccountView>> {
  const wabaId = input.wabaId.trim(), phoneNumberId = input.phoneNumberId.trim(), token = input.accessToken.trim();
  if (!/^\d{5,25}$/.test(wabaId)) return fail("wabaIdFormat");
  if (!/^\d{5,25}$/.test(phoneNumberId)) return fail("phoneIdFormat");
  if (token.length < 20) return fail("tokenFormat");

  const taken = await prisma.whatsAppAccount.findUnique({ where: { phoneNumberId }, select: { organizationId: true } });
  if (taken && taken.organizationId !== organizationId) return fail("numberInUse");

  let phone: graph.PhoneNumberInfo;
  try {
    phone = await graph.getPhoneNumber(token, phoneNumberId);
    const nums = await graph.listPhoneNumbers(token, wabaId);
    if (!nums.data?.some((n) => n.id === phoneNumberId)) return fail("numberNotInWaba");
  } catch (e) {
    return graphFail(e, "verifyFailed");
  }

  let subscribedAt: Date | null = null;
  let lastError: string | null = null;
  try {
    await graph.subscribeApp(token, wabaId);
    subscribedAt = new Date();
  } catch (e) {
    lastError = e instanceof Error ? e.message : "subscribe failed";
  }

  const data = {
    wabaId, phoneNumberId,
    displayPhone: phone.display_phone_number,
    verifiedName: phone.verified_name ?? null,
    qualityRating: phone.quality_rating ?? null,
    accessTokenEnc: encryptSecret(token),
    tokenLast4: token.slice(-4),
    connectionType: "MANUAL",
    status: "CONNECTED",
    lastError,
    webhookSubscribedAt: subscribedAt,
    connectedById: userId,
  };
  await prisma.whatsAppAccount.upsert({ where: { organizationId }, create: { organizationId, ...data }, update: data });
  await syncTemplates(organizationId);
  return { ok: true, data: await getAccountView(organizationId) };
}

/** Refresh number details (name, quality rating) and re-check the token. */
export async function refreshAccount(organizationId: string): Promise<ServiceResult<AccountView>> {
  const a = await loadAccount(organizationId);
  if (!a) return fail("notConnected");
  try {
    const p = await graph.getPhoneNumber(a.token, a.phoneNumberId);
    await prisma.whatsAppAccount.update({
      where: { organizationId },
      data: { displayPhone: p.display_phone_number, verifiedName: p.verified_name ?? null, qualityRating: p.quality_rating ?? null, status: "CONNECTED", lastError: null },
    });
  } catch (e) {
    const r = graphFail(e, "verifyFailed");
    await prisma.whatsAppAccount.update({ where: { organizationId }, data: { status: "ERROR", lastError: r.detail ?? r.error } });
    return r;
  }
  return { ok: true, data: await getAccountView(organizationId) };
}

/** Disconnect: best-effort webhook unsubscribe, then remove the account + templates (message log is kept). */
export async function disconnect(organizationId: string): Promise<ServiceResult> {
  const a = await loadAccount(organizationId);
  if (!a) return { ok: true, data: undefined };
  try { await graph.unsubscribeApp(a.token, a.wabaId); } catch { /* token may already be revoked */ }
  await prisma.$transaction([
    prisma.whatsAppTemplate.deleteMany({ where: { organizationId } }),
    prisma.whatsAppAccount.delete({ where: { organizationId } }),
  ]);
  return { ok: true, data: undefined };
}

// ── Templates ────────────────────────────────────────────────────────────────
export interface TemplateView {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  rejectedReason: string | null;
  purpose: string;
  components: unknown[];
  variableMap: VariableMap | null;
  updatedAt: string;
}

export async function listTemplateViews(organizationId: string): Promise<TemplateView[]> {
  const rows = await prisma.whatsAppTemplate.findMany({ where: { organizationId }, orderBy: [{ name: "asc" }, { language: "asc" }] });
  return rows.map((t) => ({
    id: t.id, name: t.name, language: t.language, category: t.category, status: t.status,
    rejectedReason: t.rejectedReason, purpose: t.purpose, components: (t.components as unknown[]) ?? [],
    variableMap: (t.variableMap as VariableMap | null) ?? null, updatedAt: t.updatedAt.toISOString(),
  }));
}

/** Pull templates from Meta: upsert by (name, language); drop rows deleted on Meta's side. */
export async function syncTemplates(organizationId: string): Promise<ServiceResult<{ count: number }>> {
  const a = await loadAccount(organizationId);
  if (!a) return fail("notConnected");
  let remote: graph.MetaTemplate[];
  try { remote = await graph.listTemplates(a.token, a.wabaId); } catch (e) { return graphFail(e, "syncFailed"); }

  const existing = await prisma.whatsAppTemplate.findMany({ where: { organizationId }, select: { id: true, name: true, language: true } });
  const key = (n: string, l: string) => `${n}::${l}`;
  const seen = new Set<string>();
  for (const t of remote) {
    seen.add(key(t.name, t.language));
    await prisma.whatsAppTemplate.upsert({
      where: { organizationId_name_language: { organizationId, name: t.name, language: t.language } },
      create: {
        organizationId, name: t.name, language: t.language, metaTemplateId: t.id, category: t.category,
        status: t.status, rejectedReason: t.rejected_reason && t.rejected_reason !== "NONE" ? t.rejected_reason : null,
        components: (t.components ?? []) as object[],
      },
      update: {
        metaTemplateId: t.id, category: t.category, status: t.status, components: (t.components ?? []) as object[],
        rejectedReason: t.rejected_reason && t.rejected_reason !== "NONE" ? t.rejected_reason : null,
      },
    });
  }
  const gone = existing.filter((r) => !seen.has(key(r.name, r.language))).map((r) => r.id);
  if (gone.length) await prisma.whatsAppTemplate.deleteMany({ where: { organizationId, id: { in: gone } } });
  return { ok: true, data: { count: remote.length } };
}

export async function createTemplate(organizationId: string, userId: string, draft: TemplateDraft): Promise<ServiceResult<TemplateView[]>> {
  const errors = validateDraft(draft);
  if (errors.length) return fail("invalid", errors.join(","));
  const a = await loadAccount(organizationId);
  if (!a) return fail("notConnected");
  const dup = await prisma.whatsAppTemplate.findUnique({
    where: { organizationId_name_language: { organizationId, name: draft.name, language: draft.language } }, select: { id: true },
  });
  if (dup) return fail("duplicate");

  const { components, variableMap } = toMetaComponents(draft);
  let res: { id: string; status: string; category: string };
  try {
    res = await graph.createTemplate(a.token, a.wabaId, { name: draft.name, language: draft.language, category: draft.category, components });
  } catch (e) {
    return graphFail(e, "createFailed");
  }
  await prisma.whatsAppTemplate.create({
    data: {
      organizationId, metaTemplateId: res.id, name: draft.name, language: draft.language,
      category: res.category || draft.category, status: res.status || "PENDING", purpose: draft.purpose,
      components: components as object[], variableMap: variableMap as unknown as object, createdById: userId,
    },
  });
  return { ok: true, data: await listTemplateViews(organizationId) };
}

/** Create the starter set (skips ones that already exist). */
export async function createStarters(organizationId: string, userId: string, drafts: TemplateDraft[]): Promise<ServiceResult<{ created: number; skipped: number; failed: string[] }>> {
  let created = 0, skipped = 0;
  const failed: string[] = [];
  for (const d of drafts) {
    const r = await createTemplate(organizationId, userId, d);
    if (r.ok) created++;
    else if (r.error === "duplicate") skipped++;
    else failed.push(`${d.name}/${d.language}: ${r.detail ?? r.error}`);
    if (!r.ok && (r.error === "notConnected" || r.error === "tokenInvalid")) return r as ServiceResult<never>;
  }
  return { ok: true, data: { created, skipped, failed } };
}

export async function deleteTemplate(organizationId: string, id: string): Promise<ServiceResult> {
  const t = await prisma.whatsAppTemplate.findFirst({ where: { id, organizationId } });
  if (!t) return fail("notFound");
  const a = await loadAccount(organizationId);
  if (!a) return fail("notConnected");
  try { await graph.deleteTemplate(a.token, a.wabaId, t.name, t.metaTemplateId ?? undefined); }
  catch (e) {
    // Already gone on Meta's side → still remove our row.
    if (!(e instanceof graph.GraphError && (e.status === 404 || e.subcode === 2593002))) return graphFail(e, "deleteFailed");
  }
  await prisma.whatsAppTemplate.delete({ where: { id: t.id } });
  return { ok: true, data: undefined };
}

/** Purpose is a Binaya-side label (which Share button offers the template). */
export async function setTemplatePurpose(organizationId: string, id: string, purpose: string): Promise<ServiceResult> {
  const r = await prisma.whatsAppTemplate.updateMany({ where: { id, organizationId }, data: { purpose } });
  return r.count ? { ok: true, data: undefined } : fail("notFound");
}

// ── Document values + sending ────────────────────────────────────────────────
const fmtAmount = (v: unknown, lang: TemplateLanguage) => {
  const n = Number(v ?? 0).toFixed(3);
  return lang === "ar" ? `${n} ر.ع` : `OMR ${n}`;
};
const fmtDate = (d: Date | null | undefined, lang: TemplateLanguage) =>
  d ? new Intl.DateTimeFormat(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Muscat" }).format(d) : "";

export interface DocContext {
  values: Partial<Record<PmsField, string>>;
  phone: string | null;
  guestName: string;
}

/** Collect a document's values for one language. Creates a short share link for {{document_link}}. */
export async function documentContext(
  organizationId: string, userId: string, doc: SendDocType, id: string, lang: TemplateLanguage, origin: string, withLink: boolean,
): Promise<DocContext | null> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
  const v: Partial<Record<PmsField, string>> = { org_name: org?.name ?? "" };
  let tenant: { firstName: string; lastName: string; phone: string | null; whatsappNumber: string | null } | null = null;

  if (doc === "reservation") {
    const r = await prisma.reservation.findFirst({
      where: { id, organizationId },
      select: {
        reservationNumber: true, startDate: true, endDate: true, totalAmount: true,
        tenant: { select: { firstName: true, lastName: true, phone: true, whatsappNumber: true } },
        unit: { select: { name: true, property: { select: { name: true } } } },
        reservationUnits: { select: { unit: { select: { name: true, property: { select: { name: true } } } } } },
        invoices: { where: { status: { not: "CANCELLED" } }, select: { balanceDue: true } },
      },
    });
    if (!r) return null;
    tenant = r.tenant;
    const units = r.reservationUnits.length ? r.reservationUnits.map((x) => x.unit) : r.unit ? [r.unit] : [];
    v.reservation_number = r.reservationNumber ?? "";
    v.check_in = fmtDate(r.startDate, lang);
    v.check_out = fmtDate(r.endDate, lang);
    v.nights = String(Math.max(1, Math.round((r.endDate.getTime() - r.startDate.getTime()) / 86_400_000)));
    v.unit_name = units.map((u) => u.name).join("، ");
    v.property_name = units[0]?.property.name ?? "";
    v.amount_due = fmtAmount(r.invoices.reduce((s, i) => s + Number(i.balanceDue), 0), lang);
  } else if (doc === "invoice") {
    const inv = await prisma.invoice.findFirst({
      where: { id, organizationId },
      select: {
        invoiceNumber: true, totalAmount: true, balanceDue: true,
        tenant: { select: { firstName: true, lastName: true, phone: true, whatsappNumber: true } },
        property: { select: { name: true } },
        reservation: { select: { reservationNumber: true, unit: { select: { name: true } }, reservationUnits: { select: { unit: { select: { name: true } } } } } },
      },
    });
    if (!inv) return null;
    tenant = inv.tenant;
    v.invoice_number = inv.invoiceNumber;
    v.invoice_total = fmtAmount(inv.totalAmount, lang);
    v.amount_due = fmtAmount(inv.balanceDue, lang);
    v.property_name = inv.property?.name ?? "";
    v.reservation_number = inv.reservation?.reservationNumber ?? "";
    const units = inv.reservation?.reservationUnits.length ? inv.reservation.reservationUnits.map((x) => x.unit) : inv.reservation?.unit ? [inv.reservation.unit] : [];
    v.unit_name = units.map((u) => u.name).join("، ");
  } else {
    const pay = await prisma.payment.findFirst({
      where: { id, tenant: { organizationId } },
      select: {
        paymentNumber: true, amount: true,
        tenant: { select: { firstName: true, lastName: true, phone: true, whatsappNumber: true } },
        allocations: { select: { invoice: { select: { invoiceNumber: true } } }, take: 1 },
      },
    });
    if (!pay) return null;
    tenant = pay.tenant;
    v.receipt_number = pay.paymentNumber ?? id.slice(0, 8).toUpperCase();
    v.payment_amount = fmtAmount(pay.amount, lang);
    v.invoice_number = pay.allocations[0]?.invoice.invoiceNumber ?? "";
  }

  const guestName = tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : "";
  v.guest_name = guestName;
  if (withLink) {
    let code = shortCode(7);
    for (let i = 0; i < 5 && (await prisma.shareLink.findUnique({ where: { code }, select: { id: true } })); i++) code = shortCode(i < 4 ? 7 : 10);
    await prisma.shareLink.create({ data: { code, organizationId, docType: doc, docId: id, createdById: userId } });
    v.document_link = `${origin}/${code}`;
  }
  return { values: v, phone: tenant?.whatsappNumber || tenant?.phone || null, guestName };
}

/** Templates offered for a document: approved, Binaya-mapped, and fully fillable from that document. */
export async function templatesForDoc(organizationId: string, doc: SendDocType) {
  const purposes: Record<SendDocType, string[]> = {
    reservation: ["RESERVATION_CONFIRMATION", "ARRIVAL_REMINDER", "CUSTOM"],
    invoice: ["INVOICE", "CUSTOM"],
    receipt: ["RECEIPT", "CUSTOM"],
  };
  const rows = await prisma.whatsAppTemplate.findMany({
    where: { organizationId, status: "APPROVED", purpose: { in: purposes[doc] } },
    orderBy: [{ purpose: "asc" }, { name: "asc" }],
  });
  return rows.filter((t) => {
    const map = t.variableMap as VariableMap | null;
    return !map || unsupportedFields(map, doc).length === 0;
  });
}

export async function sendForDocument(
  organizationId: string, userId: string,
  input: { doc: SendDocType; id: string; templateId: string; to: string },
  origin: string,
): Promise<ServiceResult<{ messageId: string }>> {
  const a = await loadAccount(organizationId);
  if (!a) return fail("notConnected");
  const t = await prisma.whatsAppTemplate.findFirst({ where: { id: input.templateId, organizationId } });
  if (!t) return fail("templateNotFound");
  if (t.status !== "APPROVED") return fail("templateNotApproved");
  const map = (t.variableMap as VariableMap | null) ?? { header: [], body: [] };
  if (!t.variableMap && JSON.stringify(t.components).includes("{{")) return fail("templateNotMapped");
  if (unsupportedFields(map, input.doc).length) return fail("templateNotForDoc");

  const to = toWaPhone(input.to);
  if (to.length < 8) return fail("phoneInvalid");
  const lang = (t.language.startsWith("ar") ? "ar" : "en") as TemplateLanguage;
  const needsLink = [...map.header, ...map.body].includes("document_link");
  const ctx = await documentContext(organizationId, userId, input.doc, input.id, lang, origin, needsLink);
  if (!ctx) return fail("notFound");

  return deliver(a, t, to, buildSendComponents(map, ctx.values), { entityType: input.doc, entityId: input.id, userId, organizationId });
}

/** Test send from Settings, filled with the sample values. */
export async function sendTest(organizationId: string, userId: string, templateId: string, toRaw: string): Promise<ServiceResult<{ messageId: string }>> {
  const a = await loadAccount(organizationId);
  if (!a) return fail("notConnected");
  const t = await prisma.whatsAppTemplate.findFirst({ where: { id: templateId, organizationId } });
  if (!t) return fail("templateNotFound");
  if (t.status !== "APPROVED") return fail("templateNotApproved");
  const to = toWaPhone(toRaw);
  if (to.length < 8) return fail("phoneInvalid");
  const map = (t.variableMap as VariableMap | null) ?? { header: [], body: [] };
  if (!t.variableMap && JSON.stringify(t.components).includes("{{")) return fail("templateNotMapped");
  const lang = (t.language.startsWith("ar") ? "ar" : "en") as TemplateLanguage;
  return deliver(a, t, to, buildSendComponents(map, FIELD_SAMPLES[lang]), { entityType: "test", entityId: null, userId, organizationId });
}

async function deliver(
  a: { token: string; phoneNumberId: string },
  t: { id: string; name: string; language: string },
  to: string, components: unknown[],
  meta: { entityType: string; entityId: string | null; userId: string; organizationId: string },
): Promise<ServiceResult<{ messageId: string }>> {
  try {
    const res = await graph.sendTemplateMessage(a.token, a.phoneNumberId, { to, name: t.name, language: t.language, components });
    const waId = res.messages?.[0]?.id ?? null;
    const row = await prisma.whatsAppMessage.create({
      data: {
        organizationId: meta.organizationId, direction: "OUT", templateId: t.id, templateName: t.name, language: t.language,
        toPhone: to, waMessageId: waId, status: "SENT", entityType: meta.entityType, entityId: meta.entityId,
        sentById: meta.userId, statusAt: new Date(),
      },
    });
    return { ok: true, data: { messageId: row.id } };
  } catch (e) {
    const r = graphFail(e, "sendFailed");
    await prisma.whatsAppMessage.create({
      data: {
        organizationId: meta.organizationId, direction: "OUT", templateId: t.id, templateName: t.name, language: t.language,
        toPhone: to, status: "FAILED", errorCode: e instanceof graph.GraphError ? String(e.code ?? e.status) : null,
        errorMessage: r.detail ?? r.error, entityType: meta.entityType, entityId: meta.entityId, sentById: meta.userId, statusAt: new Date(),
      },
    });
    if (r.error === "tokenInvalid") {
      await prisma.whatsAppAccount.update({ where: { organizationId: meta.organizationId }, data: { status: "ERROR", lastError: r.detail ?? "token invalid" } });
    }
    return r;
  }
}

/** Recent messages for one document (shown in the send dialog). */
export async function messagesForDoc(organizationId: string, doc: string, id: string) {
  return prisma.whatsAppMessage.findMany({
    where: { organizationId, entityType: doc, entityId: id },
    orderBy: { createdAt: "desc" }, take: 5,
    select: { id: true, templateName: true, toPhone: true, status: true, errorMessage: true, createdAt: true, statusAt: true },
  });
}
