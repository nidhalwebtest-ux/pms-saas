import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { getEffectivePropertyIds } from "@/lib/property-scope";
import {
  getDisplayStatus,
  displayStatusToTab,
  type StoredStatus,
} from "@/lib/reservation-status";
import type { Prisma } from "@prisma/client";

async function getActor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });
  return dbUser?.organizationId ? dbUser : null;
}

export async function GET(req: NextRequest) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Scope counts to the selected building + the user's accessible set so the tab
  // totals match the (already-scoped) list. null = unrestricted (all org).
  const propertyId = new URL(req.url).searchParams.get("propertyId") ?? "";
  const propIds = await getEffectivePropertyIds(propertyId);

  const where: Prisma.ReservationWhereInput = {
    tenant: { organizationId: actor.organizationId! },
    ...(propIds
      ? {
          OR: [
            { unit: { propertyId: { in: propIds } } },
            { reservationUnits: { some: { unit: { propertyId: { in: propIds } } } } },
          ],
        }
      : {}),
  };

  const raws = await prisma.reservation.findMany({
    where,
    select: { status: true, startDate: true, endDate: true },
  });

  const today = new Date();
  const counts: Record<string, number> = {
    all: raws.length,
    arriving: 0, overdueArrival: 0, inHouse: 0,
    dueCheckout: 0, overstay: 0, upcoming: 0,
    checkedOut: 0, cancelled: 0, noShow: 0,
  };

  for (const r of raws) {
    const tab = displayStatusToTab(
      getDisplayStatus(r.status as StoredStatus, r.startDate, r.endDate, today).label,
    );
    counts[tab] = (counts[tab] ?? 0) + 1;
  }

  return NextResponse.json(counts);
}
