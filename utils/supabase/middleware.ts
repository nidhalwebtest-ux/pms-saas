import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Prefixes that require an authenticated session. `/admin` is the founder-only
// internal CRM; middleware only enforces authentication here — the super-admin
// allowlist check lives in app/(admin)/layout.tsx (lib/super-admin.ts).
const PROTECTED = ["/dashboard", "/onboarding", "/admin"];
// Paths that should redirect authenticated users away (e.g. login page)
const AUTH_ONLY = ["/login"];

const INACTIVITY_MS     = 60 * 60 * 1000; // 60 minutes
const ACTIVITY_COOKIE   = "omrent_last_activity";

/** Request header carrying a URL-chosen UI language (blog pages: /blog/{en|ar}/…) to
 *  i18n/request.ts, where it wins over the NEXT_LOCALE cookie. */
export const LOCALE_HEADER = "x-binaya-locale";

export async function updateSession(request: NextRequest, opts: { locale?: "en" | "ar" } = {}) {
  // Forwarded request headers: never trust a client-sent locale header.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(LOCALE_HEADER);
  if (opts.locale) requestHeaders.set(LOCALE_HEADER, opts.locale);
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });

  let supabaseResponse = next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // keep the forwarded copy's Cookie header in sync with the refreshed session
          requestHeaders.set("cookie", request.cookies.toString());
          supabaseResponse = next();
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes an expired session (rewriting the auth cookies) and verifies the
  // JWT. The project signs tokens with asymmetric keys (ES256, JWKS), so
  // getClaims() verifies LOCALLY against the cached public key — no network
  // call to Supabase Auth on every request, unlike getUser().
  // This only drives the redirect below. The authoritative check (which also
  // catches a revoked/deleted user) stays in pages/routes via getAuthUser()
  // → supabase.auth.getUser() (lib/current-user.ts).
  // Safety net: no session → getClaims returns { data: null, error: null }.
  // Any verification problem (error or throw, e.g. JWKS unreachable) falls
  // back to the original network check, so a valid user is never bounced to
  // /login just because local verification failed.
  let user: { sub: string } | null = null;
  try {
    const { data: claimsData, error } = await supabase.auth.getClaims();
    if (claimsData?.claims?.sub) user = { sub: claimsData.claims.sub };
    else if (error) {
      const { data } = await supabase.auth.getUser();
      user = data.user ? { sub: data.user.id } : null;
    }
  } catch {
    const { data } = await supabase.auth.getUser();
    user = data.user ? { sub: data.user.id } : null;
  }

  const { pathname } = request.nextUrl;

  // Not authenticated → redirect to /login
  if (!user && PROTECTED.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Already authenticated → redirect away from /login
  if (user && AUTH_ONLY.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // ── Inactivity check for dashboard routes ─────────────────────────────────
  // On every authenticated dashboard request we stamp a cookie with the
  // current timestamp. On the next request we check how long ago that was.
  // If > 60 min: clear the auth cookies and redirect to login.
  // This is reliable regardless of browser timer throttling or computer sleep.
  if (user && PROTECTED.some((p) => pathname.startsWith(p))) {
    const now     = Date.now();
    const lastStr = request.cookies.get(ACTIVITY_COOKIE)?.value;

    if (lastStr) {
      const elapsed = now - Number(lastStr);
      if (!isNaN(elapsed) && elapsed > INACTIVITY_MS) {
        // Build redirect and wipe all auth cookies so the session is cleared
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.search   = "?error=session_expired";
        const res = NextResponse.redirect(url);

        request.cookies.getAll().forEach(({ name }) => {
          if (name.startsWith("sb-")) res.cookies.delete(name);
        });
        res.cookies.delete(ACTIVITY_COOKIE);

        return res;
      }
    }

    // Stamp / refresh the activity cookie on every dashboard request
    supabaseResponse.cookies.set(ACTIVITY_COOKIE, String(now), {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      path:     "/",
      maxAge:   2 * 60 * 60, // keep cookie alive for 2 h (longer than the timeout)
    });
  }

  return supabaseResponse;
}
