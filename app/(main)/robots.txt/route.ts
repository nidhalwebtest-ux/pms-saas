import { SITE_URL } from "@/lib/blog/config";

/** robots.txt for binaya.app (tenant sites get theirs via the middleware rewrite). */
export function GET() {
  const body = `User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /admin
Disallow: /onboarding
Disallow: /invite
Disallow: /api/
Disallow: /blog/preview/
Disallow: /site-preview/

Sitemap: ${SITE_URL}/sitemap.xml
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, s-maxage=86400" } });
}
