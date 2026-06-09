import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowUturnLeftIcon } from "@heroicons/react/24/outline";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import ReturnSettingsForm from "./ReturnSettingsForm";

export default async function ReturnSettingsPage() {
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
    select: {
      returnDraftPolicy:   true,
      returnBalancePolicy: true,
      returnRateBasis:     true,
    },
  });
  if (!org) redirect("/onboarding");

  const t = await getTranslations("settings.returns");

  return (
    <div className="mx-auto max-w-3xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-100 rounded-lg">
          <ArrowUturnLeftIcon className="h-6 w-6 text-purple-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>
      </div>

      <ReturnSettingsForm
        settings={{
          returnDraftPolicy:   org.returnDraftPolicy,
          returnBalancePolicy: org.returnBalancePolicy,
          returnRateBasis:     org.returnRateBasis,
        }}
      />
    </div>
  );
}
