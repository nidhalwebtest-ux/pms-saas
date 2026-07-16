import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { InboxArrowDownIcon } from "@heroicons/react/24/outline";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import RequestCard, { type RequestVM } from "./RequestCard";

export const dynamic = "force-dynamic";

export default async function WebsiteRequestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { organizationId: true } });
  if (!dbUser?.organizationId) redirect("/onboarding");
  const orgId = dbUser.organizationId;

  const t = await getTranslations("websiteRequests");

  // Lazy 48h expiry: flip stale PENDING requests to EXPIRED on read.
  await prisma.websiteBookingRequest.updateMany({
    where: { organizationId: orgId, status: "PENDING", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { currency: true } });
  const rows = await prisma.websiteBookingRequest.findMany({
    where: { organizationId: orgId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true, status: true, guestName: true, guestPhone: true, guestEmail: true,
      guestsCount: true, checkIn: true, checkOut: true, notes: true,
      quotedTotal: true, reservationId: true, createdAt: true,
      unit: { select: { name: true } },
      building: { select: { name: true } },
    },
  });

  const requests: RequestVM[] = rows.map((r) => ({
    id: r.id,
    status: r.status,
    guestName: r.guestName,
    guestPhone: r.guestPhone,
    guestEmail: r.guestEmail,
    guests: r.guestsCount,
    checkIn: r.checkIn.toISOString().slice(0, 10),
    checkOut: r.checkOut.toISOString().slice(0, 10),
    notes: r.notes,
    quotedTotal: Number(r.quotedTotal),
    reservationId: r.reservationId,
    unitName: r.unit?.name ?? "—",
    buildingName: r.building?.name ?? "—",
    createdAt: r.createdAt.toISOString(),
  }));

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  return (
    <div className="mx-auto max-w-3xl py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-lg bg-blue-100 p-2"><InboxArrowDownIcon className="h-6 w-6 text-blue-700" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center">
          <InboxArrowDownIcon className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-2 text-gray-500">{t("empty")}</p>
        </div>
      ) : (
        <>
          {pendingCount > 0 && <p className="mb-3 text-sm font-medium text-gray-500">{t("pendingCount", { count: pendingCount })}</p>}
          <div className="space-y-4">
            {requests.map((r) => <RequestCard key={r.id} req={r} currency={org?.currency ?? "OMR"} />)}
          </div>
        </>
      )}
    </div>
  );
}
