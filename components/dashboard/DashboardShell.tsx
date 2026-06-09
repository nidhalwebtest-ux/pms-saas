"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useTranslations, useLocale } from "next-intl";
import { ar as arLocale, enUS as enLocale } from "date-fns/locale";
import type { Role } from "@/lib/permissions";
import { SegmentedControl } from "@/components/ui";
import { TodayView } from "./views/TodayView";
import { ReceptionistView } from "./views/ReceptionistView";
import { ManagerView } from "./views/ManagerView";

type Tab = "today" | "receptionist" | "manager";

interface Props {
  user: { firstName: string; role: Role };
  propertyId: string;
  properties: { id: string; name: string }[];
}

function visibleTabs(role: Role): Tab[] {
  if (role === "STAFF")      return ["today", "receptionist"];
  if (role === "ACCOUNTANT") return ["today", "manager"];
  return ["today", "receptionist", "manager"];
}

function defaultTab(role: Role): Tab {
  if (role === "STAFF") return "today";
  if (role === "ACCOUNTANT") return "manager";
  return "today";
}

const TAB_KEYS: Record<Tab, string> = {
  today:        "todaysDashboard",
  receptionist: "receptionistView",
  manager:      "managerView",
};

export function DashboardShell({ user, propertyId, properties }: Props) {
  const t      = useTranslations("dashboard");
  const locale = useLocale();
  const dateFnsLocale = locale === "ar" ? arLocale : enLocale;

  const tabs = visibleTabs(user.role);

  const [activeTab, setActiveTab] = useState<Tab>(() => defaultTab(user.role));
  const [currentTime, setCurrentTime] = useState(new Date());

  function greeting(hour: number, name: string) {
    if (hour < 12)  return t("goodMorning",   { name });
    if (hour < 17)  return t("goodAfternoon", { name });
    return t("goodEvening", { name });
  }

  // Restore tab from localStorage (after hydration)
  useEffect(() => {
    const saved = localStorage.getItem("pms_dashboard_tab") as Tab | null;
    if (saved && tabs.includes(saved)) setActiveTab(saved);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live clock — ticks every minute
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    localStorage.setItem("pms_dashboard_tab", tab);
  }

  const propertyLabel =
    properties.find((p) => p.id === propertyId)?.name ?? t("allProperties");

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
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

        {/* View switcher — spec calls this the canonical brand/lg SegmentedControl */}
        <SegmentedControl<Tab>
          value={activeTab}
          onValueChange={switchTab}
          size="lg"
          variant="brand"
          ariaLabel={t("viewSwitcher")}
          className="self-start"
          options={tabs.map((tab) => ({ value: tab, label: t(TAB_KEYS[tab]) }))}
        />
      </div>

      {/* ── Active view ── */}
      {activeTab === "today" && (
        <TodayView propertyId={propertyId} />
      )}
      {activeTab === "receptionist" && (
        <ReceptionistView propertyId={propertyId} properties={properties} />
      )}
      {activeTab === "manager" && (
        <ManagerView propertyId={propertyId} />
      )}
    </div>
  );
}
