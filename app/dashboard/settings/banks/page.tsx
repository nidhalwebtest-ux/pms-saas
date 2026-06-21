import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { assertView } from "@/lib/access";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import BankManager from "./BankManager";
import CashDrawerManager from "./CashDrawerManager";

export default async function BanksSettingsPage() {
  const access = await assertView("banks");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");

  const t = await getTranslations("settings.banks.header");

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/dashboard/settings" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeftIcon className="h-5 w-5 text-gray-500 rtl:rotate-180" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t("description")}</p>
        </div>
      </div>

      <BankManager canEdit={access.canEdit("banks")} canDelete={access.canDelete("banks")} />

      <div className="mt-10">
        <h2 className="text-lg font-bold text-gray-900">{t("cashDrawersTitle")}</h2>
        <p className="text-sm text-gray-500 mt-0.5 mb-4">{t("cashDrawersDescription")}</p>
        <CashDrawerManager canEdit={access.canEdit("banks")} />
      </div>
    </div>
  );
}
