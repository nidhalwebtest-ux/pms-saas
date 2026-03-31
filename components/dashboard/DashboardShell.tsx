"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import type { Role } from "@/lib/permissions";
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

const TAB_LABELS: Record<Tab, string> = {
  today:        "Today's Dashboard",
  receptionist: "Receptionist View",
  manager:      "Manager View",
};

function greeting(hour: number, name: string) {
  const g = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return `${g}, ${name}`;
}

export function DashboardShell({ user, propertyId, properties }: Props) {
  const tabs = visibleTabs(user.role);

  const [activeTab, setActiveTab] = useState<Tab>(() => defaultTab(user.role));
  const [currentTime, setCurrentTime] = useState(new Date());

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
    properties.find((p) => p.id === propertyId)?.name ?? "All Properties";

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting(currentTime.getHours(), user.firstName)}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {format(currentTime, "EEEE, d MMMM yyyy")} —{" "}
            {format(currentTime, "hh:mm a")}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            Viewing:{" "}
            <span className="font-medium text-gray-600">{propertyLabel}</span>
          </p>
        </div>

        {/* View switcher */}
        <nav
          className="flex gap-1 rounded-xl bg-gray-100 p-1 self-start"
          aria-label="Dashboard views"
        >
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => switchTab(tab)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </nav>
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
