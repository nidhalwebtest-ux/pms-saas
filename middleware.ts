import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { extractSiteSlug } from "@/lib/public-site/subdomain";
import { stripLangPrefix } from "@/lib/public-site/lang";
import { isMainAppHost, resolveCustomHost } from "@/lib/public-site/resolve-host";

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
    path === "/favicon.ico"
    // NOTE: /sitemap.xml is intentionally NOT passthrough — it rewrites to the
    // per-tenant sitemap route (app/(public-site)/sites/[slug]/sitemap.xml).
  );
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host");
  let slug = extractSiteSlug(host);
  // A customer's own domain (www.noory.com): look up which site it belongs to. Skipped for our own
  // hosts, so the main app never pays for it; an unknown host simply falls through to the main app.
  if (!slug && host) {
    const hostname = host.split(":")[0].trim().toLowerCase();
    if (!isMainAppHost(hostname) && !request.nextUrl.pathname.startsWith("/_next")) slug = await resolveCustomHost(hostname);
  }

  // ── Tenant subdomain → rewrite into the (public-site) tree, skip app auth ──
  if (slug) {
    const { pathname, searchParams } = request.nextUrl;

    // robots.txt is per site (it points at the site's own sitemap).
    if (pathname === "/robots.txt") {
      const url = request.nextUrl.clone();
      url.pathname = `/sites/${slug}/robots.txt`;
      return NextResponse.rewrite(url);
    }
    if (isPassthrough(pathname)) return NextResponse.next();

    // Legacy ?lang=xx links → the language-prefixed URL (language lives in the path now).
    const legacyLang = searchParams.get("lang");
    if (legacyLang === "ar" || legacyLang === "en") {
      const url = request.nextUrl.clone();
      url.searchParams.delete("lang");
      url.pathname = `/${legacyLang}${pathname === "/" ? "" : stripLangPrefix(pathname)}`;
      return NextResponse.redirect(url, 308);
    }

    const url = request.nextUrl.clone();
    // Clean public URLs are preserved in the browser; only the internal path
    // changes. The language is part of the URL so every page can be served
    // from the CDN (see lib/public-site/lang.ts):
    //   "/buildings/x"    → /sites/{slug}/default/buildings/x   (site default language)
    //   "/en/buildings/x" → /sites/{slug}/en/buildings/x
    //   "/sitemap.xml"    → /sites/{slug}/sitemap.xml            (language-independent)
    if (pathname === "/sitemap.xml") {
      url.pathname = `/sites/${slug}/sitemap.xml`;
      return NextResponse.rewrite(url);
    }
    const m = pathname.match(/^\/(ar|en)(?=\/|$)(.*)$/);
    const lang = m ? m[1] : "default";
    const rest = m ? m[2] : pathname === "/" ? "" : pathname;
    url.pathname = `/sites/${slug}/${lang}${rest}`;
    return NextResponse.rewrite(url);
  }

  // ── Owner preview (before publishing): /site-preview/{slug}/{token}/{ar|en}/… on the main host.
  // Public, but only renders with a valid signed token (lib/public-site/preview-token.ts) — no app auth.
  const pv = request.nextUrl.pathname.match(/^\/site-preview\/([a-z0-9-]{3,40})\/([A-Za-z0-9._-]{10,400})\/(ar|en)(\/.*)?$/);
  if (pv) {
    const url = request.nextUrl.clone();
    url.pathname = `/sites/${pv[1]}/p~${pv[3]}~${pv[2]}${pv[4] ?? ""}`;
    return NextResponse.rewrite(url);
  }

  // ── Main app: keep the internal /sites/* tree unreachable from the apex ──
  if (request.nextUrl.pathname.startsWith("/sites/")) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Blog pages carry their language in the URL (/blog/en/…, /blog/ar/…, /blog/preview/{id}/ar) so
  // crawlers without the NEXT_LOCALE cookie still get the right <html lang/dir> and translations.
  const blogLang = request.nextUrl.pathname.match(/^\/blog\/(?:preview\/[^/]+\/)?(en|ar)(?=\/|$)/)?.[1] as "en" | "ar" | undefined;
  return await updateSession(request, { locale: blogLang });
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
