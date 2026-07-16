"use server";

import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUnitPriceForRange } from "@/lib/pricing";
import { collapseToSegments, sumSubtotals } from "@/lib/reservation-engine";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export type BookingInput = {
  slug: string;
  unitId: string;
  startDate: string;
  endDate: string;
  guests: number;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  notes?: string;
};

export type BookingResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * PUBLIC booking-request submit. Org is resolved from the slug; the quote is
 * recomputed server-side (never trusts the client) using the SAME pricing engine
 * as the PMS. Creates a PENDING WebsiteBookingRequest for the operator's inbox.
 */
export async function submitBookingRequest(input: BookingInput): Promise<BookingResult> {
  const h = await headers();
  const rl = await rateLimit("booking", clientIp(h), { tokens: 8, window: "1 m" });
  if (!rl.ok) return { ok: false, error: "rate_limited" };

  const slug = String(input.slug || "").toLowerCase();
  const site = await prisma.orgWebsite.findUnique({
    where: { slug }, select: { id: true, organizationId: true, status: true },
  });
  if (!site || site.status !== "PUBLISHED") return { ok: false, error: "site_not_found" };

  const guestName = String(input.guestName || "").trim();
  const guestPhone = String(input.guestPhone || "").trim();
  if (!guestName || !guestPhone) return { ok: false, error: "missing_fields" };

  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return { ok: false, error: "invalid_dates" };

  // Unit must belong to this org and be publicly bookable.
  const unit = await prisma.unit.findFirst({
    where: { id: input.unitId, isActive: true, property: { organizationId: site.organizationId, isArchived: false } },
    select: { id: true, propertyId: true },
  });
  if (!unit) return { ok: false, error: "unit_not_found" };

  // Authoritative seasonal quote (identical engine to the PMS).
  const priceResult = await getUnitPriceForRange(unit.id, start, end);
  const segments = collapseToSegments(priceResult.dailyBreakdown);
  const total = sumSubtotals(segments.map((s) => s.subtotal));

  const guests = Math.max(1, Math.min(Number(input.guests) || 1, 50));

  try {
    const req = await prisma.websiteBookingRequest.create({
      data: {
        organizationId: site.organizationId,
        orgWebsiteId: site.id,
        unitId: unit.id,
        buildingId: unit.propertyId,
        guestName,
        guestPhone,
        guestEmail: input.guestEmail?.trim() || null,
        checkIn: start,
        checkOut: end,
        guestsCount: guests,
        notes: input.notes?.trim() || null,
        quotedTotal: total,
        quotedSegments: segments as unknown as Prisma.InputJsonValue,
        status: "PENDING",
        source: "website",
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
      select: { id: true },
    });
    return { ok: true, id: req.id };
  } catch (e) {
    console.error("[submitBookingRequest]", e);
    return { ok: false, error: "generic" };
  }
}
