import { getTranslations } from "next-intl/server";
import { TagIcon } from "@heroicons/react/24/outline";
import { assertView } from "@/lib/access";
import PricingTabs from "./PricingTabs";

/** Pricing Management (Roadmap item 6). View = units VIEW; editing = units EDIT. */
export default async function PricingLayout({ children }: { children: React.ReactNode }) {
  const access = await assertView("units");
  const t = await getTranslations("pricing");
  const canEdit = access.can("units", "EDIT");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2">
            <TagIcon className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-sm text-gray-500">{t("subtitle")}</p>
          </div>
        </div>
        {!canEdit && <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">{t("readOnly")}</span>}
      </div>
      <PricingTabs />
      {children}
    </div>
  );
}
