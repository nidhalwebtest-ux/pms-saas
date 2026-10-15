import { NextRequest, NextResponse } from "next/server";
import { requireOrgUser } from "@/lib/tenant";
import { forbiddenIfNo } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import * as wa from "@/lib/whatsapp/service";
import { renderText, namedFromPositional, type SendDocType, type TemplateLanguage, type VariableMap } from "@/lib/whatsapp/template-model";

const DOC_ENTITY: Record<SendDocType, string> = { reservation: "reservations", invoice: "invoices", receipt: "payments" };
const isDoc = (v: unknown): v is SendDocType => v === "reservation" || v === "invoice" || v === "receipt";

/**
 * GET /api/whatsapp/send?type=&id=
 * For the Share dialog: whether the org's WhatsApp Business number is connected,
 * the approved templates usable for this document (rendered with the real values),
 * the guest's number and the last messages sent for this document.
 */
export async function GET(req: NextRequest) {
  let u;
  try { u = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const type = req.nextUrl.searchParams.get("type");
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!isDoc(type) || !id) return NextResponse.json({ connected: false });
  const denied = await forbiddenIfNo(DOC_ENTITY[type], "VIEW");
  if (denied) return denied;
  if (!process.env.WHATSAPP_TOKEN_KEY) return NextResponse.json({ connected: false });

  const account = await prisma.whatsAppAccount.findUnique({ where: { organizationId: u.organizationId }, select: { status: true, displayPhone: true } });
  if (!account) return NextResponse.json({ connected: false });

  const origin = new URL(req.url).origin;
  const rows = await wa.templatesForDoc(u.organizationId, type);
  const ctxCache: Partial<Record<TemplateLanguage, Awaited<ReturnType<typeof wa.documentContext>>>> = {};
  const ctx = async (lang: TemplateLanguage) =>
    (ctxCache[lang] ??= await wa.documentContext(u.organizationId, u.userId, type, id, lang, origin, false));

  const base = await ctx("ar");
  if (!base) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const templates = [];
  for (const t of rows) {
    const lang: TemplateLanguage = t.language.startsWith("ar") ? "ar" : "en";
    const c = await ctx(lang);
    const values = { ...(c?.values ?? {}), document_link: `${origin}/…` };
    const map = (t.variableMap as VariableMap | null) ?? { header: [], body: [] };
    const comps = (t.components as { type?: string; text?: string }[]) ?? [];
    const pick = (k: string) => comps.find((x) => x.type === k)?.text ?? "";
    templates.push({
      id: t.id, name: t.name, language: t.language, purpose: t.purpose,
      header: renderText(namedFromPositional(pick("HEADER"), map.header), values),
      body: renderText(namedFromPositional(pick("BODY"), map.body), values),
      footer: pick("FOOTER"),
    });
  }

  const history = await wa.messagesForDoc(u.organizationId, type, id);
  return NextResponse.json({
    connected: true,
    accountOk: account.status === "CONNECTED",
    fromPhone: account.displayPhone,
    phone: base.phone,
    guestName: base.guestName,
    templates,
    history,
  });
}

/** POST /api/whatsapp/send  { type, id, templateId, to } */
export async function POST(req: NextRequest) {
  let u;
  try { u = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  let body: { type?: unknown; id?: unknown; templateId?: unknown; to?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const { type, id, templateId, to } = body;
  if (!isDoc(type) || typeof id !== "string" || typeof templateId !== "string" || typeof to !== "string") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const denied = await forbiddenIfNo(DOC_ENTITY[type], "VIEW");
  if (denied) return denied;
  if (!process.env.WHATSAPP_TOKEN_KEY) return NextResponse.json({ error: "notConnected" }, { status: 400 });

  const r = await wa.sendForDocument(u.organizationId, u.userId, { doc: type, id, templateId, to }, new URL(req.url).origin);
  if (!r.ok) return NextResponse.json({ error: r.error, detail: r.detail }, { status: 400 });
  return NextResponse.json({ ok: true, messageId: r.data.messageId });
}
