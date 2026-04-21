"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ar as arLocale, enUS as enLocale } from "date-fns/locale";
import { useTranslations, useLocale } from "next-intl";
import {
  BuildingOfficeIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  BanknotesIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";

// ── Types ──────────────────────────────────────────────────────────────────────

interface UnitCounts {
  total: number; occupied: number; reserved: number;
  vacant: number; maintenance: number;
}
interface BuildingRow {
  id: string; name: string; total: number; occupied: number;
  reserved: number; vacant: number; maintenance: number; occupancyPct: number;
}
interface GuestRow {
  id: string; reservationNumber: string | null;
  tenant: { id: string; name: string; phone: string | null; classification: string };
  unitNames: string[]; propertyName: string;
  startDate: string; endDate: string;
  totalNights: number; nightsRemaining: number;
  grandTotal: number; amountPaid: number; balance: number;
}
interface BalanceRow {
  id: string; reservationNumber: string | null; status: string;
  tenant: { id: string; name: string; phone: string | null };
  unitName: string; endDate: string;
  grandTotal: number; amountPaid: number; balance: number;
  daysPastCheckout: number;
}
interface ReceptionistData {
  unitCounts: UnitCounts;
  buildingOccupancy: BuildingRow[];
  currentGuests: GuestRow[];
  outstandingBalances: BalanceRow[];
}

type SubTab = "occupancy" | "guests" | "outstanding";

// ── Helpers ────────────────────────────────────────────────────────────────────

function omr(n: number) { return `${n.toFixed(3)} OMR`; }

function OccupancyBar({ pct, color = "bg-blue-500" }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

function UnitCountCard({
  label, value, total, color, bg, pctLabel,
}: { label: string; value: number; total: number; color: string; bg: string; pctLabel: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className={`rounded-xl p-4 ${bg}`}>
      <p className={`text-xs font-semibold uppercase tracking-wider ${color} opacity-80`}>
        {label}
      </p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
      <p className={`text-xs mt-0.5 ${color} opacity-60`}>{pctLabel}</p>
      <OccupancyBar pct={pct} color={color.replace("text-", "bg-")} />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ReceptionistView({
  propertyId,
  properties,
}: {
  propertyId: string;
  properties: { id: string; name: string }[];
}) {
  void properties;
  const t       = useTranslations("dashboard.receptionist");
  const tTabs   = useTranslations("dashboard.receptionist.tabs");
  const tOcc    = useTranslations("dashboard.receptionist.occupancy");
  const tOccTbl = useTranslations("dashboard.receptionist.occupancy.table");
  const tG      = useTranslations("dashboard.receptionist.guests");
  const tGTbl   = useTranslations("dashboard.receptionist.guests.table");
  const tO      = useTranslations("dashboard.receptionist.outstanding");
  const tOTbl   = useTranslations("dashboard.receptionist.outstanding.table");
  const locale  = useLocale();
  const dateFnsLocale = locale === "ar" ? arLocale : enLocale;

  const [data, setData]       = useState<ReceptionistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [subTab, setSubTab]   = useState<SubTab>("occupancy");
  const [search, setSearch]   = useState("");

  const fetchData = useCallback(async () => {
    try {
      const params = propertyId ? `?propertyId=${propertyId}` : "";
      const res = await fetch(`/api/dashboard/receptionist${params}`);
      if (!res.ok) throw new Error("Failed to load");
      setData(await res.json());
      setError(null);
    } catch {
      setError(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [propertyId, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-gray-400">{t("loading")}</div>
      </div>
    );
  if (error || !data)
    return (
      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
        {error ?? t("noData")}
      </div>
    );

  const { unitCounts: uc, buildingOccupancy, currentGuests, outstandingBalances } = data;

  // Filtered guests by search
  const filteredGuests = currentGuests.filter((g) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      g.tenant.name.toLowerCase().includes(s) ||
      g.unitNames.some((u) => u.toLowerCase().includes(s)) ||
      g.reservationNumber?.toLowerCase().includes(s)
    );
  });

  const filteredBalances = outstandingBalances.filter((b) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      b.tenant.name.toLowerCase().includes(s) ||
      b.unitName.toLowerCase().includes(s) ||
      b.reservationNumber?.toLowerCase().includes(s)
    );
  });

  const totalOutstanding = outstandingBalances.reduce((s, b) => s + b.balance, 0);

  return (
    <div className="space-y-4">
      {/* Sub-tab nav */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          ["occupancy",   tTabs("occupancy",   { total: uc.total })],
          ["guests",      tTabs("guests",      { count: uc.occupied })],
          ["outstanding", tTabs("outstanding", { count: outstandingBalances.length })],
        ] as [SubTab, string][]).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => { setSubTab(tab); setSearch(""); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              subTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Occupancy Tab ── */}
      {subTab === "occupancy" && (
        <div className="space-y-5">
          {/* Unit count cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-xl bg-gray-50 p-4 lg:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{tOcc("totalUnits")}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{uc.total}</p>
              <p className="text-xs text-gray-400 mt-0.5">{tOcc("acrossBuildings")}</p>
            </div>
            <UnitCountCard label={tOcc("occupied")}    value={uc.occupied}    total={uc.total} color="text-red-600"    bg="bg-red-50"   pctLabel={tOcc("pctOfTotal", { pct: uc.total > 0 ? Math.round((uc.occupied / uc.total) * 100) : 0 })} />
            <UnitCountCard label={tOcc("reserved")}    value={uc.reserved}    total={uc.total} color="text-blue-600"   bg="bg-blue-50"  pctLabel={tOcc("pctOfTotal", { pct: uc.total > 0 ? Math.round((uc.reserved / uc.total) * 100) : 0 })} />
            <UnitCountCard label={tOcc("vacant")}      value={uc.vacant}      total={uc.total} color="text-green-600"  bg="bg-green-50" pctLabel={tOcc("pctOfTotal", { pct: uc.total > 0 ? Math.round((uc.vacant / uc.total) * 100) : 0 })} />
            <UnitCountCard label={tOcc("maintenance")} value={uc.maintenance} total={uc.total} color="text-gray-500"   bg="bg-gray-100" pctLabel={tOcc("pctOfTotal", { pct: uc.total > 0 ? Math.round((uc.maintenance / uc.total) * 100) : 0 })} />
          </div>

          {/* Low-occupancy alert */}
          {buildingOccupancy.some((b) => b.occupancyPct < 50 && b.total > 0) && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <span className="text-amber-500 mt-0.5">⚠</span>
              <div className="text-sm text-amber-800">
                {buildingOccupancy
                  .filter((b) => b.occupancyPct < 50 && b.total > 0)
                  .map((b) => (
                    <span key={b.id} className="me-3">
                      {tOcc("lowAlert", { name: b.name, pct: b.occupancyPct, vacant: b.vacant })}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Building breakdown */}
          {buildingOccupancy.length > 1 && (
            <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5">
              <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
                <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900">{tOcc("buildingBreakdown")}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead>
                    <tr className="bg-gray-50">
                      {(["building", "total", "occupied", "reserved", "vacant", "maint", "occupancy"] as const).map((k) => (
                        <th key={k} className="px-4 py-2.5 text-start text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          {tOccTbl(k)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {buildingOccupancy.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{b.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{b.total}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-red-600">{b.occupied}</td>
                        <td className="px-4 py-3 text-sm text-blue-600">{b.reserved}</td>
                        <td className="px-4 py-3 text-sm text-green-600">{b.vacant}</td>
                        <td className="px-4 py-3 text-sm text-gray-400">{b.maintenance}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24">
                              <OccupancyBar
                                pct={b.occupancyPct}
                                color={
                                  b.occupancyPct >= 70
                                    ? "bg-green-500"
                                    : b.occupancyPct >= 50
                                      ? "bg-amber-500"
                                      : "bg-red-500"
                                }
                              />
                            </div>
                            <span className={`text-sm font-semibold ${
                              b.occupancyPct >= 70
                                ? "text-green-700"
                                : b.occupancyPct >= 50
                                  ? "text-amber-700"
                                  : "text-red-700"
                            }`}>
                              {b.occupancyPct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── Current Guests Tab ── */}
      {subTab === "guests" && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={tG("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 ps-9 pe-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {filteredGuests.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl bg-white py-14 shadow-sm ring-1 ring-gray-900/5">
              <CheckCircleIcon className="mb-2 h-10 w-10 text-gray-200" />
              <p className="text-sm text-gray-400">
                {search ? tG("noMatching") : tG("noneCheckedIn")}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead>
                    <tr className="bg-gray-50">
                      {(["guest", "units", "checkin", "checkout", "nightsLeft", "balance"] as const).map((k) => (
                        <th key={k} className="px-4 py-2.5 text-start text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          {tGTbl(k)}
                        </th>
                      ))}
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredGuests.map((g) => (
                      <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{g.tenant.name}</p>
                              {g.tenant.phone && (
                                <p className="text-xs text-gray-400 ltr-numbers">{g.tenant.phone}</p>
                              )}
                            </div>
                            {g.tenant.classification === "vip" && (
                              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">{tG("vip")}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {g.unitNames.join(", ")}
                          <div className="text-xs text-gray-400">{g.propertyName}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {format(parseISO(g.startDate), "d MMM", { locale: dateFnsLocale })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {format(parseISO(g.endDate), "d MMM", { locale: dateFnsLocale })}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`font-semibold ${g.nightsRemaining <= 1 ? "text-orange-600" : "text-gray-700"}`}>
                            {g.nightsRemaining}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={g.balance > 0.001 ? "font-semibold text-red-600 ltr-numbers" : "text-green-600"}>
                            {g.balance > 0.001 ? omr(g.balance) : tG("paid")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 justify-end">
                            {g.balance > 0.001 && (
                              <Link
                                href={`/dashboard/payments/new?reservationId=${g.id}`}
                                className="rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                              >
                                {tG("collect")}
                              </Link>
                            )}
                            <Link
                              href={`/dashboard/reservations/${g.id}`}
                              className="rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                              {tG("view")}
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Outstanding Balances Tab ── */}
      {subTab === "outstanding" && (
        <div className="space-y-4">
          {outstandingBalances.length > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <BanknotesIcon className="h-5 w-5 text-red-500" />
                <p className="text-sm font-semibold text-red-800">
                  {tO("totalLabel")}{" "}
                  <span className="text-red-700 ltr-numbers">{omr(totalOutstanding)}</span>
                  {" "}{tO("summary", { count: outstandingBalances.length })}
                </p>
              </div>
              <Link
                href="/dashboard/payments/new"
                className="text-sm font-semibold text-red-700 hover:text-red-900"
              >
                {tO("recordPayment")}
              </Link>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={tO("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 ps-9 pe-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {filteredBalances.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl bg-white py-14 shadow-sm ring-1 ring-gray-900/5">
              <CheckCircleIcon className="mb-2 h-10 w-10 text-green-300" />
              <p className="text-sm text-gray-400">
                {search ? tO("noMatching") : tO("allSettled")}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead>
                    <tr className="bg-gray-50">
                      {(["guest", "unit", "status", "total", "paid", "balance", "daysOverdue"] as const).map((k) => (
                        <th key={k} className="px-4 py-2.5 text-start text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          {tOTbl(k)}
                        </th>
                      ))}
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredBalances.map((b) => (
                      <tr
                        key={b.id}
                        className={`transition-colors ${
                          b.daysPastCheckout > 60
                            ? "bg-red-50 hover:bg-red-100"
                            : b.daysPastCheckout > 30
                              ? "bg-orange-50 hover:bg-orange-100"
                              : b.daysPastCheckout > 0
                                ? "bg-amber-50 hover:bg-amber-100"
                                : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{b.tenant.name}</p>
                          {b.tenant.phone && (
                            <p className="text-xs text-gray-400 ltr-numbers">{b.tenant.phone}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{b.unitName}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 capitalize">
                            {b.status.toLowerCase().replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 ltr-numbers">{omr(b.grandTotal)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 ltr-numbers">{omr(b.amountPaid)}</td>
                        <td className="px-4 py-3 text-sm font-bold text-red-600 ltr-numbers">{omr(b.balance)}</td>
                        <td className="px-4 py-3">
                          {b.daysPastCheckout > 0 ? (
                            <span className={`text-sm font-bold ${
                              b.daysPastCheckout > 60
                                ? "text-red-700"
                                : b.daysPastCheckout > 30
                                  ? "text-orange-600"
                                  : "text-amber-600"
                            }`}>
                              {tO("daysSuffix", { days: b.daysPastCheckout })}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">{tO("current")}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 justify-end">
                            <Link
                              href={`/dashboard/payments/new?reservationId=${b.id}`}
                              className="rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                            >
                              {tO("collect")}
                            </Link>
                            <Link
                              href={`/dashboard/reservations/${b.id}`}
                              className="rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                              {tO("view")}
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
