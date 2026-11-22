import { getSiteBySlug, getBuildings, getUnits, getPublicSeasons } from "@/lib/public-site/data";
import { siteOrigin, langUrl, languageAlternates } from "@/lib/public-site/seo";
import type { SiteLang } from "@/lib/public-site/i18n";

/**
 * Per-site sitemap with hreflang alternates, reached as {host}/sitemap.xml via the middleware
 * rewrite. Lists both language versions of the home page, stays, buildings, units and the
 * opt-in season pages. Cached at the CDN for an hour.
 */
export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) return new Response("Not found", { status: 404 });

  const origin = siteOrigin(site);
  const [buildings, units, seasons] = await Promise.all([
    getBuildings(site.organizationId),
    getUnits(site.organizationId),
    getPublicSeasons(site.organizationId),
  ]);

  const paths = [
    "/",
    "/buildings",
    ...buildings.map((b) => `/buildings/${b.id}`),
    ...units.map((u) => `/units/${u.id}`),
    ...seasons.map((s) => `/seasons/${s.id}`),
  ];

  const langs: SiteLang[] = ["ar", "en"];
  const entries = paths.flatMap((path) => {
    const alts = languageAlternates(origin, site.defaultLanguage, path);
    const links = [
      `      <xhtml:link rel="alternate" hreflang="ar" href="${esc(alts.ar)}"/>`,
      `      <xhtml:link rel="alternate" hreflang="en" href="${esc(alts.en)}"/>`,
      `      <xhtml:link rel="alternate" hreflang="x-default" href="${esc(alts["x-default"])}"/>`,
    ].join("\n");
    return langs.map((lang) => `  <url>\n    <loc>${esc(langUrl(origin, lang, site.defaultLanguage, path))}</loc>\n${links}\n  </url>`);
  });

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    entries.join("\n") +
    `\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
