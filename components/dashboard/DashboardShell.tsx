"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useTranslations, useLocale } from "next-intl";
import { ar as arLocale, enUS as enLocale } from "date-fns/locale";
import {
  CalendarDaysIcon,
  BanknotesIcon,
  ArrowTrendingDownIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import type { Role } from "@/lib/permissions";
import { useCan } from "@/components/PermissionsProvider";
import { TodayView } from "./views/TodayView";
import { DashboardKPIs } from "./views/DashboardKPIs";

interface Props {
  user: { firstName: string; role: Role };
  propertyId: string;
  properties: { id: string; name: string }[];
}

/** Subtle section divider that groups the merged dashboard into Today /
 *  Performance zones. */
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

/** One-tap shortcuts to the 4 most common receptionist tasks — each hidden
 *  if the user lacks CREATE on that entity, matching the same permission
 *  gate the navbar's own "New X" links use (see CHILD_REQUIRES in
 *  Navigation.tsx). */
function QuickActions() {
  const t = useTranslations("nav");
  const canReservations = useCan("reservations", "CREATE");
  const canPayments     = useCan("payments", "CREATE");
  const canExpenses     = useCan("expenses", "CREATE");
  const canTenants      = useCan("tenants", "CREATE");

  const actions = [
    canReservations && {
      href: "/dashboard/reservations/new",
      label: t("newReservation"),
      icon: CalendarDaysIcon,
      color: "bg-blue-600 hover:bg-blue-500",
    },
    canPayments && {
      href: "/dashboard/payments/new",
      label: t("recordPayment"),
      icon: BanknotesIcon,
      color: "bg-green-600 hover:bg-green-500",
    },
    canExpenses && {
      href: "/dashboard/expenses/new",
      label: t("submitExpense"),
      icon: ArrowTrendingDownIcon,
      color: "bg-red-600 hover:bg-red-500",
    },
    canTenants && {
      href: "/dashboard/tenants/new",
      label: t("newTenant"),
      icon: UserPlusIcon,
      color: "bg-purple-600 hover:bg-purple-500",
    },
  ].filter(Boolean) as { href: string; label: string; icon: typeof CalendarDaysIcon; color: string }[];

  if (actions.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors sm:flex-none ${a.color}`}
        >
          <a.icon className="h-4 w-4 shrink-0" />
          {a.label}
        </Link>
      ))}
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

      {/* ── Quick actions ── */}
      <QuickActions />

      {/* ── Today: arrivals, departures, overstays, in-house + activity ── */}
      <SectionHeading>{t("sectionToday")}</SectionHeading>
      <TodayView propertyId={propertyId} />

      {/* ── KPIs: revenue/expense/occupancy tiles, trend charts, aging,
          building comparison ── */}
      <SectionHeading>{t("sectionPerformance")}</SectionHeading>
      <DashboardKPIs propertyId={propertyId} />
    </div>
  );
}
