import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HomeModernIcon } from "@heroicons/react/24/outline";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import UnitSettingsForm from "./UnitSettingsForm";

export default async function UnitSettingsPage() {
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
    select: { showReservedStatus: true },
  });
  if (!org) redirect("/onboarding");

  const t = await getTranslations("settings.units");

  return (
    <div className="mx-auto max-w-3xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <HomeModernIcon className="h-6 w-6 text-blue-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>
      </div>

      <UnitSettingsForm settings={{ showReservedStatus: org.showReservedStatus }} />
    </div>
  );
}
