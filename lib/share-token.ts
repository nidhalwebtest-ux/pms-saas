/**
 * Stateless signed tokens for public document-share links.
 *
 * A logged-in staff member mints a token (see /api/share/mint) that encodes the
 * document {type, id, org} (+ optional building scope for the ledger). The token
 * is appended to the existing authenticated PDF route as `?t=<token>`, letting
 * that route serve the PDF to a recipient who has NO session — without exposing
 * any other org's data (the HMAC signature can't be forged, and the route still
 * re-checks the document belongs to the token's org).
 *
 * HMAC-SHA256 over the payload, keyed by a server-only secret. No DB row needed.
 */
import crypto from "crypto";

const SECRET = process.env.SHARE_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export type ShareDocType = "invoice" | "receipt" | "ledger" | "reservation" | "return";

export interface SharePayload {
  t: ShareDocType;
  id: string;
  org: string;
  prop?: string; // optional building scope (ledger statements)
  exp: number;   // epoch ms
}

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}
function hmac(body: string): Buffer {
  return crypto.createHmac("sha256", SECRET).update(body).digest();
}

export function signShareToken(input: {
  t: ShareDocType;
  id: string;
  org: string;
  prop?: string;
  ttlMs?: number;
}): string {
  const payload: SharePayload = {
    t: input.t,
    id: input.id,
    org: input.org,
    ...(input.prop ? { prop: input.prop } : {}),
    exp: Date.now() + (input.ttlMs ?? DEFAULT_TTL_MS),
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(hmac(body));
  return `${body}.${sig}`;
}

export function verifyShareToken(
  token: string | null | undefined,
  expect: { t: ShareDocType; id: string },
): SharePayload | null {
  if (!token || !SECRET) return null;
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = b64url(hmac(body));
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload: SharePayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (payload.t !== expect.t || payload.id !== expect.id) return null;
  if (payload.exp && Date.now() > payload.exp) return null;
  return payload;
}

/** Read+verify a share token from a request's `?t=` query param. */
export function verifyShareFromRequest(
  req: Request,
  t: ShareDocType,
  id: string,
): SharePayload | null {
  const token = new URL(req.url).searchParams.get("t");
  return verifyShareToken(token, { t, id });
}

/** Maps a document type → its authenticated PDF route path. */
export const PDF_PATH: Record<ShareDocType, (id: string) => string> = {
  invoice:     (id) => `/api/invoices/${id}/pdf`,
  receipt:     (id) => `/api/payments/${id}/receipt-pdf`,
  ledger:      (id) => `/api/tenants/${id}/ledger/export-pdf`,
  reservation: (id) => `/api/reservations/${id}/pdf`,
  return:      (id) => `/api/returns/${id}/pdf`,
};

// Unambiguous base-56 alphabet (no 0/O/1/I/l) for short, copy-friendly codes.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Generate a short, unguessable share code. */
export function shortCode(len = 7): string {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}
