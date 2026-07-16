"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access";
import { calculateNights, calculateGrandTotal } from "@/lib/reservation-engine";
import { computeUnitPricings } from "@/lib/reservation-pricing";
import { getUnitConflict, type ConflictDetail } from "@/lib/reservation-conflict";
import { generateReservationNumber } from "@/lib/reservation-number";
import { searchAvailability } from "@/lib/public-site/data";

async function getActor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, organizationId: true } });
  return dbUser?.organizationId ? dbUser : null;
}

export type ConfirmResult =
  | { ok: true; reservationId: string; reservationNumber: string | null }
  | { ok: false; error: string; conflict?: ConflictDetail; alternatives?: { id: string; name: string }[] };

/**
 * Confirm a website booking request → create a real CONFIRMED reservation using
 * the SAME pricing (computeUnitPricings) + double-booking (getUnitConflict)
 * engine as the PMS, re-checking availability at confirm time. A guest tenant is
 * created (or matched by phone) since reservations require a tenant.
 */
export async function confirmWebsiteRequest(requestId: string): Promise<ConfirmResult> {
  if (!(await hasAccess("reservations", "CREATE"))) return { ok: false, error: "forbidden" };
  const actor = await getActor();
  if (!actor?.organizationId) return { ok: false, error: "unauthorized" };
  const orgId = actor.organizationId;

  const reqRow = await prisma.websiteBookingRequest.findFirst({
    where: { id: requestId, organizationId: orgId },
    select: {
      id: true, status: true, unitId: true, buildingId: true,
      checkIn: true, checkOut: true, guestsCount: true,
      guestName: true, guestPhone: true, guestEmail: true,
    },
  });
  if (!reqRow) return { ok: false, error: "not_found" };
  if (reqRow.status !== "PENDING") return { ok: false, error: "not_pending" };

  const unit = await prisma.unit.findFirst({
    where: { id: reqRow.unitId, isActive: true, property: { organizationId: orgId } },
    select: { id: true, name: true },
  });
  if (!unit) return { ok: false, error: "unit_unavailable" };

  const { checkIn, checkOut } = reqRow;

  // Guest → tenant (match by phone within the org, else create a minimal record).
  let tenant = await prisma.tenant.findFirst({
    where: { organizationId: orgId, phone: reqRow.guestPhone }, select: { id: true },
  });
  if (!tenant) {
    const parts = reqRow.guestName.trim().split(/\s+/);
    const firstName = parts[0] || "Guest";
    const lastName = parts.slice(1).join(" ") || "—";
    tenant = await prisma.tenant.create({
      data: {
        organizationId: orgId, firstName, lastName,
        phone: reqRow.guestPhone, whatsappNumber: reqRow.guestPhone,
        email: reqRow.guestEmail || null, source: "website", createdById: actor.id,
      },
      select: { id: true },
    });
  }

  // Pricing (identical engine + persisted segments).
  const pricings = await computeUnitPricings([unit.id], "daily", checkIn, checkOut);
  const grand = calculateGrandTotal(pricings.map((p) => p.subtotal), 0);
  const totalNights = calculateNights(checkIn, checkOut);

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      const conflict = await getUnitConflict(tx, unit.id, unit.name, checkIn, checkOut);
      if (conflict) throw new Error(`CONFLICT:${JSON.stringify(conflict)}`);

      const resNumber = await generateReservationNumber(orgId, tx);
      const res = await tx.reservation.create({
        data: {
          reservationNumber: resNumber,
          organizationId: orgId,
          startDate: checkIn, endDate: checkOut,
          status: "CONFIRMED", rateType: "daily", frequency: "DAILY", source: "website",
          totalNights,
          amount: grand.grandTotal, totalPrice: grand.grandTotal,
          totalAmount: grand.totalAmount, discountAmount: grand.discountAmount,
          taxAmount: grand.taxAmount, grandTotal: grand.grandTotal, amountPaid: 0,
          tenantId: tenant!.id, unitId: unit.id, createdById: actor.id,
        },
      });
      await tx.reservationUnit.createMany({
        data: pricings.map((up) => ({
          reservationId: res.id, unitId: up.unitId, rateType: up.rateType,
          rateAmount: up.rateAmount, rateSource: up.rateSource, seasonalPriceName: up.seasonalPriceName,
          nights: up.nights, subtotal: up.subtotal,
          pricingSegments: up.pricingSegments as unknown as Prisma.InputJsonValue,
        })),
      });
      await tx.websiteBookingRequest.update({
        where: { id: reqRow.id }, data: { status: "CONFIRMED", reservationId: res.id },
      });
      return res;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/dashboard/website-requests");
    revalidatePath("/dashboard/reservations");
    return { ok: true, reservationId: reservation.id, reservationNumber: reservation.reservationNumber };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("CONFLICT:")) {
      let conflict: ConflictDetail = null;
      try { conflict = JSON.parse(msg.replace("CONFLICT:", "")); } catch { /* noop */ }
      // Offer alternatives: other available units for the same dates/building.
      const avail = await searchAvailability(orgId, {
        buildingId: reqRow.buildingId, startDate: checkIn, endDate: checkOut, guests: reqRow.guestsCount,
      });
      const alternatives = avail.filter((u) => u.available && u.id !== unit.id).slice(0, 5).map((u) => ({ id: u.id, name: u.name }));
      return { ok: false, error: "conflict", conflict, alternatives };
    }
    console.error("[confirmWebsiteRequest]", e);
    return { ok: false, error: "generic" };
  }
}

export type RejectResult = { ok: true } | { ok: false; error: string };

export async function rejectWebsiteRequest(requestId: string): Promise<RejectResult> {
  if (!(await hasAccess("reservations", "CREATE"))) return { ok: false, error: "forbidden" };
  const actor = await getActor();
  if (!actor?.organizationId) return { ok: false, error: "unauthorized" };

  const updated = await prisma.websiteBookingRequest.updateMany({
    where: { id: requestId, organizationId: actor.organizationId, status: "PENDING" },
    data: { status: "REJECTED" },
  });
  if (updated.count === 0) return { ok: false, error: "not_found" };
  revalidatePath("/dashboard/website-requests");
  return { ok: true };
}
