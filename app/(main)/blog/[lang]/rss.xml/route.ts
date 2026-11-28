import { getTranslations } from "next-intl/server";
import { SITE_URL, blogIndexPath, blogPostPath, categoryLabel, isBlogLang } from "@/lib/blog/config";
import { listAllLiveTranslations } from "@/lib/blog/queries";

// Rendered per request (cached at the CDN via Cache-Control) — never prerendered at build time.
export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** RSS 2.0 feed per language: /blog/en/rss.xml, /blog/ar/rss.xml (latest 30). */
export async function GET(_req: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isBlogLang(lang)) return new Response("Not found", { status: 404 });
  const t = await getTranslations({ locale: lang, namespace: "blog" });
  const posts = (await listAllLiveTranslations()).filter((p) => p.lang === lang).slice(0, 30);
  const home = `${SITE_URL}${blogIndexPath(lang)}`;

  const items = posts
    .map((p) => {
      const url = `${SITE_URL}${blogPostPath(lang, p.slug)}`;
      return `    <item>
      <title>${esc(p.title)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="true">${esc(url)}</guid>
      <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>
      <category>${esc(categoryLabel(p.category, lang))}</category>
      <description>${esc(p.excerpt)}</description>${p.coverImageUrl ? `\n      <enclosure url="${esc(p.coverImageUrl)}" type="image/jpeg" length="0" />` : ""}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(t("metaTitle"))}</title>
    <link>${esc(home)}</link>
    <description>${esc(t("metaDescription"))}</description>
    <language>${lang}</language>
    <atom:link href="${esc(home)}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
  });
}
