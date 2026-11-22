/**
 * Custom domains for booking sites (client + server safe, no I/O): validation and the DNS
 * records the customer must create. A site is always reachable at {slug}.binaya.app; a custom
 * domain (www.noory.com) is an extra address for the same site.
 */

export type DnsRecord = { type: "A" | "CNAME" | "TXT"; name: string; value: string };

/** Vercel's anycast address / CNAME target for domains added to a project. */
export const VERCEL_A_RECORD = "76.76.21.21";
export const VERCEL_CNAME = "cname.vercel-dns.com";

/** Domains that belong to the product itself and can never be a customer's custom domain. */
const BLOCKED_SUFFIXES = ["binaya.app", "omrent.net", "vercel.app", "vercel.com", "localhost", "local", "internal", "test", "invalid"];

export type DomainCheck = { ok: true; host: string } | { ok: false; error: "empty" | "invalid" | "blocked" };

/**
 * Normalise what the customer typed ("https://WWW.Noory.com/path" → "www.noory.com") and validate it:
 * a real multi-label hostname, letters-only TLD, not an IP, not one of our own domains.
 */
export function normalizeDomain(input: string): DomainCheck {
  let s = String(input ?? "").trim().toLowerCase();
  if (!s) return { ok: false, error: "empty" };
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""); // scheme
  s = s.split(/[/?#]/)[0]; // path, query, fragment
  s = s.replace(/:\d+$/, ""); // port
  s = s.replace(/\.$/, ""); // trailing dot
  if (!s || s.length > 253) return { ok: false, error: "invalid" };

  const labels = s.split(".");
  const labelOk = (l: string) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(l);
  if (labels.length < 2 || !labels.every(labelOk)) return { ok: false, error: "invalid" };
  if (!/^[a-z]{2,24}$/.test(labels[labels.length - 1])) return { ok: false, error: "invalid" }; // also rejects IPs
  if (BLOCKED_SUFFIXES.some((b) => s === b || s.endsWith(`.${b}`))) return { ok: false, error: "blocked" };
  return { ok: true, host: s };
}

/**
 * Is this an apex ("noory.com") or a subdomain ("www.noory.com")? Approximation without the public
 * suffix list: two-level public suffixes (co.uk, com.om…) are treated as part of the apex.
 */
export function isApexDomain(host: string): boolean {
  const labels = host.split(".");
  if (labels.length <= 2) return true;
  const sld = labels[labels.length - 2];
  const twoLevel = labels.length === 3 && labels[labels.length - 1].length === 2 && ["co", "com", "org", "net", "gov", "edu", "ac"].includes(sld);
  return twoLevel;
}

/** The DNS records to create at the customer's DNS provider. */
export function dnsRecordsFor(host: string): DnsRecord[] {
  if (isApexDomain(host)) return [{ type: "A", name: "@", value: VERCEL_A_RECORD }];
  return [{ type: "CNAME", name: host.split(".")[0], value: VERCEL_CNAME }];
}

export type CustomDomainState = "none" | "pending" | "active" | "error";
