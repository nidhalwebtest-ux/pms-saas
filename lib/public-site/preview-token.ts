import "server-only";
import crypto from "crypto";

/**
 * Short-lived signed link that lets a logged-in operator preview their website
 * (draft included) before publishing: /site-preview/{slug}/{token}/{lang}/…
 * The token binds the slug and an expiry; nothing is stored. Same server secret
 * as the document share links (lib/share-token.ts).
 */
const SECRET = process.env.SHARE_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TTL_MS = 30 * 60 * 1000;

const hmac = (body: string) => crypto.createHmac("sha256", SECRET).update(body).digest("base64url");

export function signPreviewToken(slug: string): string {
  const body = Buffer.from(JSON.stringify({ s: slug, exp: Date.now() + TTL_MS })).toString("base64url");
  return `${body}.${hmac(body)}`;
}

export function verifyPreviewToken(token: string | null | undefined, slug: string): boolean {
  if (!token || !SECRET) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const body = token.slice(0, dot);
  const a = Buffer.from(token.slice(dot + 1));
  const b = Buffer.from(hmac(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { s: string; exp: number };
    return p.s === slug && typeof p.exp === "number" && p.exp > Date.now();
  } catch {
    return false;
  }
}
