import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeftIcon, ArrowsRightLeftIcon } from "@heroicons/react/24/outline";
import { requireOrgUser } from "@/lib/tenant";
import { getSessionAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getMatchingView } from "@/lib/bank-matching";
import MatchingBoard from "./MatchingBoard";

export default async function BankMatchingPage({ params }: { params: Promise<{ id: string }> }) {
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { redirect("/login"); }

  const { id } = await params;
  const account = await prisma.bankAccount.findUnique({
    where: { id },
    select: { id: true, organizationId: true, bankName: true, label: true, currency: true },
  });
  if (!account || account.organizationId !== orgUser!.organizationId) notFound();

  const view = await getMatchingView(orgUser!.organizationId, id);
  if (!view) notFound();

  const access = await getSessionAccess();
  const canEdit = access?.canEdit("banks") ?? false;
  const t = await getTranslations("settings.banks.matching");

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link href="/dashboard/settings/banks" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeftIcon className="h-5 w-5 text-gray-500 rtl:rotate-180" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <ArrowsRightLeftIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {t("title")} · {account.bankName}{account.label ? ` — ${account.label}` : ""}
            </h1>
            <p className="text-xs text-gray-500">{t("subtitle")}</p>
          </div>
        </div>
        <Link
          href={`/dashboard/settings/banks/${id}/statement`}
          className="ms-auto text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          {t("viewStatement")}
        </Link>
      </div>

      <MatchingBoard bankId={id} currency={account.currency} view={view} canEdit={canEdit} />
    </div>
  );
}
