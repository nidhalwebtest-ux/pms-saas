import { getTranslations } from "next-intl/server";

export default async function DashboardLoading() {
  const t = await getTranslations("dashboard");
  return (
    <div className="flex items-center justify-center py-32">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-blue-200 border-t-blue-600" />
        <p className="text-sm text-gray-400">{t("loading")}</p>
      </div>
    </div>
  );
}
