import { NextRequest, NextResponse } from "next/server";
import { verifySignature, processWebhook } from "@/lib/whatsapp/webhook";

/**
 * Meta WhatsApp Cloud API webhook (one URL for every Binaya customer).
 * Configure in the Meta app → WhatsApp → Configuration:
 *   Callback URL:  https://<domain>/api/whatsapp/webhook
 *   Verify token:  WHATSAPP_WEBHOOK_VERIFY_TOKEN
 * Subscribe fields: messages, message_template_status_update, phone_number_quality_update.
 */

// GET — subscription handshake.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (expected && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === expected) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// POST — events. Signature is checked over the raw body before anything is parsed.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), process.env.META_APP_SECRET ?? "")) {
    return new NextResponse("Invalid signature", { status: 401 });
  }
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return new NextResponse("Bad request", { status: 400 }); }
  try {
    await processWebhook(payload as Record<string, unknown>);
  } catch (err) {
    // Log and still acknowledge — Meta retries non-2xx responses for hours.
    console.error("[whatsapp webhook] processing error:", err);
  }
  return NextResponse.json({ ok: true });
}
