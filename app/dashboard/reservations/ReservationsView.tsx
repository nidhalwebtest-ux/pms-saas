"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import { format as fmtDateFns } from "date-fns";
import { toast } from "sonner";
import {
  CalendarDaysIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  PlusIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ArrowLeftOnRectangleIcon,
  ArrowRightOnRectangleIcon,
  NoSymbolIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import type { SortingState } from "@tanstack/react-table";
import type { DisplayStatus, TabKey } from "@/lib/reservation-status";
import {
  Badge,
  Button,
  DataTable,
  Modal,
  ModalBody,
  ModalHeader,
  useConfirmDialog,
} from "@/components/ui";
import {
  buildReservationColumns,
  countryFlag,
  reservationRowVariant,
} from "./columns";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PropertyOption { id: string; name: string }

interface TenantInfo {
  id: string; firstName: string; lastName: string;
  phone: string; nationality: string | null; classification: string | null;
}

interface UnitInfo {
  id: string; name: string; floor: number;
  propertyId: string; propertyName: string;
}

export interface ReservationRow {
  id: string;
  reservationNumber:       string | null;
  status:                  string;
  displayStatus:           DisplayStatus;
  displayStatusBadgeClass: string;
  displayStatusRowClass:   string;
  displayStatusPriority:   number;
  displayStatusUrgent:     boolean;
  displayStatusPulse:      boolean;
  startDate:               string;
  endDate:                 string;
  actualCheckIn:           string | null;
  actualCheckOut:          string | null;
  totalNights:             number;
  rateType:                string;
  grandTotal:              string;
  amountPaid:              string;
  balanceDue:              number;
  source:                  string;
  notes:                   string | null;
  cancelledReason:         string | null;
  tenant:                  TenantInfo;
  units:                   UnitInfo[];
  createdAt:               string;
}

interface SummaryData {
  all: number; arriving: number; overdueArrival: number;
  inHouse: number; dueCheckout: number; overstay: number;
  upcoming: number; checkedOut: number; cancelled: number; noShow: number;
}

interface AdvFilters {
  propertyId: string; dateFrom: string; dateTo: string;
  rateType: string; source: string;
}

type ModalState =
  | { type: "check-in";  res: ReservationRow }
  | { type: "check-out"; res: ReservationRow }
  | null;

// ── Helpers ────────────────────────────────────────────────────────────────────

function toLocalDay(iso: string): number {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

const todayMs = toLocalDay(new Date().toISOString());

function useFmtDate() {
  const t = useTranslations("reservations");
  const locale = useLocale();
  const dateFnsLocale = locale === "ar" ? arLocale : enLocale;
  return (iso: string): { text: string; cls: string } => {
    const ms = toLocalDay(iso);
    if (ms === todayMs) return { text: t("today"), cls: "text-orange-600 font-semibold" };
    return {
      text: fmtDateFns(new Date(iso), "d MMM yyyy", { locale: dateFnsLocale }),
      cls: "text-gray-900",
    };
  };
}

function useFmtDuration() {
  const t = useTranslations("reservations.duration");
  return (row: ReservationRow): string => {
    if (row.rateType === "monthly") {
      const start = new Date(row.startDate);
      const end   = new Date(row.endDate);
      const months =
        (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth() - start.getMonth());
      return months > 0 ? t("months", { count: months }) : t("nights", { count: row.totalNights });
    }
    return t("nights", { count: row.totalNights });
  };
}

const EMPTY_EMOJI: Partial<Record<TabKey, string>> = {
  arriving:    "☕",
  overstay:    "✓",
  dueCheckout: "👍",
  inHouse:     "🏠",
  upcoming:    "📅",
};
const EMPTY_KEY: Partial<Record<TabKey, string>> = {
  arriving:    "arriving",
  overstay:    "overstay",
  dueCheckout: "dueCheckout",
  inHouse:     "inHouse",
  upcoming:    "upcoming",
};

// ── Modal components ───────────────────────────────────────────────────────────

function CheckInModal({
  res, onClose, onDone,
}: { res: ReservationRow; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("reservations.checkInModal");
  const fmtDate = useFmtDate();
  const [loading, setLoading] = useState(false);
  const checkInDay = toLocalDay(res.startDate);
  const isEarly    = checkInDay > todayMs;

  async function confirm() {
    setLoading(true);
    try {
      const r = await fetch(`/api/reservations/${res.id}/check-in`, { method: "PATCH" });
      const data = await r.json();
      if (!r.ok) { toast.error(data.error ?? t("failed")); return; }
      toast.success(data.message);
      onDone();
    } finally { setLoading(false); }
  }

  return (
    <Modal open onClose={onClose} size="sm">
      <ModalHeader title={t("title")} />
      <ModalBody>
      <div className="space-y-4">
        <GuestInfo res={res} />
        {isEarly && (
          <div className="flex gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
            <span>
              {t.rich("earlyWarning", {
                date: fmtDate(res.startDate).text,
                b: (chunks) => <strong>{chunks}</strong>,
              })}
            </span>
          </div>
        )}
        <ModalActions
          confirmLabel={t("confirm")}
          confirmClass="bg-green-600 hover:bg-green-700 text-white"
          loading={loading}
          onCancel={onClose}
          onConfirm={confirm}
        />
      </div>
      </ModalBody>
    </Modal>
  );
}

function CheckOutModal({
  res, onClose, onDone,
}: { res: ReservationRow; onClose: () => void; onDone: () => void }) {
  const t       = useTranslations("reservations.checkOutModal");
  const fmtDate = useFmtDate();
  const [loading,    setLoading]    = useState(false);
  const [additionalAmt, setAdditionalAmt] = useState("");
  const [adjustCharges, setAdjustCharges] = useState(false);

  const endDay    = toLocalDay(res.endDate);
  const isOverstay = endDay < todayMs;
  const isEarly    = endDay > todayMs;
  const extraNights = isOverstay
    ? Math.ceil((todayMs - endDay) / 86_400_000)
    : 0;
  const savedNights = isEarly
    ? Math.ceil((endDay - todayMs) / 86_400_000)
    : 0;

  async function confirm() {
    setLoading(true);
    try {
      const body: Record<string, unknown> = { forceWithBalance: true };
      if (adjustCharges) body.adjustCharges = true;
      if (additionalAmt && Number(additionalAmt) > 0) body.additionalAmount = Number(additionalAmt);

      const r    = await fetch(`/api/reservations/${res.id}/check-out`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) { toast.error(data.error ?? t("failed")); return; }
      toast.success(data.message);
      onDone();
    } finally { setLoading(false); }
  }

  return (
    <Modal open onClose={onClose} size="sm">
      <ModalHeader title={t("title")} />
      <ModalBody>
      <div className="space-y-4">
        <GuestInfo res={res} />

        {/* Balance warning */}
        {res.balanceDue > 0 && (
          <div className="flex gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
            <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
            <div>
              <p className="font-semibold">{t("outstandingBalance", { amount: res.balanceDue.toFixed(3) })}</p>
              <p className="text-xs mt-0.5 text-red-700">{t("unpaidWarning")}</p>
            </div>
          </div>
        )}

        {/* Overstay */}
        {isOverstay && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800 space-y-2">
            <p className="font-semibold">{t("overstayWarning", { count: extraNights })}</p>
            <p className="text-xs">{t("overstayPlanned", { date: fmtDate(res.endDate).text })}</p>
            <label className="flex items-center gap-2 text-xs">
              <input type="number" min="0" step="0.001" placeholder={t("extraChargePlaceholder")}
                className="w-36 rounded border border-red-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-red-400 ltr-numbers"
                value={additionalAmt} onChange={(e) => setAdditionalAmt(e.target.value)} />
              <span>{t("addOverstayCharge")}</span>
            </label>
          </div>
        )}

        {/* Early checkout */}
        {isEarly && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 space-y-2">
            <p className="font-semibold">{t("earlyCheckout", { count: savedNights })}</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={adjustCharges} onChange={(e) => setAdjustCharges(e.target.checked)}
                className="rounded border-amber-400" />
              <span className="text-xs">{t("recalcCharges")}</span>
            </label>
          </div>
        )}

        <ModalActions
          confirmLabel={t("confirm")}
          confirmClass={res.balanceDue > 0 ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}
          loading={loading}
          onCancel={onClose}
          onConfirm={confirm}
        />
      </div>
      </ModalBody>
    </Modal>
  );
}

const CANCEL_REASONS: { value: string; labelKey: string }[] = [
  { value: "Guest Cancelled",   labelKey: "guestCancelled" },
  { value: "No Show",            labelKey: "noShow" },
  { value: "Overbooking",        labelKey: "overbooking" },
  { value: "Duplicate Booking",  labelKey: "duplicateBooking" },
  { value: "Other",              labelKey: "other" },
];

// ── Shared modal UI sub-components ────────────────────────────────────────────

function GuestInfo({ res }: { res: ReservationRow }) {
  const t = useTranslations("reservations.guestInfo");
  const fmtDate = useFmtDate();
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm space-y-1">
      <p className="font-semibold text-gray-900">
        {countryFlag(res.tenant.nationality)} {res.tenant.firstName} {res.tenant.lastName}
      </p>
      <p className="text-gray-500">
        {res.reservationNumber ?? res.id.slice(0, 8).toUpperCase()} ·{" "}
        {fmtDate(res.startDate).text} → {fmtDate(res.endDate).text}
      </p>
      {res.units.length > 0 && (
        <p className="text-gray-500">
          {t("unitsLabel")} {res.units.map((u) => u.name).join(", ")}
        </p>
      )}
    </div>
  );
}

