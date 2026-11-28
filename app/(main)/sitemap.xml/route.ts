import { SITE_URL, blogIndexPath, blogPostPath, type BlogLang } from "@/lib/blog/config";
import { listAllLiveTranslations } from "@/lib/blog/queries";

// Rendered per request (cached at the CDN via Cache-Control) — never prerendered at build time.
export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Sitemap of binaya.app (the marketing site). Tenant booking sites have their own
 * (app/(public-site)/sites/[slug]/sitemap.xml, reached by middleware rewrite).
 * Blog articles list every language version with hreflang alternates.
 */
export async function GET() {
  const posts = await listAllLiveTranslations();
  const lastBlog = posts[0]?.updatedAt;

  type Entry = { loc: string; lastmod?: string; freq: string; priority: string; alt?: Partial<Record<BlogLang, string>> };
  const entries: Entry[] = [
    { loc: "/", freq: "weekly", priority: "1.0" },
    { loc: "/about", freq: "monthly", priority: "0.5" },
    { loc: "/contact", freq: "monthly", priority: "0.5" },
    { loc: "/privacy", freq: "yearly", priority: "0.2" },
    { loc: "/terms", freq: "yearly", priority: "0.2" },
    ...(["en", "ar"] as BlogLang[]).map((l) => ({
      loc: blogIndexPath(l),
      lastmod: lastBlog,
      freq: "daily",
      priority: "0.8",
      alt: { en: blogIndexPath("en"), ar: blogIndexPath("ar") },
    })),
    ...posts.map((p) => ({
      loc: blogPostPath(p.lang, p.slug),
      lastmod: p.updatedAt,
      freq: "monthly",
      priority: "0.7",
      alt: Object.fromEntries(Object.entries(p.alternates).map(([l, s]) => [l, blogPostPath(l as BlogLang, s!)])) as Partial<Record<BlogLang, string>>,
    })),
  ];

  const body = entries
    .map((e) => {
      const alts = e.alt && Object.keys(e.alt).length > 1
        ? Object.entries(e.alt).map(([l, href]) => `\n    <xhtml:link rel="alternate" hreflang="${l}" href="${esc(SITE_URL + href)}" />`).join("") +
          `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(SITE_URL + (e.alt.en ?? e.alt.ar))}" />`
        : "";
      return `  <url>
    <loc>${esc(SITE_URL + e.loc)}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ""}
    <changefreq>${e.freq}</changefreq>
    <priority>${e.priority}</priority>${alts}
  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${body}
</urlset>
`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
