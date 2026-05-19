"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ar as arLocale, enUS as enLocale } from "date-fns/locale";
import { useTranslations, useLocale } from "next-intl";
import {
  ArrowRightIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  HomeModernIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ClockIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { useFormatCurrency } from "@/lib/org-context";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ReservationRow {
  id: string;
  reservationNumber: string | null;
  status: string;
  startDate: string;
  endDate: string;
  totalNights: number;
  grandTotal: number;
  amountPaid: number;
  balance: number;
  tenant: { id: string; name: string; phone: string | null; classification: string };
  unitNames: string[];
  propertyName: string;
}

interface ActivityItem {
  id: string;
  action: string;
  description: string;
  createdAt: string;
  reservationId: string;
  reservationNumber: string | null;
  guestName: string | null;
  unitName: string | null;
  performedBy: string | null;
}

interface TodayData {
  arrivals: ReservationRow[];
  overdueArrivals: ReservationRow[];
  departures: ReservationRow[];
  overstays: ReservationRow[];
  inHouseCount: number;
  paymentsToday: Record<string, number> & { total: number };
  expensesToday: { total: number; count: number };
  recentActivities: ActivityItem[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  CREATED:          "bg-blue-100 text-blue-700",
  CHECKED_IN:       "bg-green-100 text-green-700",
  CHECKED_OUT:      "bg-orange-100 text-orange-700",
  CANCELLED:        "bg-red-100 text-red-600",
  PAYMENT_RECORDED: "bg-emerald-100 text-emerald-700",
  NO_SHOW:          "bg-gray-100 text-gray-500",
};

const METHOD_KEYS = ["CASH", "CARD", "BANK_TRANSFER", "CHEQUE", "OTHER"] as const;

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color, icon: Icon, pulse,
}: {
  label: string;
  value: number;
  sub?: string;
  color: string;
  icon: React.ElementType;
  pulse?: boolean;
}) {
  return (
    <div className={`relative rounded-xl p-5 text-white ${color} overflow-hidden`}>
      {pulse && value > 0 && (
        <span className="absolute top-3 right-3 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
        </span>
      )}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium opacity-90">{label}</p>
          <p className="mt-1 text-4xl font-bold">{value}</p>
          {sub && <p className="mt-1 text-sm opacity-75">{sub}</p>}
        </div>
        <div className="rounded-xl bg-white/20 p-2.5">
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

function GuestRow({ res, type }: { res: ReservationRow; type: "arrival" | "departure" | "overstay" }) {
  const t = useTranslations("dashboard.today.guest");
  const omr = useFormatCurrency();
  const isOverdue = type === "arrival" && new Date(res.startDate) < new Date(new Date().setHours(0,0,0,0));
  const daysOverdue = isOverdue
    ? Math.floor((Date.now() - new Date(res.startDate).getTime()) / 86400000)
    : 0;
  const daysPastEnd = type === "overstay"
    ? Math.floor((Date.now() - new Date(res.endDate).getTime()) / 86400000)
    : 0;

  return (
    <li className={`px-4 py-3 transition-colors ${
      type === "overstay"
        ? "bg-red-50 hover:bg-red-100"
        : "hover:bg-gray-50"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 truncate">
              {res.tenant.name}
            </span>
            {res.tenant.classification === "vip" && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {t("vipBadge")}
              </span>
            )}
            {isOverdue && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                {t("overdueBadge", { days: daysOverdue })}
              </span>
            )}
            {type === "overstay" && (
              <span className="rounded-full bg-red-200 px-2 py-0.5 text-xs font-bold text-red-800">
                {t("overstayBadge", { days: daysPastEnd })}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {res.tenant.phone && <span className="me-2 ltr-numbers">{res.tenant.phone}</span>}
            {res.unitNames.join(", ")}
            {" · "}
            {res.propertyName}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {res.reservationNumber ?? "—"}
            {" · "}
            {t("nights", { count: res.totalNights })}
          </p>
        </div>
        <div className="flex-shrink-0 text-end space-y-1">
          {(type === "departure" || type === "overstay") && (
            <div className={`text-sm font-semibold ${res.balance > 0.001 ? "text-red-600" : "text-green-600"}`}>
              {res.balance > 0.001 ? t("balanceWarn", { amount: omr(res.balance) }) : t("balancePaid")}
            </div>
          )}
          <div className="flex gap-1.5 justify-end">
            {(type === "departure" || type === "overstay") && res.balance > 0.001 && (
              <Link
                href={`/dashboard/payments/new?reservationId=${res.id}`}
                className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
              >
                {t("collect")}
              </Link>
            )}
            <Link
              href={`/dashboard/reservations/${res.id}`}
              className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
            >
              {t("view")}
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}

function SectionCard({
  title, count, color, children, emptyText,
}: {
  title: string;
  count: number;
  color: string;
  children: React.ReactNode;
  emptyText: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-surface border border-border-subtle">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${
          count > 0 ? "bg-gray-100 text-gray-600" : "bg-gray-50 text-gray-400"
        }`}>
          {count}
        </span>
      </div>
      {count === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <CheckCircleIcon className="mb-2 h-8 w-8 text-gray-200" />
          <p className="text-sm text-gray-400">{emptyText}</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">{children}</ul>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function TodayView({ propertyId }: { propertyId: string }) {
  const t       = useTranslations("dashboard.today");
  const tStats  = useTranslations("dashboard.today.stats");
  const tSec    = useTranslations("dashboard.today.sections");
  const tFin    = useTranslations("dashboard.today.financial");
  const tMeth   = useTranslations("dashboard.today.methods");
  const tAct    = useTranslations("dashboard.today.activity");
  const tActLab = useTranslations("dashboard.today.activity.labels");
  const locale  = useLocale();
  const dateFnsLocale = locale === "ar" ? arLocale : enLocale;
  const omr     = useFormatCurrency();

  const [data, setData]       = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const params = propertyId ? `?propertyId=${propertyId}` : "";
      const res = await fetch(`/api/dashboard/today${params}`);
      if (!res.ok) throw new Error("Failed to load");
      setData(await res.json());
      setError(null);
    } catch {
      setError(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [propertyId, t]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(id);
  }, [fetchData]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-gray-400">{t("loadingData")}</div>
      </div>
    );
  if (error || !data)
    return (
      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
        {error ?? t("noData")}
      </div>
    );

  const allArrivals = [...data.overdueArrivals, ...data.arrivals];

  return (
    <div className="space-y-5">
      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={tStats("arrivingToday")}
          value={data.arrivals.length + data.overdueArrivals.length}
          sub={data.overdueArrivals.length > 0
            ? tStats("overdueCount", { count: data.overdueArrivals.length })
            : tStats("scheduledArrivals")}
          color="bg-blue-600"
          icon={ArrowDownIcon}
        />
        <StatCard
          label={tStats("checkingOut")}
          value={data.departures.length}
          sub={tStats("dueToday")}
          color="bg-orange-500"
          icon={ArrowUpIcon}
        />
        <StatCard
          label={tStats("overstays")}
          value={data.overstays.length}
          sub={data.overstays.length > 0 ? tStats("urgent") : tStats("allClear")}
          color={data.overstays.length > 0 ? "bg-red-600" : "bg-red-400"}
          icon={ExclamationTriangleIcon}
          pulse
        />
        <StatCard
          label={tStats("inHouse")}
          value={data.inHouseCount}
          sub={tStats("currentlyStaying")}
          color="bg-green-600"
          icon={HomeModernIcon}
        />
      </div>

      {/* ── Arrivals & Departures columns ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Arrivals */}
        <SectionCard
          title={tSec("arrivingToday")}
          count={allArrivals.length}
          color="bg-blue-500"
          emptyText={tSec("noArrivals")}
        >
          {allArrivals.map((res) => (
            <GuestRow
              key={res.id}
              res={res}
              type={new Date(res.startDate) < new Date(new Date().setHours(0,0,0,0)) ? "arrival" : "arrival"}
            />
          ))}
        </SectionCard>

        {/* Departures + Overstays */}
        <div className="space-y-4">
          <SectionCard
            title={tSec("checkingOutToday")}
            count={data.departures.length}
            color="bg-orange-500"
            emptyText={tSec("noCheckouts")}
          >
            {data.departures.map((res) => (
              <GuestRow key={res.id} res={res} type="departure" />
            ))}
          </SectionCard>

          {data.overstays.length > 0 && (
            <SectionCard
              title={tSec("overstays")}
              count={data.overstays.length}
              color="bg-red-500"
              emptyText=""
            >
              {data.overstays.map((res) => (
                <GuestRow key={res.id} res={res} type="overstay" />
              ))}
            </SectionCard>
          )}
        </div>
      </div>

      {/* ── Financial summary + Activity feed ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Financial summary */}
        <div className="rounded-xl bg-surface border border-border-subtle p-5">
          <div className="flex items-center gap-2 mb-4">
            <BanknotesIcon className="h-5 w-5 text-green-600" />
            <h3 className="text-sm font-semibold text-gray-900">
              {tFin("title")}
            </h3>
            <span className="text-xs text-gray-400">
              {format(new Date(), "d MMM yyyy", { locale: dateFnsLocale })}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Payments */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {tFin("paymentsReceived")}
              </p>
              <dl className="space-y-1.5">
                {METHOD_KEYS.map(
                  (method) =>
                    (data.paymentsToday[method] ?? 0) > 0 && (
                      <div key={method} className="flex justify-between text-sm">
                        <dt className="text-gray-500">{tMeth(method)}</dt>
                        <dd className="font-medium text-gray-900 ltr-numbers">
                          {omr(data.paymentsToday[method] ?? 0)}
                        </dd>
                      </div>
                    ),
                )}
                <div className="flex justify-between text-sm border-t border-gray-100 pt-1.5 mt-1.5">
                  <dt className="font-semibold text-gray-700">{tFin("total")}</dt>
                  <dd className="font-bold text-green-700 ltr-numbers">
                    {omr(data.paymentsToday.total ?? 0)}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Expenses */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {tFin("expenses")}
              </p>
              {data.expensesToday.count === 0 ? (
                <p className="text-sm text-gray-400">{tFin("noExpenses")}</p>
              ) : (
                <dl className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">{tFin("count")}</dt>
                    <dd className="font-medium">{data.expensesToday.count}</dd>
                  </div>
                  <div className="flex justify-between text-sm border-t border-gray-100 pt-1.5 mt-1.5">
                    <dt className="font-semibold text-gray-700">{tFin("total")}</dt>
                    <dd className="font-bold text-red-600 ltr-numbers">
                      {omr(data.expensesToday.total)}
                    </dd>
                  </div>
                </dl>
              )}

              {/* Quick links */}
              <div className="mt-4 space-y-1.5">
                <Link
                  href="/dashboard/payments/new"
                  className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 transition-colors"
                >
                  <BanknotesIcon className="h-3.5 w-3.5" />
                  {tFin("recordPayment")}
                </Link>
                <Link
                  href="/dashboard/expenses/new"
                  className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <ArrowUpIcon className="h-3.5 w-3.5" />
                  {tFin("logExpense")}
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Recent activity feed */}
        <div className="overflow-hidden rounded-xl bg-surface border border-border-subtle">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">
                {tAct("title")}
              </h3>
            </div>
            <Link
              href="/dashboard/reservations"
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              {tAct("allReservations")}
              <ArrowRightIcon className="h-3 w-3 rtl:rotate-180" />
            </Link>
          </div>

          {data.recentActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <UserGroupIcon className="mb-2 h-8 w-8 text-gray-200" />
              <p className="text-sm text-gray-400">{tAct("noActivity")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {data.recentActivities.map((act) => {
                const actionLabel = tActLab.has(act.action) ? tActLab(act.action) : act.action;
                return (
                  <li key={act.id} className="px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          ACTION_COLORS[act.action] ?? "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {actionLabel}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-600 truncate">
                      {act.description}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-400">
                      {act.performedBy && (
                        <span className="font-medium text-gray-500">
                          {act.performedBy}
                        </span>
                      )}
                      <span>
                        {formatDistanceToNow(parseISO(act.createdAt), {
                          addSuffix: true,
                          locale: dateFnsLocale,
                        })}
                      </span>
                      {act.reservationId && (
                        <Link
                          href={`/dashboard/reservations/${act.reservationId}`}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          {act.reservationNumber ?? tAct("viewLink")}
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
