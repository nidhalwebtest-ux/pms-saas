import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import ReservationSettingsForm from "./ReservationSettingsForm";

export default async function ReservationSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { organizationId: true },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");

  const org = await prisma.organization.findUnique({
    where:  { id: dbUser.organizationId },
    select: { checkInPolicy: true },
  });
  if (!org) redirect("/onboarding");

  const t = await getTranslations("settings.reservations");

  return (
    <div className="mx-auto max-w-3xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <CalendarDaysIcon className="h-6 w-6 text-blue-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>
      </div>

      <ReservationSettingsForm
        settings={{
          checkInPolicy: org.checkInPolicy,
        }}
      />
    </div>
  );
}
