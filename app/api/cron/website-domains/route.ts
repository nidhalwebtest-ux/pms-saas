import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureTenantDomain } from "@/lib/public-site/provision";

/**
 * Daily safety net (vercel.json → crons): make sure every PUBLISHED booking
 * site's {slug}.binaya.app is attached to the Vercel project — the automatic
 * equivalent of running `vercel domains add {slug}.binaya.app` by hand.
 * Publishing already attaches it; this repairs any attach that failed.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Without
 * CRON_SECRET configured the route refuses to run.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  const sites = await prisma.orgWebsite.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true },
    orderBy: { publishedAt: "desc" },
  });

  const results: { slug: string; state: string; error?: string }[] = [];
  for (const { slug } of sites) {
    const s = await ensureTenantDomain(slug);
    results.push({ slug, state: s.state, ...(s.error ? { error: s.error } : {}) });
  }

  const failed = results.filter((r) => r.state === "missing" || r.state === "unknown");
  if (failed.length) console.error("[cron website-domains] not connected", failed);

  return NextResponse.json({
    success: true,
    data: { checked: results.length, failed: failed.length, results },
  });
}
