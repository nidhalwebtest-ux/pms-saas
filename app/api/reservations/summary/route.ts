import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  getDisplayStatus,
  displayStatusToTab,
  type StoredStatus,
} from "@/lib/reservation-status";

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

export async function GET() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raws = await prisma.reservation.findMany({
    where: { tenant: { organizationId: actor.organizationId! } },
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
