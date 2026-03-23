"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DayPicker, DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { toast } from "sonner";
import {
  MagnifyingGlassIcon,
  CalendarIcon,
  HomeIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  XMarkIcon,
  PlusIcon,
  UserIcon,
  StarIcon,
  NoSymbolIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolid } from "@heroicons/react/24/solid";
import {
  calculateNights,
  addCalendarMonths,
  countCalendarMonths,
  buildCalendarMonthBreakdown,
  collapseToSegments,
  calculateGrandTotal,
  formatDuration,
  roundOMR,
  sumSubtotals,
} from "@/lib/reservation-engine";
import TenantForm from "@/components/dashboard/TenantForm";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PropertyOption { id: string; name: string }

interface TenantResult {
  id:             string;
  firstName:      string;
  lastName:       string;
  phone:          string;
  email:          string | null;
  classification: string | null;
  nationality:    string | null;
}

interface UnitOption {
  id:         string;
  name:       string;
  unitType:   string;
  floor:      number;
  bedrooms:   number;
  bathrooms:  number;
  area:       number | null;
  amenities:  string[];
  status:     string;
  available:  boolean;
  nights:     number;
  rateType:   string;
  rateAmount: number;
  rateSource: string;
  priceName:  string | null;
  subtotal:   number;
  breakdown:  object[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Tenant",  icon: UserIcon },
  { id: 2, label: "Dates",   icon: CalendarIcon },
  { id: 3, label: "Units",   icon: HomeIcon },
  { id: 4, label: "Summary", icon: CurrencyDollarIcon },
  { id: 5, label: "Confirm", icon: CheckCircleIcon },
];

const UNIT_TYPE_LABELS: Record<string, string> = {
  STUDIO:   "Studio",
  ONE_BR:   "1 BR",
  TWO_BR:   "2 BR",
  THREE_BR: "3 BR",
  SUITE:    "Suite",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtOMR(v: number) {
  return v.toLocaleString("en-OM", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

/** Format a Date as "YYYY-MM-DD" using LOCAL date components (avoids UTC timezone shift). */
function toDateInput(d: Date): string {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${dy}`;
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function ClassBadge({ c }: { c: string | null }) {
  if (c === "vip")
    return <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-full px-1.5 py-0.5"><StarIcon className="h-2.5 w-2.5" />VIP</span>;
  if (c === "blacklisted")
    return <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5"><NoSymbolIcon className="h-2.5 w-2.5" />Blacklisted</span>;
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BookingEngine({ properties }: { properties: PropertyOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // ── Step 1: Tenant ────────────────────────────────────────────────────────
  const [tenantQuery,    setTenantQuery]    = useState("");
  const [tenantResults,  setTenantResults]  = useState<TenantResult[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<TenantResult | null>(null);
  const [tenantLoading,  setTenantLoading]  = useState(false);
  const [showDropdown,   setShowDropdown]   = useState(false);
  const [showAddTenant,  setShowAddTenant]  = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Step 2: Dates ─────────────────────────────────────────────────────────
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [startDate,  setStartDate]  = useState("");
  const [endDate,    setEndDate]    = useState("");
  const [rateType,   setRateType]   = useState<"daily" | "monthly">("daily");
  const [period,     setPeriod]     = useState(1); // nights OR months
  const [calMode,    setCalMode]    = useState(false);
  const [calRange,   setCalRange]   = useState<DateRange | undefined>();

  // ── Step 3: Units ─────────────────────────────────────────────────────────
  const [units,         setUnits]         = useState<UnitOption[]>([]);
  const [unitsLoading,  setUnitsLoading]  = useState(false);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]); // unitIds
  const [unitTypeFilter, setUnitTypeFilter] = useState("ALL");
  const [customRates,   setCustomRates]   = useState<Record<string, string>>({}); // unitId → rate/night or rate/month
  const [customTotals,  setCustomTotals]  = useState<Record<string, string>>({}); // unitId → total amount for period

  // ── Step 4: Details ───────────────────────────────────────────────────────
  const [discount,  setDiscount]  = useState("");
  const [source,    setSource]    = useState("walk_in");
  const [notes,     setNotes]     = useState("");

  // ── Step 5: Submit ────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);

  // ── Derived values ────────────────────────────────────────────────────────

  const nights = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return calculateNights(parseLocalDate(startDate), parseLocalDate(endDate));
  }, [startDate, endDate]);

  const calMonths = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return countCalendarMonths(parseLocalDate(startDate), parseLocalDate(endDate));
  }, [startDate, endDate]);

  const currentPeriod = rateType === "daily" ? nights : calMonths;

  // Selected unit objects (with custom subtotals applied)
  const selectedUnitObjects = useMemo(() => {
    return selectedUnits.map((id) => {
      const unit = units.find((u) => u.id === id)!;
      if (!unit) return null;

      const periodCount = rateType === "daily" ? nights : calMonths;

      // Custom total takes priority over custom rate
      const totalStr  = customTotals[id] ?? "";
      const totalVal  = parseFloat(totalStr);
      const hasTotal  = totalStr !== "" && !isNaN(totalVal) && totalVal > 0;

      const rateStr   = customRates[id] ?? "";
      const rateVal   = parseFloat(rateStr);
      const hasRate   = rateStr !== "" && !isNaN(rateVal) && rateVal > 0;

      if (hasTotal) {
        // Total entered — derive rate per night/month
        const derivedRate = periodCount > 0 ? roundOMR(totalVal / periodCount) : 0;
        return { unit, subtotal: roundOMR(totalVal), customRate: derivedRate, isCustom: true };
      }
      if (hasRate) {
        return { unit, subtotal: roundOMR(rateVal * periodCount), customRate: rateVal, isCustom: true };
      }
      return { unit, subtotal: unit.subtotal ?? 0, customRate: null, isCustom: false };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  }, [selectedUnits, units, customRates, customTotals, rateType, nights, calMonths]);

  const grandTotal = useMemo(() => {
    const disc = parseFloat(discount) || 0;
    return calculateGrandTotal(selectedUnitObjects.map((u) => u.subtotal), disc);
  }, [selectedUnitObjects, discount]);

  const availableUnitTypes = useMemo(() => {
    const types = [...new Set(units.map((u) => u.unitType))];
    return types;
  }, [units]);

  const filteredUnits = useMemo(() => {
    if (unitTypeFilter === "ALL") return units;
    return units.filter((u) => u.unitType === unitTypeFilter);
  }, [units, unitTypeFilter]);

  // ── Outside click for dropdown ────────────────────────────────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setShowDropdown(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Tenant search (debounced) ─────────────────────────────────────────────
  useEffect(() => {
    if (!tenantQuery.trim()) { setTenantResults([]); return; }
    const t = setTimeout(async () => {
      setTenantLoading(true);
      try {
        const res  = await fetch(`/api/tenants?q=${encodeURIComponent(tenantQuery)}`);
        const data = await res.json();
        setTenantResults(data.tenants ?? []);
        setShowDropdown(true);
      } finally {
        setTenantLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [tenantQuery]);

  // ── Sync calendar range → text inputs ────────────────────────────────────
  useEffect(() => {
    if (calRange?.from) {
      const newStart = toDateInput(calRange.from);
      setStartDate(newStart);
      if (calRange.to) {
        if (rateType === "monthly") {
          // Snap to complete months from the new start
          const m = countCalendarMonths(calRange.from, calRange.to);
          const snapped = addCalendarMonths(calRange.from, Math.max(1, m));
          setEndDate(toDateInput(snapped));
          setPeriod(Math.max(1, m));
        } else {
          setEndDate(toDateInput(calRange.to));
          setPeriod(calculateNights(calRange.from, calRange.to));
        }
      }
    }
  }, [calRange, rateType]);

  // ── Period change handler ─────────────────────────────────────────────────
  function handlePeriodChange(val: number) {
    if (val <= 0 || !startDate) { setPeriod(val); return; }
    setPeriod(val);
    const start = parseLocalDate(startDate);
    if (rateType === "daily") {
      const end = new Date(start);
      end.setDate(end.getDate() + val);
      setEndDate(toDateInput(end));
    } else {
      setEndDate(toDateInput(addCalendarMonths(start, val)));
    }
  }

  // ── Start date change ─────────────────────────────────────────────────────
  function handleStartDateChange(val: string) {
    setStartDate(val);
    if (!val || period <= 0) return;
    const start = parseLocalDate(val);
    if (rateType === "daily") {
      const end = new Date(start);
      end.setDate(end.getDate() + period);
      setEndDate(toDateInput(end));
    } else {
      setEndDate(toDateInput(addCalendarMonths(start, period)));
    }
  }

  // ── End date change (daily only — monthly is locked) ─────────────────────
  function handleEndDateChange(val: string) {
    if (rateType === "monthly") return; // monthly end is computed-only
    setEndDate(val);
    if (startDate && val) {
      const n = calculateNights(parseLocalDate(startDate), parseLocalDate(val));
      if (n > 0) setPeriod(n);
    }
  }

  // ── Rate type change ──────────────────────────────────────────────────────
  function handleRateTypeChange(rt: "daily" | "monthly") {
    setRateType(rt);
    setSelectedUnits([]);
    setCustomRates({});
    // Re-snap period + endDate to new mode
    if (startDate && period > 0) {
      const start = parseLocalDate(startDate);
      if (rt === "monthly") {
        // Default to 1 month if current period is small (< 30 days)
        const m = Math.max(1, rateType === "daily" ? Math.floor(period / 30) : period);
        setPeriod(m);
        setEndDate(toDateInput(addCalendarMonths(start, m)));
      } else {
        // Keep same endDate if set, recalc period
        if (endDate) {
          const n = calculateNights(start, parseLocalDate(endDate));
          setPeriod(n > 0 ? n : 1);
        } else {
          const end = new Date(start);
          end.setDate(end.getDate() + period);
          setEndDate(toDateInput(end));
        }
      }
    }
  }

  // ── Fetch units ───────────────────────────────────────────────────────────
  const fetchUnits = useCallback(async () => {
    if (!propertyId || !startDate || !endDate) return;
    setUnitsLoading(true);
    setSelectedUnits([]);
    setCustomRates({});
    setCustomTotals({});
    try {
      const url  = `/api/units/availability?propertyId=${propertyId}&startDate=${startDate}&endDate=${endDate}&rateType=${rateType}`;
      const res  = await fetch(url);
      const data = await res.json();
      setUnits(data.units ?? []);
      setUnitTypeFilter("ALL");
    } catch {
      toast.error("Failed to load units.");
    } finally {
      setUnitsLoading(false);
    }
  }, [propertyId, startDate, endDate, rateType]);

  // ── Toggle unit selection ─────────────────────────────────────────────────
  function toggleUnit(unitId: string) {
    setSelectedUnits((prev) =>
      prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId],
    );
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function canAdvance() {
    if (step === 1) return !!selectedTenant;
    if (step === 2) return !!propertyId && !!startDate && !!endDate && currentPeriod > 0;
    if (step === 3) return selectedUnits.length > 0;
    if (step === 4) return true;
    return false;
  }

  async function advance() {
    if (!canAdvance()) return;
    if (step === 2) await fetchUnits();
    setStep((s) => s + 1);
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!selectedTenant || !startDate || !endDate || selectedUnits.length === 0) return;
    setSubmitting(true);
    try {
      const unitOverrides = selectedUnits
        .filter((id) => {
          const v = parseFloat(customRates[id] ?? "");
          return !isNaN(v) && v > 0;
        })
        .map((id) => ({ unitId: id, rateAmount: parseFloat(customRates[id]) }));

      const res = await fetch("/api/reservations", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId:       selectedTenant.id,
          unitIds:        selectedUnits,
          startDate,
          endDate,
          rateType,
          source,
          notes:          notes || null,
          discountAmount: parseFloat(discount) || 0,
          unitOverrides,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to create reservation."); return; }
      toast.success("Reservation created!");
      router.push(`/dashboard/reservations/${data.reservation.id}`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <nav className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const done    = step > s.id;
          const current = step === s.id;
          const Icon    = s.icon;
          return (
            <div key={s.id} className="flex items-center">
              <button
                disabled={s.id > step}
                onClick={() => s.id < step && setStep(s.id)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                  current ? "text-blue-600" :
                  done    ? "text-green-600 hover:bg-gray-100 cursor-pointer" :
                            "text-gray-400 cursor-default"
                }`}
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
                  current ? "border-blue-600 bg-blue-50" :
                  done    ? "border-green-500 bg-green-50" :
                            "border-gray-200 bg-white"
                }`}>
                  {done
                    ? <CheckCircleSolid className="h-5 w-5 text-green-500" />
                    : <Icon className={`h-4 w-4 ${current ? "text-blue-600" : "text-gray-400"}`} />
                  }
                </div>
                <span className="hidden sm:block text-xs font-medium">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRightIcon className="h-4 w-4 text-gray-300 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </nav>

      {/* ── STEP 1: Tenant ─────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Select Tenant / Guest</h2>
            <button
              onClick={() => setShowAddTenant((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors ${
                showAddTenant
                  ? "bg-gray-900 border-gray-900 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <PlusIcon className="h-3.5 w-3.5" />
              {showAddTenant ? "Cancel" : "Add Tenant"}
            </button>
          </div>

          {/* Quick Add Tenant inline */}
          {showAddTenant && (
            <div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-4">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-3">
                New Tenant — will be auto-selected after saving
              </p>
              <TenantForm
                onSuccess={(tenant) => {
                  setSelectedTenant({
                    id:             tenant.id,
                    firstName:      tenant.firstName,
                    lastName:       tenant.lastName,
                    phone:          "",
                    email:          null,
                    classification: "regular",
                    nationality:    null,
                  });
                  setShowAddTenant(false);
                }}
              />
            </div>
          )}

          {!showAddTenant && (
            <>
              {/* Search */}
              <div className="relative" ref={dropdownRef}>
                <div className="relative">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    className="block w-full rounded-lg border-0 py-2.5 pl-9 pr-9 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 sm:text-sm"
                    placeholder="Search by name, phone, ID…"
                    value={selectedTenant ? `${selectedTenant.firstName} ${selectedTenant.lastName}` : tenantQuery}
                    onChange={(e) => {
                      if (selectedTenant) setSelectedTenant(null);
                      setTenantQuery(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => { if (tenantResults.length) setShowDropdown(true); }}
                  />
                  {selectedTenant && (
                    <button
                      onClick={() => { setSelectedTenant(null); setTenantQuery(""); }}
                      className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {showDropdown && !selectedTenant && (
                  <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-64 overflow-y-auto">
                    {tenantLoading && <div className="px-4 py-3 text-sm text-gray-500">Searching…</div>}
                    {!tenantLoading && tenantResults.length === 0 && tenantQuery && (
                      <div className="px-4 py-3 text-sm text-gray-500">
                        No tenants found.{" "}
                        <button className="text-blue-600 hover:underline" onClick={() => setShowAddTenant(true)}>
                          Create one?
                        </button>
                      </div>
                    )}
                    {tenantResults.map((t) => (
                      <button
                        key={t.id}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50"
                        onClick={() => { setSelectedTenant(t); setShowDropdown(false); setTenantQuery(""); }}
                      >
                        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          t.classification === "vip" ? "bg-yellow-100 text-yellow-800" :
                          t.classification === "blacklisted" ? "bg-red-100 text-red-700" :
                          "bg-blue-100 text-blue-700"
                        }`}>
                          {t.firstName[0]}{t.lastName[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-gray-900">{t.firstName} {t.lastName}</span>
                            <ClassBadge c={t.classification} />
                          </div>
                          <div className="text-xs text-gray-500">{t.phone}{t.nationality ? ` · ${t.nationality}` : ""}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected tenant card */}
              {selectedTenant && (
                <div className={`flex items-center gap-4 rounded-xl p-4 border-2 ${
                  selectedTenant.classification === "blacklisted" ? "border-red-200 bg-red-50" :
                  selectedTenant.classification === "vip" ? "border-yellow-200 bg-yellow-50" :
                  "border-green-200 bg-green-50"
                }`}>
                  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-lg font-bold ${
                    selectedTenant.classification === "vip" ? "bg-yellow-200 text-yellow-900" :
                    selectedTenant.classification === "blacklisted" ? "bg-red-200 text-red-900" :
                    "bg-green-200 text-green-900"
                  }`}>
                    {selectedTenant.firstName[0]}{selectedTenant.lastName[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{selectedTenant.firstName} {selectedTenant.lastName}</span>
                      <ClassBadge c={selectedTenant.classification} />
                    </div>
                    {selectedTenant.phone && <div className="text-sm text-gray-600">{selectedTenant.phone}</div>}
                    {selectedTenant.nationality && <div className="text-xs text-gray-500">{selectedTenant.nationality}</div>}
                  </div>
                  <CheckCircleSolid className="h-6 w-6 text-green-500 flex-shrink-0" />
                </div>
              )}

              {selectedTenant?.classification === "blacklisted" && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium">
                  ⚠ This tenant is blacklisted. Please review before proceeding.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── STEP 2: Dates ──────────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">Dates & Property</h2>

          {/* Property */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
            <select
              className="block w-full rounded-lg border-0 py-2.5 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
            >
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Rate type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Billing Mode</label>
            <div className="flex gap-2">
              {(["daily", "monthly"] as const).map((rt) => (
                <button
                  key={rt}
                  onClick={() => handleRateTypeChange(rt)}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-medium border transition-colors ${
                    rateType === rt
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {rt === "daily" ? "Daily / Nightly" : "Monthly (Calendar)"}
                </button>
              ))}
            </div>
            {rateType === "monthly" && (
              <p className="mt-1.5 text-xs text-gray-500">
                ℹ Calendar month standard — 1 month = same date next month (e.g. Mar 15 → Apr 15).
                Rate is flat regardless of days in the month. Industry standard (Marriott, IHG, Opera PMS).
              </p>
            )}
          </div>

          {/* Date + Period inputs */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Check-In & Duration</span>
            {rateType === "daily" && (
              <button
                onClick={() => setCalMode((v) => !v)}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {calMode ? "Use inputs" : "Open calendar"}
              </button>
            )}
          </div>

          {!calMode || rateType === "monthly" ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Check-In */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Check-In Date</label>
                <input
                  type="date"
                  className="block w-full rounded-lg border-0 py-2.5 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                />
              </div>

              {/* Period */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {rateType === "daily" ? "Number of Nights" : "Number of Months"}
                </label>
                <div className="flex">
                  <button
                    onClick={() => handlePeriodChange(Math.max(1, period - 1))}
                    className="flex items-center justify-center w-9 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100 text-sm font-bold"
                  >−</button>
                  <input
                    type="number"
                    min={1}
                    max={rateType === "daily" ? 730 : 24}
                    className="block flex-1 min-w-0 border-y border-gray-300 py-2.5 text-center focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                    value={period}
                    onChange={(e) => handlePeriodChange(parseInt(e.target.value) || 1)}
                  />
                  <button
                    onClick={() => handlePeriodChange(period + 1)}
                    className="flex items-center justify-center w-9 rounded-r-lg border border-l-0 border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100 text-sm font-bold"
                  >+</button>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5 text-center">
                  {rateType === "monthly" ? "Calendar months only" : "nights"}
                </p>
              </div>

              {/* Check-Out */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Check-Out Date</label>
                {rateType === "monthly" ? (
                  <div className="block w-full rounded-lg border-0 py-2.5 px-3 ring-1 ring-inset ring-gray-200 bg-gray-50 sm:text-sm text-gray-700 font-medium">
                    {endDate || <span className="text-gray-400">Auto-computed</span>}
                    <div className="text-[10px] text-gray-400 font-normal">Locked — based on check-in + months</div>
                  </div>
                ) : (
                  <input
                    type="date"
                    min={startDate}
                    className="block w-full rounded-lg border-0 py-2.5 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm"
                    value={endDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                  />
                )}
              </div>
            </div>
          ) : (
            /* Calendar range picker (daily mode only) */
            <div className="flex justify-center">
              <DayPicker
                mode="range"
                selected={calRange}
                onSelect={setCalRange}
                disabled={{ before: new Date() }}
                numberOfMonths={2}
                className="border border-gray-200 rounded-xl p-4"
              />
            </div>
          )}

          {/* Duration summary chip */}
          {currentPeriod > 0 && startDate && endDate && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-700 flex items-center justify-between">
              <span className="font-semibold">
                {rateType === "daily"
                  ? `${currentPeriod} night${currentPeriod !== 1 ? "s" : ""}`
                  : `${currentPeriod} calendar month${currentPeriod !== 1 ? "s" : ""}`}
              </span>
              <span className="text-blue-500 text-xs">{startDate} → {endDate}</span>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Units ──────────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Select Units</h2>
            {selectedUnits.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                {selectedUnits.length} selected
              </span>
            )}
          </div>

          {/* Unit type filter */}
          {availableUnitTypes.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {["ALL", ...availableUnitTypes].map((type) => (
                <button
                  key={type}
                  onClick={() => setUnitTypeFilter(type)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    unitTypeFilter === type
                      ? "bg-gray-900 border-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {type === "ALL" ? "All Types" : (UNIT_TYPE_LABELS[type] ?? type)}
                </button>
              ))}
            </div>
          )}

          {unitsLoading && (
            <div className="text-center py-8 text-gray-500 text-sm">Loading availability…</div>
          )}
          {!unitsLoading && filteredUnits.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">No units found for this property.</div>
          )}

          {!unitsLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUnits.map((unit) => {
                const isSelected = selectedUnits.includes(unit.id);
                const canSelect  = unit.available;
                const rateStr  = customRates[unit.id] ?? "";
                const rateVal  = parseFloat(rateStr);
                const hasRate  = rateStr !== "" && !isNaN(rateVal) && rateVal > 0;
                const totalStr = customTotals[unit.id] ?? "";
                const totalVal = parseFloat(totalStr);
                const hasTotal = totalStr !== "" && !isNaN(totalVal) && totalVal > 0;
                const hasCustom = hasRate || hasTotal;
                const periodCount = rateType === "daily" ? nights : calMonths;
                const displaySubtotal = hasTotal
                  ? roundOMR(totalVal)
                  : hasRate
                  ? roundOMR(rateVal * periodCount)
                  : unit.subtotal;
                const displayRate = hasTotal && periodCount > 0
                  ? roundOMR(totalVal / periodCount)
                  : hasRate ? rateVal : unit.rateAmount;

                return (
                  <div key={unit.id} className={`rounded-xl border-2 transition-all ${
                    !canSelect   ? "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed" :
                    isSelected   ? "border-blue-600 bg-blue-50 shadow-sm" :
                                   "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm cursor-pointer"
                  }`}>
                    {/* Card header — click to select */}
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => canSelect && toggleUnit(unit.id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          !unit.available ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                        }`}>
                          {unit.available ? "Available" : "Occupied"}
                        </div>
                        {isSelected && <CheckCircleSolid className="h-5 w-5 text-blue-600 flex-shrink-0" />}
                      </div>

                      <h3 className="font-semibold text-gray-900">{unit.name}</h3>
                      <p className="text-xs text-gray-500">
                        {UNIT_TYPE_LABELS[unit.unitType] ?? unit.unitType}
                        {unit.floor > 0 ? ` · Floor ${unit.floor}` : ""}
                        {" · "}{unit.bedrooms}bd / {unit.bathrooms}ba
                        {unit.area ? ` · ${unit.area} m²` : ""}
                      </p>

                      {unit.available && (
                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-end justify-between">
                          <div>
                            <span className={`text-xs ${hasCustom ? "line-through text-gray-400" : "text-gray-500"}`}>
                              {rateType === "daily"
                                ? `${fmtOMR(unit.rateAmount)} / night`
                                : `${fmtOMR(unit.rateAmount)} / month`}
                            </span>
                            {unit.priceName && !hasCustom && (
                              <div className="text-[10px] text-yellow-700 font-medium">🌟 {unit.priceName}</div>
                            )}
                            {hasCustom && (
                              <div className="text-[10px] text-purple-700 font-medium">
                                ✏ {fmtOMR(displayRate)} / {rateType === "daily" ? "night" : "month"} (custom)
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-base font-bold text-gray-900">{fmtOMR(displaySubtotal)}</div>
                            <div className="text-[10px] text-gray-400">OMR total</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Custom price inputs — shown when unit is selected */}
                    {isSelected && unit.available && (
                      <div className="px-4 pb-4 pt-2 border-t border-blue-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-xs font-medium text-purple-700">
                            <PencilSquareIcon className="h-3.5 w-3.5" />
                            Custom price (optional)
                          </span>
                          {hasCustom && (
                            <button
                              onClick={() => {
                                setCustomRates((p) => { const n = { ...p }; delete n[unit.id]; return n; });
                                setCustomTotals((p) => { const n = { ...p }; delete n[unit.id]; return n; });
                              }}
                              className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-0.5"
                            >
                              <XMarkIcon className="h-3 w-3" /> Reset
                            </button>
                          )}
                        </div>

                        {/* Rate per night/month */}
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">
                            Rate per {rateType === "daily" ? "night" : "month"} (OMR)
                          </label>
                          <input
                            type="number" min={0} step="0.001"
                            className={`block w-full rounded-lg border-0 py-1.5 px-2.5 text-sm ring-1 ring-inset focus:ring-2 focus:ring-purple-500 ${
                              hasTotal ? "bg-gray-50 ring-gray-200 text-gray-400" : "ring-purple-300"
                            }`}
                            placeholder={hasTotal
                              ? `≈ ${fmtOMR(displayRate)} (from total)`
                              : `Default: ${fmtOMR(unit.rateAmount)}`}
                            value={hasTotal ? "" : rateStr}
                            disabled={hasTotal}
                            onChange={(e) => {
                              setCustomRates((p) => ({ ...p, [unit.id]: e.target.value }));
                              setCustomTotals((p) => { const n = { ...p }; delete n[unit.id]; return n; });
                            }}
                          />
                        </div>

                        {/* OR divider */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 border-t border-gray-200" />
                          <span className="text-[10px] font-medium text-gray-400">OR</span>
                          <div className="flex-1 border-t border-gray-200" />
                        </div>

                        {/* Total amount for the full period */}
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">
                            Total for full period ({periodCount} {rateType === "daily" ? "nights" : "months"}) (OMR)
                          </label>
                          <input
                            type="number" min={0} step="0.001"
                            className={`block w-full rounded-lg border-0 py-1.5 px-2.5 text-sm ring-1 ring-inset focus:ring-2 focus:ring-purple-500 ${
                              hasRate ? "bg-gray-50 ring-gray-200 text-gray-400" : "ring-purple-300"
                            }`}
                            placeholder={hasRate
                              ? `≈ ${fmtOMR(displaySubtotal)} (from rate)`
                              : `Default: ${fmtOMR(unit.subtotal)}`}
                            value={hasRate ? "" : totalStr}
                            disabled={hasRate}
                            onChange={(e) => {
                              setCustomTotals((p) => ({ ...p, [unit.id]: e.target.value }));
                              setCustomRates((p) => { const n = { ...p }; delete n[unit.id]; return n; });
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 4: Pricing Summary ─────────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-4">
          {selectedUnitObjects.map(({ unit, subtotal, customRate }) => {
            type BreakdownRow = { label: string; nights: number; rate: number; subtotal: number; priceName: string | null; isCustom: boolean };
            const breakdownRows: BreakdownRow[] = rateType === "daily"
              ? (() => {
                  if (customRate != null) {
                    return [{ label: `${startDate} → ${endDate}`, nights, rate: customRate, subtotal: roundOMR(customRate * nights), priceName: null, isCustom: true }];
                  }
                  const segs = unit.breakdown as ReturnType<typeof collapseToSegments>;
                  return segs.map((s) => ({ label: `${s.startDate} → ${s.endDate}`, nights: s.nights, rate: s.ratePerNight, subtotal: s.subtotal, priceName: s.priceName, isCustom: false }));
                })()
              : (() => {
                  const rate = customRate ?? unit.rateAmount;
                  const segs = buildCalendarMonthBreakdown(
                    parseLocalDate(startDate), calMonths, rate, customRate ? null : unit.priceName, "DEFAULT",
                  );
                  return segs.map((s) => ({ label: s.label, nights: s.nights, rate, subtotal: s.subtotal, priceName: s.priceName, isCustom: customRate != null }));
                })();

            return (
              <div key={unit.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{unit.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    {customRate != null && (
                      <span className="text-xs font-medium bg-purple-100 text-purple-700 rounded-full px-2 py-0.5">Custom rate</span>
                    )}
                    <span>
                      {rateType === "daily"
                        ? `${fmtOMR(customRate ?? unit.rateAmount)} / night`
                        : `${fmtOMR(customRate ?? unit.rateAmount)} / month`}
                    </span>
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs font-medium text-gray-400 uppercase">
                      <th className="text-left pb-1">Period</th>
                      <th className="text-right pb-1">{rateType === "daily" ? "Nights" : "Months"}</th>
                      <th className="text-right pb-1">Rate</th>
                      <th className="text-right pb-1">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {breakdownRows.map((row, i) => (
                      <tr key={i} className="text-gray-700">
                        <td className="py-1.5">
                          <div className="text-xs">{row.label}</div>
                          {row.priceName && !row.isCustom && (
                            <div className="text-[10px] text-yellow-700">🌟 {row.priceName}</div>
                          )}
                          {row.isCustom && (
                            <div className="text-[10px] text-purple-700">✏ Custom rate</div>
                          )}
                        </td>
                        <td className="text-right py-1.5 text-xs">
                          {rateType === "daily" ? row.nights : 1}
                        </td>
                        <td className="text-right py-1.5 text-xs">{fmtOMR(row.rate)}</td>
                        <td className="text-right py-1.5 font-medium">{fmtOMR(row.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 font-semibold text-gray-900">
                      <td colSpan={3} className="pt-2 text-xs uppercase text-gray-500">Unit Total</td>
                      <td className="pt-2 text-right">{fmtOMR(subtotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}

          {/* Booking details */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-gray-900">Booking Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount (OMR)</label>
                <input
                  type="number" min="0" step="0.001"
                  className="block w-full rounded-lg border-0 py-2.5 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm"
                  placeholder="0.000"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                <select
                  className="block w-full rounded-lg border-0 py-2.5 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  <option value="walk_in">Walk-In</option>
                  <option value="referral">Referral</option>
                  <option value="online">Online</option>
                  <option value="agent">Agent</option>
                  <option value="returning">Returning Guest</option>
                  <option value="corporate_contract">Corporate Contract</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                rows={2}
                className="block w-full rounded-lg border-0 py-2.5 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm resize-none"
                placeholder="Special requests, internal notes…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Grand total */}
          <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-5">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-700">
                <span>Subtotal</span>
                <span>{fmtOMR(grandTotal.totalAmount)} OMR</span>
              </div>
              {grandTotal.discountAmount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Discount</span>
                  <span>− {fmtOMR(grandTotal.discountAmount)} OMR</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-blue-200">
                <span>Grand Total</span>
                <span>{fmtOMR(grandTotal.grandTotal)} OMR</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 5: Confirm ────────────────────────────────────────────────── */}
      {step === 5 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">Confirm Booking</h2>

          {selectedTenant && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <UserIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
              <div>
                <div className="font-medium text-gray-900">{selectedTenant.firstName} {selectedTenant.lastName}</div>
                {selectedTenant.phone && <div className="text-sm text-gray-500">{selectedTenant.phone}</div>}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
            <CalendarIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <div>
              <div className="font-medium text-gray-900">{startDate} → {endDate}</div>
              <div className="text-sm text-gray-500 capitalize">
                {rateType === "daily"
                  ? `${nights} night${nights !== 1 ? "s" : ""}`
                  : `${calMonths} calendar month${calMonths !== 1 ? "s" : ""}`}
                {" "}· {rateType === "daily" ? "Daily" : "Monthly"} rate
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <HomeIcon className="h-5 w-5 text-gray-400" />
              <span className="font-medium text-gray-900">{selectedUnitObjects.length} Unit{selectedUnitObjects.length !== 1 ? "s" : ""}</span>
            </div>
            {selectedUnitObjects.map(({ unit, subtotal, customRate }) => (
              <div key={unit.id} className="flex justify-between text-sm text-gray-700">
                <span>
                  {unit.name}
                  <span className="text-gray-400 ml-1">({UNIT_TYPE_LABELS[unit.unitType] ?? unit.unitType})</span>
                  {customRate != null && <span className="ml-1 text-xs text-purple-600">[custom rate]</span>}
                </span>
                <span className="font-medium">{fmtOMR(subtotal)} OMR</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <CurrencyDollarIcon className="h-5 w-5 text-blue-500 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-bold text-gray-900 text-lg">{fmtOMR(grandTotal.grandTotal)} OMR</div>
              {grandTotal.discountAmount > 0 && (
                <div className="text-xs text-gray-500">After {fmtOMR(grandTotal.discountAmount)} OMR discount</div>
              )}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Confirm & Create Reservation"}
            {!submitting && <CheckCircleIcon className="h-5 w-5" />}
          </button>
        </div>
      )}

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 1}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Back
        </button>

        {step < 5 && (
          <button
            onClick={advance}
            disabled={!canAdvance()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {step === 4 ? "Review & Confirm" : "Next"}
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
