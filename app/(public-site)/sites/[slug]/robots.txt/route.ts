import { getSiteBySlug } from "@/lib/public-site/data";
import { siteOrigin } from "@/lib/public-site/seo";

/** Per-site robots.txt (reached as {host}/robots.txt via the middleware rewrite). */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) return new Response("User-agent: *\nDisallow: /\n", { status: 404, headers: { "Content-Type": "text/plain" } });

  // Search results and the booking form depend on the visitor's dates — not useful in search results.
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /search",
    "Disallow: /book",
    "Disallow: /ar/search",
    "Disallow: /ar/book",
    "Disallow: /en/search",
    "Disallow: /en/book",
    "Disallow: /api/",
    "",
    `Sitemap: ${siteOrigin(site)}/sitemap.xml`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
