import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Prefixes that require an authenticated session
const PROTECTED = ["/dashboard", "/onboarding"];
// Paths that should redirect authenticated users away (e.g. login page)
const AUTH_ONLY = ["/login"];

const INACTIVITY_MS     = 60 * 60 * 1000; // 60 minutes
const ACTIVITY_COOKIE   = "omrent_last_activity";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: always call getUser() to refresh the JWT
  const { data: { user } } = await supabase.auth.getUser();

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