function ModalActions({
  confirmLabel, confirmClass, loading, onCancel, onConfirm, disabled = false,
}: {
  confirmLabel: string; confirmClass: string; loading: boolean;
  onCancel: () => void; onConfirm: () => void; disabled?: boolean;
}) {
  const tCommon = useTranslations("common");
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button onClick={onCancel} disabled={loading}
        className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50">
        {tCommon("cancel")}
      </button>
      <button onClick={onConfirm} disabled={loading || disabled}
        className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors ${confirmClass}`}>
        {loading ? "…" : confirmLabel}
      </button>
    </div>
  );
}

// ── Sort header ───────────────────────────────────────────────────────────────

// ── Tab definitions ───────────────────────────────────────────────────────────

const PRIMARY_TABS: { key: TabKey; tKey: string }[] = [
  { key: "all",          tKey: "all" },
  { key: "arriving",     tKey: "arriving" },
  { key: "inHouse",      tKey: "inHouse" },
  { key: "dueCheckout",  tKey: "dueCheckout" },
  { key: "overstay",     tKey: "overstay" },
  { key: "upcoming",     tKey: "upcoming" },
];

const SECONDARY_TABS: { key: TabKey; tKey: string }[] = [
  { key: "checkedOut",    tKey: "checkedOut" },
  { key: "cancelled",     tKey: "cancelled" },
  { key: "noShow",        tKey: "noShow" },
  { key: "overdueArrival", tKey: "overdueArrival" },
];

// ── Main component ─────────────────────────────────────────────────────────────

export default function ReservationsView({
  properties,
  defaultPropertyId = "",
  scopedToBuilding = false,
}: {
  properties: PropertyOption[];
  defaultPropertyId?: string;
  scopedToBuilding?: boolean;
}) {
  const router = useRouter();
  const t        = useTranslations("reservations");
  const tTabs    = useTranslations("reservations.tabs");
  const tTable   = useTranslations("reservations.table");
  const tStatus  = useTranslations("reservations.statuses");
  const tActions = useTranslations("reservations.actions");
  const tEmpty   = useTranslations("reservations.empty");
  const tSrc     = useTranslations("reservations.sources");
  const tNoShow  = useTranslations("reservations.noShowModal");
  const tCancel  = useTranslations("reservations.cancelModal");
  const confirm  = useConfirmDialog();
  const locale   = useLocale();
  const dateFnsLocale = locale === "ar" ? arLocale : enLocale;
  const fmtDate     = useFmtDate();
  const fmtDuration = useFmtDuration();

  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [summary,      setSummary]      = useState<SummaryData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState<TabKey>("all");
  const [search,       setSearch]       = useState("");
  const [showFilters,  setShowFilters]  = useState(false);
  const [advFilters,   setAdvFilters]   = useState<AdvFilters>({ propertyId: defaultPropertyId, dateFrom: "", dateTo: "", rateType: "", source: "" });
  const [sorting,      setSorting]      = useState<SortingState>([
    { id: "startDate", desc: false },
  ]);
  const [modal,        setModal]        = useState<ModalState>(null);

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (advFilters.propertyId) sp.set("propertyId", advFilters.propertyId);
      if (advFilters.dateFrom)   sp.set("dateFrom",   advFilters.dateFrom);
      if (advFilters.dateTo)     sp.set("dateTo",     advFilters.dateTo);
      if (advFilters.rateType)   sp.set("rateType",   advFilters.rateType);
      if (advFilters.source)     sp.set("source",     advFilters.source);

      const [listRes, summaryRes] = await Promise.all([
        fetch(`/api/reservations?${sp}`),
        fetch("/api/reservations/summary"),
      ]);
      const [listData, sumData] = await Promise.all([listRes.json(), summaryRes.json()]);

      if (listData.reservations) setReservations(listData.reservations);
      if (sumData.all !== undefined) setSummary(sumData);
    } catch {
      toast.error(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [advFilters, t]);

  // Initial + 60-second summary refresh
  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const id = setInterval(() => {
      fetch("/api/reservations/summary")
        .then((r) => r.json())
        .then((d) => { if (d.all !== undefined) setSummary(d); })
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
  }, [search]);

  // ── Derived list ─────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let rows = [...reservations];

    // Tab filter
    if (activeTab !== "all") {
      rows = rows.filter((r) => {
        const tabMap: Partial<Record<TabKey, string[]>> = {
          arriving:      ["Arriving Today"],
          overdueArrival:["Overdue Arrival"],
          inHouse:       ["In House"],
          dueCheckout:   ["Due Checkout"],
          overstay:      ["Overstay"],
          upcoming:      ["Upcoming"],
          checkedOut:    ["Checked Out"],
          cancelled:     ["Cancelled"],
          noShow:        ["No Show"],
        };
        return tabMap[activeTab]?.includes(r.displayStatus);
      });
    }

    // Search (client-side, instant)
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => {
        const num  = (r.reservationNumber ?? "").toLowerCase();
        const name = `${r.tenant.firstName} ${r.tenant.lastName}`.toLowerCase();
        const phone = r.tenant.phone.toLowerCase();
        const units = r.units.map((u) => u.name.toLowerCase()).join(" ");
        return num.includes(q) || name.includes(q) || phone.includes(q) || units.includes(q);
      });
    }

    return rows;
  }, [reservations, activeTab, search]);

  async function handleAction(type: "check-in" | "check-out" | "cancel" | "no-show", res: ReservationRow) {
    if (type === "no-show") {
      await confirm({
        title: tNoShow("title"),
        description: tNoShow.rich("prompt", {
          name: `${res.tenant.firstName} ${res.tenant.lastName}`,
          b: (chunks) => <strong>{chunks}</strong>,
        }),
        tone: "warning",
        confirmLabel: tNoShow("confirm"),
        onConfirm: async () => {
          const r    = await fetch(`/api/reservations/${res.id}/no-show`, { method: "PATCH" });
          const data = await r.json();
          if (!r.ok) {
            toast.error(data.error ?? tNoShow("failed"));
            throw new Error(data.error ?? tNoShow("failed"));
          }
          toast.success(data.message);
          fetchData();
        },
      });
      return;
    }
    if (type === "cancel") {
      const totalPaid = Number(res.amountPaid);
      const refundBody = totalPaid > 0 ? (
        <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
          <span>
            {tCancel.rich("totalPaidRefund", {
              amount: totalPaid.toFixed(3),
              b: (chunks) => <strong>{chunks}</strong>,
            })}
          </span>
        </div>
      ) : undefined;
      const nonOther = CANCEL_REASONS.filter((r) => r.value !== "Other").map((r) => r.value);
      await confirm({
        title: tCancel("title"),
        tone: "destructive",
        body: refundBody,
        reason: {
          label: tCancel("reasonLabel"),
          placeholder: tCancel("selectReason"),
          options: CANCEL_REASONS.map((r) => ({
            value: r.value,
            label: tCancel(`reasons.${r.labelKey}`),
          })),
          notesFor: nonOther,
          notesRequiredFor: ["Other"],
          notesLabel: tCancel("notesLabel"),
          notesPlaceholder: tCancel("notesPlaceholder"),
        },
        confirmLabel: tCancel("confirm"),
        cancelLabel: tCancel("keep"),
        onConfirm: async ({ reason, notes }) => {
          const r = await fetch(`/api/reservations/${res.id}/cancel`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason, notes: notes ?? "" }),
          });
          const data = await r.json();
          if (!r.ok) {
            toast.error(data.error ?? tCancel("errors.cancelFailed"));
            throw new Error(data.error ?? tCancel("errors.cancelFailed"));
          }
          toast.success(data.message ?? tCancel("successDefault"));
          fetchData();
        },
      });
      return;
    }
    setModal({ type, res } as ModalState);
  }

  function onActionDone() {
    setModal(null);
    fetchData();
  }

  const totalRevenue  = filtered.reduce((s, r) => s + Number(r.grandTotal), 0);
  const totalBalance  = filtered.reduce((s, r) => s + r.balanceDue, 0);
  const hasAdvFilters = Object.values(advFilters).some(Boolean);
  const hasActiveFilters = activeTab !== "all" || !!search.trim() || hasAdvFilters;

  // ── Column defs + row actions ─────────────────────────────────────────────

  const columns = useMemo(
    () => buildReservationColumns({ t, tTable, tStatus, fmtDate, fmtDuration }),
    [t, tTable, tStatus, fmtDate, fmtDuration],
  );

  const rowActions = useCallback(
    (r: ReservationRow) => {
      const ds = r.displayStatus;
      const canCheckIn   = ds === "Arriving Today" || ds === "Overdue Arrival";
      const canCheckOut  = ds === "In House" || ds === "Due Checkout" || ds === "Overstay";
      const canNoShow    = ds === "Overdue Arrival";
      const canCancel    = ds === "Upcoming" || ds === "Arriving Today" || ds === "Overdue Arrival";
      return [
        {
          id: "check-in",
          label: tActions("checkIn"),
          icon: <ArrowRightOnRectangleIcon className="h-4 w-4" />,
          visible: canCheckIn,
          onClick: () => handleAction("check-in", r),
        },
        {
          id: "check-out",
          label: ds === "Overstay" ? tActions("checkOutUrgent") : tActions("checkOut"),
          icon: <ArrowLeftOnRectangleIcon className="h-4 w-4" />,
          variant: ds === "Overstay" ? ("destructive" as const) : ("default" as const),
          visible: canCheckOut,
          onClick: () => handleAction("check-out", r),
        },
        {
          id: "no-show",
          label: tActions("markNoShow"),
          icon: <XCircleIcon className="h-4 w-4" />,
          variant: "destructive" as const,
          visible: canNoShow,
          onClick: () => handleAction("no-show", r),
        },
        {
          id: "cancel",
          label: tActions("cancel"),
          icon: <NoSymbolIcon className="h-4 w-4" />,
          variant: "destructive" as const,
          visible: canCancel,
          onClick: () => handleAction("cancel", r),
        },
      ];
    },
    // handleAction is defined in the same component but captures `confirm`,
    // `fetchData`, and the translators — those are stable enough that
    // re-deriving rowActions on every render is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tActions],
  );

  const today = new Date();
  const todayLabel = fmtDateFns(today, "EEEE, d MMMM yyyy", { locale: dateFnsLocale });

  return (
    <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{todayLabel}</p>
        </div>
        <Link href="/dashboard/reservations/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors">
          <PlusIcon className="h-4 w-4" />
          {t("newReservation")}
        </Link>
      </div>

      {/* ── Primary tabs ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1 mb-1">
        {PRIMARY_TABS.map(({ key, tKey }) => {
          const count   = summary?.[key as keyof SummaryData] ?? 0;
          const active  = activeTab === key;
          const isOvr   = key === "overstay"    && count > 0;
          const isArv   = key === "arriving"    && count > 0;
          const isDue   = key === "dueCheckout" && count > 0;
          return (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}>
              {tTabs(tKey)}
              {count > 0 && (
                <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold ${
                  active
                    ? "bg-white/25 text-white"
                    : isOvr ? "bg-red-600 text-white" + (isOvr ? " animate-pulse" : "")
                    : isArv ? "bg-orange-500 text-white"
                    : isDue ? "bg-orange-400 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
        {/* Secondary tabs dropdown-style */}
        <div className="flex gap-1">
          {SECONDARY_TABS.map(({ key, tKey }) => {
            const count  = summary?.[key as keyof SummaryData] ?? 0;
            const active = activeTab === key;
            return (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-gray-700 text-white"
                    : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}>
                {tTabs(tKey)}
                {count > 0 && (
                  <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-xs ${
                    active ? "bg-white/25 text-white" : "bg-gray-200 text-gray-600"
                  }`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Search + filter bar ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full rounded-lg border-0 py-2 ps-9 pe-3 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute end-2 top-1/2 -translate-y-1/2">
                <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
          <button onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${
              showFilters || hasAdvFilters
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
            }`}>
            <AdjustmentsHorizontalIcon className="h-4 w-4" />
            {t("filters")}
            {hasAdvFilters && <span className="h-2 w-2 rounded-full bg-blue-600" />}
          </button>
          <button onClick={fetchData} disabled={loading} aria-label={t("refresh")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Collapsible advanced filters */}
        {showFilters && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <select value={advFilters.propertyId}
                onChange={(e) => setAdvFilters((v) => ({ ...v, propertyId: e.target.value }))}
                disabled={scopedToBuilding}
                title={scopedToBuilding ? t("scopedNote") : undefined}
                className="rounded-lg border-0 py-1.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed">
                {!scopedToBuilding && <option value="">{t("allProperties")}</option>}
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="date" placeholder={t("from")} value={advFilters.dateFrom}
                onChange={(e) => setAdvFilters((v) => ({ ...v, dateFrom: e.target.value }))}
                className="rounded-lg border-0 py-1.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-500" />
              <input type="date" placeholder={t("to")} value={advFilters.dateTo}
                onChange={(e) => setAdvFilters((v) => ({ ...v, dateTo: e.target.value }))}
                className="rounded-lg border-0 py-1.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-500" />
              <select value={advFilters.rateType}
                onChange={(e) => setAdvFilters((v) => ({ ...v, rateType: e.target.value }))}
                className="rounded-lg border-0 py-1.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-500">
                <option value="">{t("allRateTypes")}</option>
                <option value="daily">{t("daily")}</option>
                <option value="monthly">{t("monthly")}</option>
              </select>
              <select value={advFilters.source}
                onChange={(e) => setAdvFilters((v) => ({ ...v, source: e.target.value }))}
                className="rounded-lg border-0 py-1.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-500">
                <option value="">{t("allSources")}</option>
                <option value="walk_in">{tSrc("walkIn")}</option>
                <option value="phone">{tSrc("phone")}</option>
                <option value="whatsapp">{tSrc("whatsapp")}</option>
                <option value="online">{tSrc("online")}</option>
                <option value="agent">{tSrc("agent")}</option>
              </select>
            </div>
            {hasAdvFilters && (
              <button onClick={() => { setAdvFilters({ propertyId: "", dateFrom: "", dateTo: "", rateType: "", source: "" }); fetchData(); }}
                className="mt-2 text-xs text-blue-600 hover:underline">
                {t("clearAllFilters")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      {(() => {
        const emptyKey   = EMPTY_KEY[activeTab] ?? "default";
        const emptyEmoji = EMPTY_EMOJI[activeTab] ?? "📋";
        return (
          <DataTable<ReservationRow>
            data={filtered}
            columns={columns}
            mode="client"
            sorting={{ state: sorting, onChange: setSorting }}
            rowActions={rowActions}
            rowVariant={reservationRowVariant}
            loading={loading}
            hasActiveFilters={hasActiveFilters}
            emptyState={{
              title: tEmpty(`${emptyKey}.title`),
              description: tEmpty(`${emptyKey}.sub`),
              illustration: <span className="text-4xl">{emptyEmoji}</span>,
            }}
            aria-label={t("title")}
          />
        );
      })()}

      {/* Footer */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 mt-2 text-xs text-fg-tertiary">
          <span>{t("showingCount", { shown: filtered.length, total: reservations.length })}</span>
          <div className="flex gap-4">
            <span>{t("revenue")}: <strong className="text-fg ltr-numbers">{totalRevenue.toFixed(3)} OMR</strong></span>
            <span>{t("outstanding")}: <strong className={`ltr-numbers ${totalBalance > 0 ? "text-error-600" : "text-success-600"}`}>{totalBalance.toFixed(3)} OMR</strong></span>
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {modal?.type === "check-in"  && <CheckInModal  res={modal.res} onClose={() => setModal(null)} onDone={onActionDone} />}
      {modal?.type === "check-out" && <CheckOutModal res={modal.res} onClose={() => setModal(null)} onDone={onActionDone} />}
    </div>
  );
}

