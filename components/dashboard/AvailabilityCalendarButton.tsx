"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";

interface Property { id: string; name: string }

export default function AvailabilityCalendarButton({
  properties,
}: { properties: Property[]; defaultPropertyId?: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  // No buildings yet, or already on the calendar → hide the quick-access FAB.
  if (properties.length === 0 || pathname?.startsWith("/dashboard/calendar")) return null;

  return (
    <Link
      href="/dashboard/calendar"
      title={t("availabilityCalendar")}
      className="fixed bottom-6 left-6 z-40 flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-blue-700 hover:bg-blue-700 transition-colors rtl:left-auto rtl:right-6"
    >
      <CalendarDaysIcon className="h-5 w-5" />
      <span className="hidden sm:inline">{t("availabilityCalendar")}</span>
    </Link>
  );
}
