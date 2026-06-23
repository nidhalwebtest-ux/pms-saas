"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";

/**
 * Floating quick-access to the founder admin panel. Rendered in the dashboard
 * layout ONLY when the signed-in user is a super-admin (gate done server-side).
 * Mirrors AvailabilityCalendarButton, placed on the opposite (right) corner so
 * the two FABs never overlap.
 */
export default function AdminPanelButton() {
  const t = useTranslations("admin");
  return (
    <Link
      href="/admin"
      title={t("quickAccess")}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-brand-700 transition-colors hover:bg-brand-700"
    >
      <ShieldCheckIcon className="h-5 w-5" />
      <span className="hidden sm:inline">{t("quickAccess")}</span>
    </Link>
  );
}
