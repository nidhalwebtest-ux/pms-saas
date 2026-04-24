import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ShieldExclamationIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";

export default async function AccessDenied() {
  const t = await getTranslations("auth.accessDenied");

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100">
          <ShieldExclamationIcon className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
        <p className="mt-2 text-sm text-slate-500">{t("body")}</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
        >
          <ArrowLeftIcon className="h-4 w-4 rtl:rotate-180" />
          {t("backToDashboard")}
        </Link>
      </div>
    </div>
  );
}
