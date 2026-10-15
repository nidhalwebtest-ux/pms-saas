/**
 * WhatsApp Cloud API webhook processing (SERVER ONLY).
 * One Meta app → one webhook URL for every customer; each change is routed to
 * the organization that owns the phone_number_id / WABA it refers to, and only
 * that organization's rows are updated.
 */
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/** Verify Meta's X-Hub-Signature-256 header over the RAW request body. */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=") || !appSecret) return false;
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(header.slice(7), "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const RANK: Record<string, number> = { SENT: 1, DELIVERED: 2, READ: 3 };

/** Apply a delivery status without ever moving backwards (READ never becomes DELIVERED). */
export function nextStatus(current: string, incoming: string): string {
  const inc = incoming.toUpperCase();
  if (inc === "FAILED") return "FAILED";
  if (current === "FAILED") return current;
  return (RANK[inc] ?? 0) > (RANK[current] ?? 0) ? inc : current;
}

type Json = Record<string, any>;

export async function processWebhook(payload: Json): Promise<{ statuses: number; inbound: number; templates: number }> {
  const out = { statuses: 0, inbound: 0, templates: 0 };
  if (payload?.object !== "whatsapp_business_account") return out;

  for (const entry of payload.entry ?? []) {
    const wabaId: string = String(entry.id ?? "");
    for (const change of entry.changes ?? []) {
      const value: Json = change.value ?? {};

      if (change.field === "messages") {
        const phoneNumberId = value.metadata?.phone_number_id;
        const acct = phoneNumberId
          ? await prisma.whatsAppAccount.findUnique({ where: { phoneNumberId: String(phoneNumberId) }, select: { organizationId: true } })
          : null;
        if (!acct) continue;
        const organizationId = acct.organizationId;

        for (const s of value.statuses ?? []) {
          const msg = await prisma.whatsAppMessage.findFirst({ where: { organizationId, waMessageId: String(s.id) } });
          if (!msg) continue;
          const status = nextStatus(msg.status, String(s.status ?? ""));
          const err = s.errors?.[0];
          await prisma.whatsAppMessage.update({
            where: { id: msg.id },
            data: {
              status,
              statusAt: s.timestamp ? new Date(Number(s.timestamp) * 1000) : new Date(),
              ...(status === "FAILED" && err
                ? { errorCode: String(err.code ?? ""), errorMessage: String(err.error_data?.details ?? err.message ?? err.title ?? "") }
                : {}),
            },
          });
          out.statuses++;
        }

        for (const m of value.messages ?? []) {
          const text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? `[${m.type}]`;
          await prisma.whatsAppMessage.upsert({
            where: { waMessageId: String(m.id) },
            create: {
              organizationId, direction: "IN", waMessageId: String(m.id), fromPhone: String(m.from ?? ""),
              status: "RECEIVED", body: String(text).slice(0, 4000),
              statusAt: m.timestamp ? new Date(Number(m.timestamp) * 1000) : new Date(),
            },
            update: {},
          });
          out.inbound++;
        }
      } else if (change.field === "message_template_status_update") {
        const accts = await prisma.whatsAppAccount.findMany({ where: { wabaId }, select: { organizationId: true } });
        const orgIds = accts.map((x) => x.organizationId);
        if (!orgIds.length) continue;
        const event = String(value.event ?? "").toUpperCase(); // APPROVED | REJECTED | PENDING | PAUSED | DISABLED | ...
        const reason = value.reason && value.reason !== "NONE" ? String(value.reason) : null;
        const r = await prisma.whatsAppTemplate.updateMany({
          where: {
            organizationId: { in: orgIds },
            OR: [
              { metaTemplateId: String(value.message_template_id ?? "") },
              { name: String(value.message_template_name ?? ""), language: String(value.message_template_language ?? "") },
            ],
          },
          data: { status: event || "PENDING", rejectedReason: event === "REJECTED" ? reason : null },
        });
        out.templates += r.count;
      } else if (change.field === "phone_number_quality_update") {
        // Quality changes are refreshed from the API on the next Settings visit; store the event for visibility.
        const accts = await prisma.whatsAppAccount.findMany({ where: { wabaId }, select: { id: true } });
        for (const a of accts) {
          await prisma.whatsAppAccount.update({ where: { id: a.id }, data: { lastError: value.event ? `quality: ${value.event}` : null } });
        }
      }
    }
  }
  return out;
}
