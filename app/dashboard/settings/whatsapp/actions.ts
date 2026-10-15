"use server";

import { revalidatePath } from "next/cache";
import { requireOrgUser } from "@/lib/tenant";
import { hasAccess } from "@/lib/access";
import * as wa from "@/lib/whatsapp/service";
import { STARTERS, type TemplateDraft, type TemplateLanguage, type TemplatePurpose } from "@/lib/whatsapp/template-model";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string; detail?: string };

const PATH = "/dashboard/settings/whatsapp";
const PURPOSES: TemplatePurpose[] = ["RESERVATION_CONFIRMATION", "ARRIVAL_REMINDER", "INVOICE", "RECEIPT", "CUSTOM"];

async function editor() {
  let u;
  try { u = await requireOrgUser(); } catch { return null; }
  if (!(await hasAccess("settingsWhatsapp", "EDIT"))) return null;
  if (!process.env.WHATSAPP_TOKEN_KEY) return null;
  return u;
}

function done<T>(r: wa.ServiceResult<T>): ActionResult<T> {
  if (!r.ok) return { ok: false, error: r.error, detail: r.detail };
  revalidatePath(PATH);
  return { ok: true, data: r.data };
}

export async function connectWhatsApp(input: { wabaId: string; phoneNumberId: string; accessToken: string }): Promise<ActionResult> {
  const u = await editor();
  if (!u) return { ok: false, error: "forbidden" };
  const r = await wa.connectManual(u.organizationId, u.userId, input);
  return r.ok ? done({ ok: true, data: undefined }) : { ok: false, error: r.error, detail: r.detail };
}

export async function refreshWhatsApp(): Promise<ActionResult> {
  const u = await editor();
  if (!u) return { ok: false, error: "forbidden" };
  const r = await wa.refreshAccount(u.organizationId);
  return r.ok ? done({ ok: true, data: undefined }) : { ok: false, error: r.error, detail: r.detail };
}

export async function disconnectWhatsApp(): Promise<ActionResult> {
  const u = await editor();
  if (!u) return { ok: false, error: "forbidden" };
  return done(await wa.disconnect(u.organizationId));
}

export async function syncWhatsAppTemplates(): Promise<ActionResult<{ count: number }>> {
  const u = await editor();
  if (!u) return { ok: false, error: "forbidden" };
  return done(await wa.syncTemplates(u.organizationId));
}

export async function createWhatsAppTemplate(draft: TemplateDraft): Promise<ActionResult> {
  const u = await editor();
  if (!u) return { ok: false, error: "forbidden" };
  if (!PURPOSES.includes(draft.purpose)) return { ok: false, error: "invalid" };
  const r = await wa.createTemplate(u.organizationId, u.userId, draft);
  return r.ok ? done({ ok: true, data: undefined }) : { ok: false, error: r.error, detail: r.detail };
}

export async function addStarterTemplates(languages: TemplateLanguage[]): Promise<ActionResult<{ created: number; skipped: number; failed: string[] }>> {
  const u = await editor();
  if (!u) return { ok: false, error: "forbidden" };
  const drafts = STARTERS.filter((s) => languages.includes(s.language));
  return done(await wa.createStarters(u.organizationId, u.userId, drafts));
}

export async function deleteWhatsAppTemplate(id: string): Promise<ActionResult> {
  const u = await editor();
  if (!u) return { ok: false, error: "forbidden" };
  return done(await wa.deleteTemplate(u.organizationId, id));
}

export async function setWhatsAppTemplatePurpose(id: string, purpose: TemplatePurpose): Promise<ActionResult> {
  const u = await editor();
  if (!u) return { ok: false, error: "forbidden" };
  if (!PURPOSES.includes(purpose)) return { ok: false, error: "invalid" };
  return done(await wa.setTemplatePurpose(u.organizationId, id, purpose));
}

export async function sendWhatsAppTest(templateId: string, phone: string): Promise<ActionResult> {
  const u = await editor();
  if (!u) return { ok: false, error: "forbidden" };
  const r = await wa.sendTest(u.organizationId, u.userId, templateId, phone);
  return r.ok ? { ok: true } : { ok: false, error: r.error, detail: r.detail };
}
