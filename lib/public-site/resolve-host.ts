/**
 * Resolve a customer's custom domain (www.noory.com) to a site slug from the middleware.
 * Edge-safe: no Prisma — it asks /api/public/resolve-host on the main app and caches the
 * answer in memory (per instance) so only the first request after a cold start pays for it.
 */

/** Hosts that are the product itself (never a customer's custom domain). */
export function isMainAppHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (!h || h === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":")) return true; // localhost / IPs
  return ["binaya.app", "omrent.net", "vercel.app", "localhost"].some((d) => h === d || h.endsWith(`.${d}`));
}

const POSITIVE_TTL = 60_000;
const NEGATIVE_TTL = 30_000;
const cache = new Map<string, { slug: string | null; exp: number }>();

/** Where the lookup endpoint lives (the main app). Overridable for local testing. */
const appOrigin = () => process.env.APP_ORIGIN || "https://www.binaya.app";

export async function resolveCustomHost(hostname: string): Promise<string | null> {
  const key = hostname.toLowerCase();
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.slug;

  let slug: string | null = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${appOrigin()}/api/public/resolve-host?host=${encodeURIComponent(key)}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const body = (await res.json()) as { slug?: string | null };
      slug = typeof body.slug === "string" ? body.slug : null;
    } else {
      return null; // lookup failed: don't cache, fall through to the main app
    }
  } catch {
    return null;
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, { slug, exp: Date.now() + (slug ? POSITIVE_TTL : NEGATIVE_TTL) });
  return slug;
}
