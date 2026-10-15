/**
 * Minimal typed client for the Meta Graph API (WhatsApp Business Cloud API).
 * SERVER ONLY. Every call takes the org's own access token (decrypted by the
 * caller) — Binaya never uses a shared token to act for a customer.
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

export const WHATSAPP_GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
const BASE = "https://graph.facebook.com";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
let fetchImpl: FetchLike = (input, init) => fetch(input, init);
/** Tests swap the transport; production uses global fetch. */
export function __setFetch(f: FetchLike | null) {
  fetchImpl = f ?? ((input, init) => fetch(input, init));
}

export class GraphError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: number,
    public subcode?: number,
    public userTitle?: string,
    public userMessage?: string,
  ) {
    super(message);
    this.name = "GraphError";
  }
}

async function call<T>(
  token: string,
  method: "GET" | "POST" | "DELETE",
  path: string,
  opts: { query?: Record<string, string>; body?: unknown } = {},
): Promise<T> {
  const url = new URL(`${BASE}/${WHATSAPP_GRAPH_VERSION}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  const res = await fetchImpl(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
  if (!res.ok || json?.error) {
    const e = json?.error ?? {};
    throw new GraphError(e.message || `Graph API ${res.status}`, res.status, e.code, e.error_subcode, e.error_user_title, e.error_user_msg);
  }
  return json as T;
}

// ── Account ──────────────────────────────────────────────────────────────────
export interface PhoneNumberInfo {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating?: string;          // GREEN | YELLOW | RED | UNKNOWN
  code_verification_status?: string;
  name_status?: string;
  messaging_limit_tier?: string;
}
export function getPhoneNumber(token: string, phoneNumberId: string) {
  return call<PhoneNumberInfo>(token, "GET", phoneNumberId, {
    query: { fields: "id,display_phone_number,verified_name,quality_rating,code_verification_status,name_status,messaging_limit_tier" },
  });
}

export interface WabaInfo { id: string; name?: string; currency?: string; timezone_id?: string }
export function getWaba(token: string, wabaId: string) {
  return call<WabaInfo>(token, "GET", wabaId, { query: { fields: "id,name,currency,timezone_id" } });
}

/** Lists the phone numbers of a WABA (used to check the number belongs to it). */
export function listPhoneNumbers(token: string, wabaId: string) {
  return call<{ data: PhoneNumberInfo[] }>(token, "GET", `${wabaId}/phone_numbers`, {
    query: { fields: "id,display_phone_number,verified_name,quality_rating" },
  });
}

/** Subscribe Binaya's Meta app to the WABA's webhooks (statuses, template updates). */
export function subscribeApp(token: string, wabaId: string) {
  return call<{ success: boolean }>(token, "POST", `${wabaId}/subscribed_apps`);
}
export function unsubscribeApp(token: string, wabaId: string) {
  return call<{ success: boolean }>(token, "DELETE", `${wabaId}/subscribed_apps`);
}

// ── Templates ────────────────────────────────────────────────────────────────
export type TemplateCategory = "UTILITY" | "MARKETING" | "AUTHENTICATION";
export interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  status: string;                    // APPROVED | PENDING | REJECTED | PAUSED | DISABLED | IN_APPEAL
  category: string;
  components: unknown[];
  rejected_reason?: string;
}

export async function listTemplates(token: string, wabaId: string): Promise<MetaTemplate[]> {
  const out: MetaTemplate[] = [];
  let after: string | undefined;
  for (let page = 0; page < 20; page++) {
    const q: Record<string, string> = { fields: "id,name,language,status,category,components,rejected_reason", limit: "100" };
    if (after) q.after = after;
    const res = await call<{ data: MetaTemplate[]; paging?: { cursors?: { after?: string }; next?: string } }>(
      token, "GET", `${wabaId}/message_templates`, { query: q });
    out.push(...(res.data ?? []));
    if (!res.paging?.next || !res.paging.cursors?.after) break;
    after = res.paging.cursors.after;
  }
  return out;
}

export function createTemplate(
  token: string,
  wabaId: string,
  payload: { name: string; language: string; category: TemplateCategory; components: unknown[] },
) {
  return call<{ id: string; status: string; category: string }>(token, "POST", `${wabaId}/message_templates`, { body: payload });
}

export function deleteTemplate(token: string, wabaId: string, name: string, metaTemplateId?: string) {
  const query: Record<string, string> = { name };
  if (metaTemplateId) query.hsm_id = metaTemplateId; // delete one language only
  return call<{ success: boolean }>(token, "DELETE", `${wabaId}/message_templates`, { query });
}

// ── Messages ─────────────────────────────────────────────────────────────────
export function sendTemplateMessage(
  token: string,
  phoneNumberId: string,
  msg: { to: string; name: string; language: string; components: unknown[] },
) {
  return call<{ messages: { id: string }[]; contacts?: { wa_id: string }[] }>(token, "POST", `${phoneNumberId}/messages`, {
    body: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: msg.to,
      type: "template",
      template: { name: msg.name, language: { code: msg.language }, ...(msg.components.length ? { components: msg.components } : {}) },
    },
  });
}
