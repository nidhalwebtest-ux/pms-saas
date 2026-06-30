"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import AvailabilityCalendarView from "./AvailabilityCalendarView";

interface Property { id: string; name: string }

export default function AvailabilityCalendarButton({
  properties, defaultPropertyId,
}: { properties: Property[]; defaultPropertyId?: string }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);

  if (properties.length === 0) return null;

  return (
    <>
      {/* Bottom-left floating button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t("availabilityCalendar")}
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-blue-700 hover:bg-blue-700 transition-colors rtl:left-auto rtl:right-6"
      >
        <CalendarDaysIcon className="h-5 w-5" />
        <span className="hidden sm:inline">{t("availabilityCalendar")}</span>
      </button>

      {/* Full-screen modal */}
      {open && (
        <div className="fixed inset-0 z-[60]">
          <AvailabilityCalendarView
            properties={properties}
            defaultPropertyId={defaultPropertyId}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </>
  );
}
