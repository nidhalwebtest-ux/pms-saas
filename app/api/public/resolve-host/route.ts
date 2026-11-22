import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeDomain } from "@/lib/public-site/custom-domain-shared";

/**
 * GET /api/public/resolve-host?host=www.noory.com → { slug } | { slug: null }
 *
 * Used by the middleware to route a customer's custom domain to their booking site. Public and
 * read-only: it reveals only "this hostname belongs to a published site with this slug" — the
 * slug is already public ({slug}.binaya.app). Cached at the CDN for a minute.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const d = normalizeDomain(req.nextUrl.searchParams.get("host") ?? "");
  const headers = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };
  if (!d.ok) return NextResponse.json({ slug: null }, { headers });

  const row = await prisma.orgWebsite.findUnique({
    where: { customDomain: d.host },
    select: { slug: true, status: true },
  });
  return NextResponse.json({ slug: row && row.status === "PUBLISHED" ? row.slug : null }, { headers });
}
