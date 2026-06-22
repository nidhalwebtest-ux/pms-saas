"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  HomeModernIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "@heroicons/react/24/outline";
import { useFormatCurrency } from "@/lib/org-context";
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  SkeletonCard,
  SkeletonCircle,
  SkeletonLine,
  SkeletonRectangle,
  SkeletonText,
  getTenantClassBadge,
} from "@/components/ui";

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
        <span className="absolute top-3 inset-ie-3 flex h-3 w-3">
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
              <Badge {...getTenantClassBadge("vip")} size="sm">
                {t("vipBadge")}
              </Badge>
            )}
            {isOverdue && (
              <Badge tone="danger" appearance="solid" size="sm">
                {t("overdueBadge", { days: daysOverdue })}
              </Badge>
            )}
            {type === "overstay" && (
              <Badge tone="danger" appearance="solid" size="sm" pulse>
                {t("overstayBadge", { days: daysPastEnd })}
              </Badge>
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
              <Link href={`/dashboard/payments/new?reservationId=${res.id}`} className="inline-flex">
                <Button variant="primary" size="sm" tabIndex={-1}>
                  {t("collect")}
                </Button>
              </Link>
            )}
            <Link href={`/dashboard/reservations/${res.id}`} className="inline-flex">
              <Button variant="secondary" size="sm" tabIndex={-1}>
                {t("view")}
              </Button>
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
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        <Badge tone="neutral" size="sm" className="ms-1">
          {count}
        </Badge>
      </div>
      {count === 0 ? (
        <EmptyState
          inline
          variant="positive"
          size="sm"
          illustration={<CheckCircleIcon className="h-6 w-6" />}
          title={emptyText}
        />
      ) : (
        <ul className="divide-y divide-border-subtle">{children}</ul>
      )}
    </div>
  );
}

/* ============================================================================
 *  Skeleton — mirrors the real grid (4 stat tiles, 2-col guest sections,
 *  2-col financial + activity). Announce as a single live region via the
 *  outer SkeletonCard so screen readers receive one update on first load.
 * ========================================================================= */

function TodayViewSkeleton({ ariaLabel }: { ariaLabel: string }) {
  return (
    <SkeletonCard padding={0} bordered={false} announce aria-label={ariaLabel} className="bg-transparent">
      <div className="space-y-5">
        {/* Stat tiles */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} padding={20} bordered={false} announce={false} className="bg-subtle">
              <SkeletonLine width="60%" size="sm" />
              <SkeletonRectangle width="40%" height={32} className="mt-3" />
              <SkeletonLine width="55%" size="sm" className="mt-3" />
            </SkeletonCard>
          ))}
        </div>

        {/* Guest section columns */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <SkeletonCard key={i} padding={16} announce={false}>
              <div className="flex items-center gap-2">
                <SkeletonCircle size={10} />
                <SkeletonLine width={140} size="sm" />
              </div>
              <div className="mt-4 space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <SkeletonCircle size={32} />
                    <div className="flex-1">
                      <SkeletonLine width="60%" size="sm" />
                      <SkeletonLine width="40%" size="sm" className="mt-1.5" />
                    </div>
                  </div>
                ))}
              </div>
            </SkeletonCard>
          ))}
        </div>

        {/* Financial + activity columns */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <SkeletonCard padding={20} announce={false}>
            <SkeletonLine width={120} size="sm" />
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div><SkeletonText lines={4} size="sm" /></div>
              <div><SkeletonText lines={4} size="sm" /></div>
            </div>
          </SkeletonCard>
          <SkeletonCard padding={16} announce={false}>
            <SkeletonLine width={120} size="sm" />
            <div className="mt-4"><SkeletonText lines={6} size="sm" /></div>
          </SkeletonCard>
        </div>
      </div>
    </SkeletonCard>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function TodayView({ propertyId }: { propertyId: string }) {
  const t       = useTranslations("dashboard.today");
  const tStats  = useTranslations("dashboard.today.stats");
  const tSec    = useTranslations("dashboard.today.sections");

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

  if (loading) return <TodayViewSkeleton ariaLabel={t("loadingData")} />;
  if (error || !data)
    return (
      <Alert
        variant="error"
        title={error ?? t("noData")}
        actions={
          <Button variant="secondary" size="sm" onClick={fetchData}>
            {t("retry")}
          </Button>
        }
      />
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

    </div>
  );
}
