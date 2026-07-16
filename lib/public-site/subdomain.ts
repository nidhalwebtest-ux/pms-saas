/**
 * Subdomain → site-slug resolution. Pure functions, no I/O — safe to import from
 * middleware (which must stay lightweight) and from server code alike.
 *
 * Tenant public sites live at `{slug}.binaya.app` (prod) and `{slug}.localhost`
 * (dev). Everything else — the apex, `www`, Vercel previews, the legacy
 * omrent.net domain, and any reserved label — is treated as the MAIN app.
 */

/** Labels that can never be a tenant slug (would shadow app/system hosts). */
export const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "mail", "blog", "help", "dev",
  "static", "assets", "cdn", "status", "docs", "support", "binaya", "auth",
  "login", "dashboard", "onboarding", "account", "billing", "internal", "office",
]);

/** Slug rules: 3–40 chars, lowercase a–z/0–9/hyphen, no leading/trailing hyphen. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/** Full validity check used by the wizard's availability check + slug input. */
export function isValidSlug(slug: string): boolean {
  const s = slug.toLowerCase();
  return SLUG_RE.test(s) && !isReservedSlug(s);
}

/**
 * Extract the tenant site slug from a Host header, or null if the host is the
 * main app. Handles ports, `*.localhost` (dev) and `*.binaya.app` (prod).
 */
export function extractSiteSlug(host: string | null | undefined): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0].trim().toLowerCase(); // drop :port
  if (!hostname) return null;

  // Vercel preview deployments (…-xxx.vercel.app) are always the main app.
  if (hostname.endsWith(".vercel.app")) return null;

  // Dev tenant hosts: acme.localhost
  if (hostname.endsWith(".localhost")) {
    return labelOf(hostname, ".localhost");
  }
  if (hostname === "localhost") return null;

  // Prod tenant hosts: acme.binaya.app
  if (hostname.endsWith(".binaya.app")) {
    return labelOf(hostname, ".binaya.app");
  }

  // Apex binaya.app, omrent.net, custom domains → main app.
  return null;
}

/**
 * Slice the single subdomain label off `hostname` and validate it as a tenant
 * label. Returns null for the apex, multi-level subdomains, or reserved labels.
 * We do NOT enforce full slug length here — an unknown/short label simply won't
 * resolve to a site and yields a branded 404 downstream.
 */
function labelOf(hostname: string, root: string): string | null {
  const label = hostname.slice(0, -root.length);
  if (!label || label.includes(".")) return null; // apex or multi-level
  if (isReservedSlug(label)) return null;
  return label;
}
