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
  DocumentTextIcon,
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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  FilterBarSearch,
  getTenantClassBadge,
} from "@/components/ui";
import { toast } from "sonner";

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

interface DraftInvoiceRow {
  id: string;
  invoiceNumber: string | null;
  amount: number;
  periodStart: string | null;
  periodEnd: string | null;
  propertyName: string;
  tenant: { id: string; name: string; phone: string | null; classification: string };
  reservationId: string | null;
  reservationNumber: string | null;
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
  inHouse: ReservationRow[];
  outstanding: ReservationRow[];
  invoicesToIssue: DraftInvoiceRow[];
  paymentsToday: Record<string, number> & { total: number };
  expensesToday: { total: number; count: number };
  recentActivities: ActivityItem[];
}

type FocusTab =
  | "arrivals"
  | "departures"
  | "overstays"
  | "inHouse"
  | "outstanding"
  | "toIssue";

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

function GuestRow({
  res, type,
}: {
  res: ReservationRow;
  type: "arrival" | "departure" | "overstay" | "inHouse" | "outstanding";
}) {
  const t = useTranslations("dashboard.today.guest");
  const omr = useFormatCurrency();
  const isOverdue = type === "arrival" && new Date(res.startDate) < new Date(new Date().setHours(0,0,0,0));
  const daysOverdue = isOverdue
    ? Math.floor((Date.now() - new Date(res.startDate).getTime()) / 86400000)
    : 0;
  const daysPastEnd = type === "overstay"
    ? Math.floor((Date.now() - new Date(res.endDate).getTime()) / 86400000)
    : 0;
  const showBalance = type === "departure" || type === "overstay" || type === "inHouse" || type === "outstanding";
  const showCollect = showBalance && res.balance > 0.001;

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
          {showBalance && (
            <div className={`text-sm font-semibold ${res.balance > 0.001 ? "text-red-600" : "text-green-600"}`}>
              {res.balance > 0.001 ? t("balanceWarn", { amount: omr(res.balance) }) : t("balancePaid")}
            </div>
          )}
          <div className="flex gap-1.5 justify-end">
            {showCollect && (
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

function DraftInvoiceRowItem({
  inv, onIssued,
}: {
  inv: DraftInvoiceRow;
  onIssued: (id: string) => void;
}) {
  const t = useTranslations("dashboard.today.guest");
  const tIssue = useTranslations("dashboard.today.tabs");
  const omr = useFormatCurrency();
  const [issuing, setIssuing] = useState(false);

  async function handleIssue() {
    setIssuing(true);
    try {
      const res = await fetch(`/api/invoices/${inv.id}/issue`, { method: "PATCH" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || tIssue("issueFailed"));
      }
      toast.success(tIssue("issueSuccess"));
      onIssued(inv.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tIssue("issueFailed"));
    } finally {
      setIssuing(false);
    }
  }

  return (
    <li className="px-4 py-3 transition-colors hover:bg-gray-50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 truncate">
              {inv.tenant.name}
            </span>
            {inv.tenant.classification === "vip" && (
              <Badge {...getTenantClassBadge("vip")} size="sm">
                {t("vipBadge")}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {inv.tenant.phone && <span className="me-2 ltr-numbers">{inv.tenant.phone}</span>}
            {inv.propertyName}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {inv.invoiceNumber ?? "—"}
            {inv.reservationNumber && (
              <>
                {" · "}
                {inv.reservationNumber}
              </>
            )}
          </p>
        </div>
        <div className="flex-shrink-0 text-end space-y-1">
          <div className="text-sm font-semibold text-gray-900">{omr(inv.amount)}</div>
          <div className="flex gap-1.5 justify-end">
            <Button variant="primary" size="sm" onClick={handleIssue} disabled={issuing}>
              {issuing ? tIssue("issuing") : tIssue("issue")}
            </Button>
            {inv.reservationId && (
              <Link href={`/dashboard/reservations/${inv.reservationId}`} className="inline-flex">
                <Button variant="secondary" size="sm" tabIndex={-1}>
                  {t("view")}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function matchesReservation(res: ReservationRow, q: string): boolean {
  return (
    res.tenant.name.toLowerCase().includes(q) ||
    (res.tenant.phone ?? "").toLowerCase().includes(q) ||
    (res.reservationNumber ?? "").toLowerCase().includes(q) ||
    res.unitNames.some((u) => u.toLowerCase().includes(q)) ||
    res.propertyName.toLowerCase().includes(q)
  );
}

function matchesDraftInvoice(inv: DraftInvoiceRow, q: string): boolean {
  return (
    inv.tenant.name.toLowerCase().includes(q) ||
    (inv.tenant.phone ?? "").toLowerCase().includes(q) ||
    (inv.invoiceNumber ?? "").toLowerCase().includes(q) ||
    (inv.reservationNumber ?? "").toLowerCase().includes(q) ||
    inv.propertyName.toLowerCase().includes(q)
  );
}

function TabEmptyState({ text }: { text: string }) {
  return (
    <EmptyState
      inline
      variant="positive"
      size="sm"
      illustration={<CheckCircleIcon className="h-6 w-6" />}
      title={text}
    />
  );
}

/* ============================================================================
 *  Skeleton — mirrors the real grid (4 stat tiles, tabbed panel, 2-col
 *  financial + activity). Announce as a single live region via the outer
 *  SkeletonCard so screen readers receive one update on first load.
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

        {/* Tabbed panel */}
        <SkeletonCard padding={16} announce={false}>
          <div className="flex gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonLine key={i} width={90} size="sm" />
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, j) => (
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
  const tTabs   = useTranslations("dashboard.today.tabs");
  const tSec    = useTranslations("dashboard.today.sections");

  const [data, setData]       = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  // Plain local state — NOT synced to the URL. Syncing via router.replace()
  // triggers a Next.js navigation (and re-suspends this async route) on every
  // click, which is what made tab switching feel like a fresh page load.
  const [focusTab, setFocusTab] = useState<FocusTab>("arrivals");
  const [search, setSearch]   = useState("");

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

  // Dismiss an issued invoice from the list immediately, no full refetch needed.
  const handleInvoiceIssued = useCallback((id: string) => {
    setData((prev) =>
      prev ? { ...prev, invoicesToIssue: prev.invoicesToIssue.filter((i) => i.id !== id) } : prev,
    );
  }, []);

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

  const tabCounts: Record<FocusTab, number> = {
    arrivals: allArrivals.length,
    departures: data.departures.length,
    overstays: data.overstays.length,
    inHouse: data.inHouse.length,
    outstanding: data.outstanding.length,
    toIssue: data.invoicesToIssue.length,
  };

  // Instant client-side filtering — all tabs' data is already loaded, so
  // searching never triggers a network call.
  const q = search.trim().toLowerCase();
  const filteredArrivals    = q ? allArrivals.filter((r) => matchesReservation(r, q)) : allArrivals;
  const filteredDepartures  = q ? data.departures.filter((r) => matchesReservation(r, q)) : data.departures;
  const filteredOverstays   = q ? data.overstays.filter((r) => matchesReservation(r, q)) : data.overstays;
  const filteredInHouse     = q ? data.inHouse.filter((r) => matchesReservation(r, q)) : data.inHouse;
  const filteredOutstanding = q ? data.outstanding.filter((r) => matchesReservation(r, q)) : data.outstanding;
  const filteredToIssue     = q ? data.invoicesToIssue.filter((i) => matchesDraftInvoice(i, q)) : data.invoicesToIssue;

  const tabMatchCounts: Record<FocusTab, number> = {
    arrivals: filteredArrivals.length,
    departures: filteredDepartures.length,
    overstays: filteredOverstays.length,
    inHouse: filteredInHouse.length,
    outstanding: filteredOutstanding.length,
    toIssue: filteredToIssue.length,
  };
  const totalMatches = Object.values(tabMatchCounts).reduce((s, n) => s + n, 0);

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
          value={data.inHouse.length}
          sub={tStats("currentlyStaying")}
          color="bg-green-600"
          icon={HomeModernIcon}
        />
      </div>

      {/* ── Guest queues: one tabbed panel instead of a wide 2-col grid ── */}
      <div data-tour="today-tabs" className="rounded-xl bg-surface border border-border-subtle overflow-hidden">
        <Tabs value={focusTab} onValueChange={(v) => setFocusTab(v as FocusTab)}>
          <div className="flex flex-col gap-2.5 px-3 pt-3 sm:px-4">
            {/* Search sits on its own row, full-width — always visible and never
                squeezed by the tab strip, with a live match count while typing. */}
            <div className="flex items-center gap-3">
              <FilterBarSearch
                search={{
                  value: search,
                  onChange: setSearch,
                  placeholder: tTabs("searchPlaceholder"),
                  debounceMs: 0,
                  shortcut: true,
                }}
                className="max-w-none sm:max-w-[360px]"
              />
              {q && (
                <span className="hidden shrink-0 text-xs text-fg-tertiary sm:inline">
                  {tTabs("resultsCount", { count: totalMatches })}
                </span>
              )}
            </div>
            <TabsList variant="underline" size="md" ariaLabel={tTabs("ariaLabel")} className="-mx-1 overflow-x-auto">
              <TabsTrigger value="arrivals" count={q ? tabMatchCounts.arrivals : tabCounts.arrivals}>
                {tSec("arrivingToday")}
              </TabsTrigger>
              <TabsTrigger value="departures" count={q ? tabMatchCounts.departures : tabCounts.departures}>
                {tSec("checkingOutToday")}
              </TabsTrigger>
              <TabsTrigger
                value="overstays"
                count={q ? tabMatchCounts.overstays : tabCounts.overstays}
                countVariant={tabCounts.overstays > 0 ? "destructive" : "neutral"}
              >
                {tSec("overstays")}
              </TabsTrigger>
              <TabsTrigger value="inHouse" count={q ? tabMatchCounts.inHouse : tabCounts.inHouse}>
                {tTabs("inHouse")}
              </TabsTrigger>
              <TabsTrigger
                value="outstanding"
                count={q ? tabMatchCounts.outstanding : tabCounts.outstanding}
                countVariant={tabCounts.outstanding > 0 ? "warning" : "neutral"}
              >
                {tTabs("outstanding")}
              </TabsTrigger>
              <TabsTrigger
                value="toIssue"
                icon={<DocumentTextIcon />}
                count={q ? tabMatchCounts.toIssue : tabCounts.toIssue}
                countVariant={tabCounts.toIssue > 0 ? "warning" : "neutral"}
              >
                {tTabs("toIssue")}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="arrivals">
            {filteredArrivals.length === 0 ? (
              <TabEmptyState text={q ? tTabs("noSearchResults") : tSec("noArrivals")} />
            ) : (
              <ul className="divide-y divide-border-subtle max-h-[28rem] overflow-y-auto">
                {filteredArrivals.map((res) => (
                  <GuestRow key={res.id} res={res} type="arrival" />
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="departures">
            {filteredDepartures.length === 0 ? (
              <TabEmptyState text={q ? tTabs("noSearchResults") : tSec("noCheckouts")} />
            ) : (
              <ul className="divide-y divide-border-subtle max-h-[28rem] overflow-y-auto">
                {filteredDepartures.map((res) => (
                  <GuestRow key={res.id} res={res} type="departure" />
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="overstays">
            {filteredOverstays.length === 0 ? (
              <TabEmptyState text={q ? tTabs("noSearchResults") : tTabs("noOverstays")} />
            ) : (
              <ul className="divide-y divide-border-subtle max-h-[28rem] overflow-y-auto">
                {filteredOverstays.map((res) => (
                  <GuestRow key={res.id} res={res} type="overstay" />
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="inHouse">
            {filteredInHouse.length === 0 ? (
              <TabEmptyState text={q ? tTabs("noSearchResults") : tTabs("noInHouse")} />
            ) : (
              <ul className="divide-y divide-border-subtle max-h-[28rem] overflow-y-auto">
                {filteredInHouse.map((res) => (
                  <GuestRow key={res.id} res={res} type="inHouse" />
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="outstanding">
            {filteredOutstanding.length === 0 ? (
              <TabEmptyState text={q ? tTabs("noSearchResults") : tTabs("noOutstanding")} />
            ) : (
              <ul className="divide-y divide-border-subtle max-h-[28rem] overflow-y-auto">
                {filteredOutstanding.map((res) => (
                  <GuestRow key={res.id} res={res} type="outstanding" />
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="toIssue">
            {filteredToIssue.length === 0 ? (
              <TabEmptyState text={q ? tTabs("noSearchResults") : tTabs("noToIssue")} />
            ) : (
              <ul className="divide-y divide-border-subtle max-h-[28rem] overflow-y-auto">
                {filteredToIssue.map((inv) => (
                  <DraftInvoiceRowItem key={inv.id} inv={inv} onIssued={handleInvoiceIssued} />
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
