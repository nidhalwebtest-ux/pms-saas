import { NextRequest, NextResponse } from "next/server";
import { getSiteFromHost, searchAvailability } from "@/lib/public-site/data";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * GET /api/public/availability?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD[&buildingId=&guests=]
 *
 * PUBLIC, unauthenticated. The org is derived from the Host header (the tenant
 * subdomain) — never from a query param — so a caller can only ever search the
 * site they're actually visiting. Rate limited per IP.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // 1) Rate limit (per IP). No-op if Upstash isn't configured (dev).
  const ip = clientIp(req.headers);
  const rl = await rateLimit("availability", ip, { tokens: 30, window: "10 s" });
  if (!rl.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // 2) Resolve the org from the visited subdomain.
  const site = await getSiteFromHost(req.headers.get("host"));
  if (!site) return NextResponse.json({ error: "site_not_found" }, { status: 404 });

  // 3) Validate dates (half-open [start, end)).
  const sp = req.nextUrl.searchParams;
  const startStr = sp.get("startDate");
  const endStr = sp.get("endDate");
  if (!startStr || !endStr) {
    return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
  }
  const startDate = new Date(startStr);
  const endDate = new Date(endStr);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate) {
    return NextResponse.json({ error: "invalid_dates" }, { status: 400 });
  }

  const buildingId = sp.get("buildingId") || undefined;
  const guestsRaw = parseInt(sp.get("guests") || "", 10);
  const guests = Number.isFinite(guestsRaw) && guestsRaw > 0 ? guestsRaw : undefined;

  const units = await searchAvailability(site.organizationId, { startDate, endDate, buildingId, guests });

  return NextResponse.json({
    startDate: startStr,
    endDate: endStr,
    currency: site.currency,
    showPrices: site.showPrices,
    units: units.map((u) => ({
      id: u.id,
      buildingId: u.buildingId,
      buildingName: u.buildingName,
      name: u.name,
      unitType: u.unitType,
      bedrooms: u.bedrooms,
      bathrooms: u.bathrooms,
      maxGuests: u.maxGuests,
      photos: u.photos,
      available: u.available,
      nights: u.nights,
      subtotal: site.showPrices ? u.subtotal : null,
      rateAmount: site.showPrices ? u.rateAmount : null,
      priceName: u.priceName,
      segments: site.showPrices ? u.segments : [],
    })),
  });
}
