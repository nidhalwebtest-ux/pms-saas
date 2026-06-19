"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useTranslations, useLocale } from "next-intl";
import { ar as arLocale, enUS as enLocale } from "date-fns/locale";
import type { Role } from "@/lib/permissions";
import { TodayView } from "./views/TodayView";
import { ReceptionistView } from "./views/ReceptionistView";
import { ManagerView } from "./views/ManagerView";

interface Props {
  user: { firstName: string; role: Role };
  propertyId: string;
  properties: { id: string; name: string }[];
}

/** Subtle section divider that groups the merged dashboard into Today /
 *  Occupancy & Guests / Performance zones. */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-tertiary whitespace-nowrap">
        {children}
      </h2>
      <div className="h-px flex-1 bg-border-subtle" />
    </div>
  );
}

export function DashboardShell({ user, propertyId, properties }: Props) {
  const t      = useTranslations("dashboard");
  const locale = useLocale();
  const dateFnsLocale = locale === "ar" ? arLocale : enLocale;

  const [currentTime, setCurrentTime] = useState(new Date());

  function greeting(hour: number, name: string) {
    if (hour < 12)  return t("goodMorning",   { name });
    if (hour < 17)  return t("goodAfternoon", { name });
    return t("goodEvening", { name });
  }

  // Live clock — ticks every minute
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const propertyLabel =
    properties.find((p) => p.id === propertyId)?.name ?? t("allProperties");

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting(currentTime.getHours(), user.firstName)}
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {format(currentTime, "EEEE, d MMMM yyyy", { locale: dateFnsLocale })} —{" "}
          <span className="ltr-numbers">{format(currentTime, "hh:mm a", { locale: dateFnsLocale })}</span>
        </p>
        <p className="mt-0.5 text-xs text-gray-400">
          {t("viewing")}{" "}
          <span className="font-medium text-gray-600">{propertyLabel}</span>
        </p>
      </div>

      {/* ── Today: arrivals, departures, overstays, in-house + activity ── */}
      <SectionHeading>{t("sectionToday")}</SectionHeading>
      <TodayView propertyId={propertyId} />

      {/* ── Occupancy & guests (full receptionist workspace) ── */}
      <SectionHeading>{t("sectionOperations")}</SectionHeading>
      <ReceptionistView propertyId={propertyId} properties={properties} />

      {/* ── Performance: building comparison, expenses, aging ── */}
      <SectionHeading>{t("sectionPerformance")}</SectionHeading>
      <ManagerView propertyId={propertyId} variant="highlights" />
    </div>
  );
}
