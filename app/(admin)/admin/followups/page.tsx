import { BellAlertIcon } from "@heroicons/react/24/outline";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import FollowupQueue from "./FollowupQueue";

export type QueueItem = {
  id: string;
  prospectId: string;
  businessName: string;
  phone: string | null;
  dueDate: string;
  channel: string;
  purpose: string | null;
};

export default async function FollowupsPage() {
  const t = await getTranslations("admin");
  // End of today (local) — anything due at or before this and not completed.
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const rows = await prisma.prospectFollowup.findMany({
    where: { completed: false, dueDate: { lte: endOfToday } },
    orderBy: { dueDate: "asc" },
    include: { prospect: { select: { id: true, businessName: true, phone: true } } },
  });

  const items: QueueItem[] = rows.map((f) => ({
    id: f.id,
    prospectId: f.prospect.id,
    businessName: f.prospect.businessName,
    phone: f.prospect.phone,
    dueDate: f.dueDate.toISOString(),
    channel: f.channel,
    purpose: f.purpose,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <BellAlertIcon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-bold text-fg">{t("queue.title")}</h2>
          <p className="text-sm text-fg-tertiary">{t("queue.subtitle")}</p>
        </div>
      </div>

      <FollowupQueue items={items} />
    </div>
  );
}
