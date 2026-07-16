import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { extractSiteSlug } from "@/lib/public-site/subdomain";

/**
 * Paths that must NOT be rewritten into the public-site tree even on a tenant
 * host: framework internals + API routes are host-agnostic and handle their own
 * auth/logic (public API routes re-derive the org from the Host header).
 */
function isPassthrough(path: string): boolean {
  return (
    path.startsWith("/api") ||
    path.startsWith("/_next") ||
    path.startsWith("/fonts") ||
    path.startsWith("/brand") ||
    path === "/favicon.ico" ||
    path === "/robots.txt" ||
    path === "/sitemap.xml"
  );
}

export async function middleware(request: NextRequest) {
  const slug = extractSiteSlug(request.headers.get("host"));

  // ── Tenant subdomain → rewrite into the (public-site) tree, skip app auth ──
  if (slug) {
    const { pathname } = request.nextUrl;
    if (isPassthrough(pathname)) return NextResponse.next();

    const url = request.nextUrl.clone();
    // Clean public URLs are preserved in the browser; only the internal path
    // changes. "/" → /sites/{slug}, "/buildings/x" → /sites/{slug}/buildings/x
    url.pathname = `/sites/${slug}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  // ── Main app: keep the internal /sites/* tree unreachable from the apex ──
  if (request.nextUrl.pathname.startsWith("/sites/")) {
    return new NextResponse("Not found", { status: 404 });
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
