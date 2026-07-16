import { getSiteBySlug, getBuildings, getUnits } from "@/lib/public-site/data";

/** Per-site sitemap. Reached as {slug}.binaya.app/sitemap.xml via the rewrite. */
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) return new Response("Not found", { status: 404 });

  const host = req.headers.get("host") || `${slug}.binaya.app`;
  const proto = host.startsWith("localhost") || host.includes(".localhost") ? "http" : "https";
  const base = `${proto}://${host}`;

  const [buildings, units] = await Promise.all([
    getBuildings(site.organizationId),
    getUnits(site.organizationId),
  ]);

  const locs = [
    `${base}/`,
    `${base}/buildings`,
    ...buildings.map((b) => `${base}/buildings/${b.id}`),
    ...units.map((u) => `${base}/units/${u.id}`),
  ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    locs.map((u) => `  <url><loc>${u}</loc></url>`).join("\n") +
    `\n</urlset>\n`;

  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
