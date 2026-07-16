import "server-only";

/**
 * Per-IP rate limiting for PUBLIC endpoints (availability search, booking
 * submit). Backed by Upstash Redis so limits hold across serverless instances.
 *
 * Degrades safely: if UPSTASH_REDIS_REST_URL / _TOKEN are not set (e.g. local
 * dev), every call is allowed. Configure them in Vercel to activate limiting.
 */

type Limiter = { limit: (key: string) => Promise<{ success: boolean; remaining: number; reset: number }> };

const limiters = new Map<string, Limiter | null>();

async function getLimiter(name: string, tokens: number, window: `${number} s` | `${number} m`): Promise<Limiter | null> {
  if (limiters.has(name)) return limiters.get(name)!;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    limiters.set(name, null);
    return null;
  }

  try {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");
    const limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(tokens, window),
      prefix: `pub:${name}`,
      analytics: false,
    });
    limiters.set(name, limiter);
    return limiter;
  } catch {
    // Package/init failure must never break the public site — fail open.
    limiters.set(name, null);
    return null;
  }
}

export type RateResult = { ok: boolean; remaining: number | null };

/**
 * Check a limit bucket. `name` groups the limit (e.g. "availability"), `key` is
 * the caller identity (usually IP). Returns { ok:false } only when a configured
 * limiter is actually exceeded.
 */
export async function rateLimit(
  name: string,
  key: string,
  opts: { tokens: number; window: `${number} s` | `${number} m` },
): Promise<RateResult> {
  const limiter = await getLimiter(name, opts.tokens, opts.window);
  if (!limiter) return { ok: true, remaining: null };
  const res = await limiter.limit(key);
  return { ok: res.success, remaining: res.remaining };
}

/** Best-effort client IP from standard proxy headers (Vercel sets these). */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") || "unknown";
}
