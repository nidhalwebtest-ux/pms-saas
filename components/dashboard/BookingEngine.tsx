"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { DayPicker, DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar as arLocale, enUS as enLocale, type Locale } from "date-fns/locale";
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
  roundOMR,
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

interface UnitConflict {
  reservationNumber: string | null;
  guestName: string;
  startDate: string;
  endDate: string;
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
  conflict:   UnitConflict | null;
  nights:     number;
  rateType:   string;
  rateAmount: number;
  rateSource: string;
  priceName:  string | null;
  subtotal:   number;
  breakdown:  object[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STEP_DEFS = [
  { id: 1, key: "tenant",  icon: UserIcon },
  { id: 2, key: "dates",   icon: CalendarIcon },
  { id: 3, key: "units",   icon: HomeIcon },
  { id: 4, key: "summary", icon: CurrencyDollarIcon },
  { id: 5, key: "confirm", icon: CheckCircleIcon },
] as const;

const SOURCE_KEYS = [
  "walk_in",
  "referral",
  "online",
  "agent",
  "returning",
  "corporate_contract",
] as const;

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

function ClassBadge({ c, t }: { c: string | null; t: (k: string) => string }) {
  if (c === "vip")
    return <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-full px-1.5 py-0.5"><StarIcon className="h-2.5 w-2.5" />{t("vipBadge")}</span>;
  if (c === "blacklisted")
    return <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5"><NoSymbolIcon className="h-2.5 w-2.5" />{t("blacklistedBadge")}</span>;
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BookingEngine({
  properties,
  defaultTenant,
  defaultPropertyId,
  defaultUnitId,
}: {
  properties: PropertyOption[];
  defaultTenant?: TenantResult | null;
  defaultPropertyId?: string;
  defaultUnitId?: string;
}) {
  const router = useRouter();
  const locale = useLocale();
  const dateFnsLocale: Locale = locale === "ar" ? arLocale : enLocale;

  const t          = useTranslations("reservations.bookingEngine");
  const tSteps     = useTranslations("reservations.bookingEngine.steps");
  const tStep1     = useTranslations("reservations.bookingEngine.step1");
  const tStep2     = useTranslations("reservations.bookingEngine.step2");
  const tStep3     = useTranslations("reservations.bookingEngine.step3");
  const tConflict  = useTranslations("reservations.bookingEngine.step3.conflict");
  const tStep4     = useTranslations("reservations.bookingEngine.step4");
  const tStep5     = useTranslations("reservations.bookingEngine.step5");
  const tSrc       = useTranslations("reservations.bookingEngine.sources");
  const tNav       = useTranslations("reservations.bookingEngine.nav");
  const tCommon    = useTranslations("common");
  const tUnitTypes = useTranslations("reservations.detail.unitTypes");

  const unitTypeLabel = (type: string) =>
    tUnitTypes.has(type) ? tUnitTypes(type) : type;

  const [step, setStep] = useState(1);

  // ── Step 1: Tenant ────────────────────────────────────────────────────────
  const [tenantQuery,    setTenantQuery]    = useState("");
  const [tenantResults,  setTenantResults]  = useState<TenantResult[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<TenantResult | null>(defaultTenant ?? null);
  const [tenantLoading,  setTenantLoading]  = useState(false);
  const [showDropdown,   setShowDropdown]   = useState(false);
  const [showAddTenant,  setShowAddTenant]  = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Step 2: Dates ─────────────────────────────────────────────────────────
  const [propertyId, setPropertyId] = useState(defaultPropertyId ?? properties[0]?.id ?? "");
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
  const [conflictError, setConflictError] = useState<{
    unitId: string; unitName: string;
    reservationNumber: string | null; guestName: string;
    startDate: string; endDate: string;
  } | null>(null);

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
    const timer = setTimeout(async () => {
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
    return () => clearTimeout(timer);
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
  // When the page is opened from a unit detail (?unitId=X), pre-select that
  // unit on the first availability fetch — but only if it actually came back
  // available for the chosen dates. Subsequent fetches behave normally.
  const defaultUnitConsumed = useRef(false);

  const fetchUnits = useCallback(async () => {
    if (!propertyId || !startDate || !endDate) return;
    setUnitsLoading(true);
    setSelectedUnits([]);
    setCustomRates({});
    setCustomTotals({});
    setConflictError(null);
    try {
      const url  = `/api/units/availability?propertyId=${propertyId}&startDate=${startDate}&endDate=${endDate}&rateType=${rateType}`;
      const res  = await fetch(url);
      const data = await res.json();
      const fetched: UnitOption[] = data.units ?? [];
      setUnits(fetched);
      setUnitTypeFilter("ALL");
      if (defaultUnitId && !defaultUnitConsumed.current) {
        defaultUnitConsumed.current = true;
        const match = fetched.find((u) => u.id === defaultUnitId && u.available);
        if (match) setSelectedUnits([match.id]);
      }
    } catch {
      toast.error(tStep3("loadFailed"));
    } finally {
      setUnitsLoading(false);
    }
  }, [propertyId, startDate, endDate, rateType, tStep3, defaultUnitId]);

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
      if (!res.ok) {
        if (res.status === 409 && data.error === "double_booking" && data.conflict) {
          setConflictError(data.conflict);
          setStep(3); // go back to unit selection step to show the conflict
        } else {
          toast.error(data.error ?? t("createFailed"));
        }
        return;
      }
      toast.success(t("createSuccess"));
      router.push(`/dashboard/reservations/${data.reservation.id}`);
    } catch {
      toast.error(t("networkError"));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <nav className="flex items-center gap-0">
        {STEP_DEFS.map((s, i) => {
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
                <span className="hidden sm:block text-xs font-medium">{tSteps(s.key)}</span>
              </button>
              {i < STEP_DEFS.length - 1 && (
                <ChevronRightIcon className="h-4 w-4 text-gray-300 flex-shrink-0 rtl:rotate-180" />
              )}
            </div>
          );
        })}
      </nav>

      {/* ── STEP 1: Tenant ─────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{tStep1("title")}</h2>
            <button
              onClick={() => setShowAddTenant((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors ${
                showAddTenant
                  ? "bg-gray-900 border-gray-900 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <PlusIcon className="h-3.5 w-3.5" />
              {showAddTenant ? tCommon("cancel") : tStep1("addTenant")}
            </button>
          </div>

          {/* Quick Add Tenant inline */}
          {showAddTenant && (
            <div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-4">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-3">
                {tStep1("newTenantHint")}
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
                  <MagnifyingGlassIcon className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    className="block w-full rounded-lg border-0 py-2.5 ps-9 pe-9 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 sm:text-sm"
                    placeholder={tStep1("searchPlaceholder")}
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
                      className="absolute end-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {showDropdown && !selectedTenant && (
                  <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-64 overflow-y-auto">
                    {tenantLoading && <div className="px-4 py-3 text-sm text-gray-500">{tStep1("searching")}</div>}
                    {!tenantLoading && tenantResults.length === 0 && tenantQuery && (
                      <div className="px-4 py-3 text-sm text-gray-500">
                        {tStep1("noTenantsFound")}{" "}
                        <button className="text-blue-600 hover:underline" onClick={() => setShowAddTenant(true)}>
                          {tStep1("createOne")}
                        </button>
                      </div>
                    )}
                    {tenantResults.map((tn) => (
                      <button
                        key={tn.id}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-gray-50"
                        onClick={() => { setSelectedTenant(tn); setShowDropdown(false); setTenantQuery(""); }}
                      >
                        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          tn.classification === "vip" ? "bg-yellow-100 text-yellow-800" :
                          tn.classification === "blacklisted" ? "bg-red-100 text-red-700" :
                          "bg-blue-100 text-blue-700"
                        }`}>
                          {tn.firstName[0]}{tn.lastName[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-gray-900">{tn.firstName} {tn.lastName}</span>
                            <ClassBadge c={tn.classification} t={tStep1} />
                          </div>
                          <div className="text-xs text-gray-500 ltr-numbers">{tn.phone}{tn.nationality ? ` · ${tn.nationality}` : ""}</div>
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
                      <ClassBadge c={selectedTenant.classification} t={tStep1} />
                    </div>
                    {selectedTenant.phone && <div className="text-sm text-gray-600 ltr-numbers">{selectedTenant.phone}</div>}
                    {selectedTenant.nationality && <div className="text-xs text-gray-500">{selectedTenant.nationality}</div>}
                  </div>
                  <CheckCircleSolid className="h-6 w-6 text-green-500 flex-shrink-0" />
                </div>
              )}

              {selectedTenant?.classification === "blacklisted" && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium">
                  {tStep1("blacklistedWarning")}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── STEP 2: Dates ──────────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">{tStep2("title")}</h2>

          {/* Property */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{tStep2("property")}</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">{tStep2("billingMode")}</label>
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
                  {rt === "daily" ? tStep2("dailyMode") : tStep2("monthlyMode")}
                </button>
              ))}
            </div>
            {rateType === "monthly" && (
              <p className="mt-1.5 text-xs text-gray-500">
                {tStep2("monthlyHint")}
              </p>
            )}
          </div>

          {/* Date + Period inputs */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">{tStep2("checkInAndDuration")}</span>
            {rateType === "daily" && (
              <button
                onClick={() => setCalMode((v) => !v)}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {calMode ? tStep2("useInputs") : tStep2("openCalendar")}
              </button>
            )}
          </div>

          {!calMode || rateType === "monthly" ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Check-In */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">{tStep2("checkInDate")}</label>
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
                  {rateType === "daily" ? tStep2("numberOfNights") : tStep2("numberOfMonths")}
                </label>
                <div className="flex">
                  <button
                    onClick={() => handlePeriodChange(Math.max(1, period - 1))}
                    className="flex items-center justify-center w-9 rounded-s-lg border border-e-0 border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100 text-sm font-bold"
                  >−</button>
                  <input
                    type="number"
                    min={1}
                    max={rateType === "daily" ? 730 : 24}
                    className="block flex-1 min-w-0 border-y border-gray-300 py-2.5 text-center focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm ltr-numbers"
                    value={period}
                    onChange={(e) => handlePeriodChange(parseInt(e.target.value) || 1)}
                  />
                  <button
                    onClick={() => handlePeriodChange(period + 1)}
                    className="flex items-center justify-center w-9 rounded-e-lg border border-s-0 border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100 text-sm font-bold"
                  >+</button>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5 text-center">
                  {rateType === "monthly" ? tStep2("calendarMonthsOnly") : tStep2("nightsHint")}
                </p>
              </div>

              {/* Check-Out */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">{tStep2("checkOutDate")}</label>
                {rateType === "monthly" ? (
                  <div className="block w-full rounded-lg border-0 py-2.5 px-3 ring-1 ring-inset ring-gray-200 bg-gray-50 sm:text-sm text-gray-700 font-medium">
                    {endDate
                      ? <span className="ltr-numbers">{endDate}</span>
                      : <span className="text-gray-400">{tStep2("autoComputed")}</span>}
                    <div className="text-[10px] text-gray-400 font-normal">{tStep2("lockedHint")}</div>
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
                locale={dateFnsLocale}
                className="border border-gray-200 rounded-xl p-4"
              />
            </div>
          )}

          {/* Duration summary chip */}
          {currentPeriod > 0 && startDate && endDate && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-700 flex items-center justify-between">
              <span className="font-semibold">
                {rateType === "daily"
                  ? tStep2("nightsSummary", { count: currentPeriod })
                  : tStep2("monthsSummary", { count: currentPeriod })}
              </span>
              <span className="text-blue-500 text-xs ltr-numbers">{startDate} → {endDate}</span>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Units ──────────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">

          {/* Double-booking conflict error panel */}
          {conflictError && (
            <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-red-600 flex items-center justify-center shrink-0">
                  <XMarkIcon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-red-800 text-sm">{tConflict("title")}</p>
                  <p
                    className="text-sm text-red-700 mt-0.5"
                    dangerouslySetInnerHTML={{ __html: tConflict("body", { unitName: conflictError.unitName }) }}
                  />
                  <div className="mt-2 bg-white border border-red-200 rounded-lg px-3 py-2 text-xs text-gray-700 space-y-0.5">
                    {conflictError.reservationNumber && (
                      <p>{tConflict("reservationLabel")} <span className="font-mono font-medium ltr-numbers">{conflictError.reservationNumber}</span></p>
                    )}
                    <p>{tConflict("guestLabel")} <span className="font-medium">{conflictError.guestName}</span></p>
                    <p>
                      {tConflict("datesLabel")}{" "}
                      <span className="font-medium ltr-numbers">
                        {format(new Date(conflictError.startDate), "d MMM yyyy", { locale: dateFnsLocale })}
                        {" → "}
                        {format(new Date(conflictError.endDate), "d MMM yyyy", { locale: dateFnsLocale })}
                      </span>
                    </p>
                  </div>
                  <p className="text-xs text-red-600 mt-2">{tConflict("hint")}</p>
                </div>
                <button
                  onClick={() => setConflictError(null)}
                  className="p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{tStep3("title")}</h2>
            {selectedUnits.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                {tStep3("selectedCount", { count: selectedUnits.length })}
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
                  {type === "ALL" ? tStep3("allTypes") : unitTypeLabel(type)}
                </button>
              ))}
            </div>
          )}

          {unitsLoading && (
            <div className="text-center py-8 text-gray-500 text-sm">{tStep3("loadingAvailability")}</div>
          )}
          {!unitsLoading && filteredUnits.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">{tStep3("noUnits")}</div>
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
                          {unit.available ? tStep3("available") : tStep3("occupied")}
                        </div>
                        {isSelected && <CheckCircleSolid className="h-5 w-5 text-blue-600 flex-shrink-0" />}
                      </div>

                      <h3 className="font-semibold text-gray-900">{unit.name}</h3>
                      <p className="text-xs text-gray-500">
                        {unitTypeLabel(unit.unitType)}
                        {unit.floor > 0 ? ` · ${tStep3("floorSuffix", { n: unit.floor })}` : ""}
                        {" · "}<span className="ltr-numbers">{tStep3("bedBath", { bd: unit.bedrooms, ba: unit.bathrooms })}</span>
                        {unit.area ? ` · ${tStep3("areaSuffix", { area: unit.area })}` : ""}
                      </p>

                      {unit.available && (
                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-end justify-between">
                          <div>
                            <span className={`text-xs ltr-numbers ${hasCustom ? "line-through text-gray-400" : "text-gray-500"}`}>
                              {rateType === "daily"
                                ? tStep3("perNight", { amount: fmtOMR(unit.rateAmount) })
                                : tStep3("perMonth", { amount: fmtOMR(unit.rateAmount) })}
                            </span>
                            {unit.priceName && !hasCustom && (
                              <div className="text-[10px] text-yellow-700 font-medium">🌟 {unit.priceName}</div>
                            )}
                            {hasCustom && (
                              <div className="text-[10px] text-purple-700 font-medium ltr-numbers">
                                {rateType === "daily"
                                  ? tStep3("customRateNight", { amount: fmtOMR(displayRate) })
                                  : tStep3("customRateMonth", { amount: fmtOMR(displayRate) })}
                              </div>
                            )}
                          </div>
                          <div className="text-end">
                            <div className="text-base font-bold text-gray-900 ltr-numbers">{fmtOMR(displaySubtotal)}</div>
                            <div className="text-[10px] text-gray-400">{tStep3("omrTotal")}</div>
                          </div>
                        </div>
                      )}

                      {!unit.available && unit.conflict && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="text-[10px] text-red-600 font-medium">
                            {unit.conflict.reservationNumber ? <span className="ltr-numbers">#{unit.conflict.reservationNumber} · </span> : ""}
                            {unit.conflict.guestName}
                          </p>
                          <p className="text-[10px] text-gray-400 ltr-numbers">
                            {format(new Date(unit.conflict.startDate), "d MMM", { locale: dateFnsLocale })}
                            {" → "}
                            {format(new Date(unit.conflict.endDate), "d MMM", { locale: dateFnsLocale })}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Custom price inputs — shown when unit is selected */}
                    {isSelected && unit.available && (
                      <div className="px-4 pb-4 pt-2 border-t border-blue-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-xs font-medium text-purple-700">
                            <PencilSquareIcon className="h-3.5 w-3.5" />
                            {tStep3("customPriceLabel")}
                          </span>
                          {hasCustom && (
                            <button
                              onClick={() => {
                                setCustomRates((p) => { const n = { ...p }; delete n[unit.id]; return n; });
                                setCustomTotals((p) => { const n = { ...p }; delete n[unit.id]; return n; });
                              }}
                              className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-0.5"
                            >
                              <XMarkIcon className="h-3 w-3" /> {tStep3("reset")}
                            </button>
                          )}
                        </div>

                        {/* Rate per night/month */}
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">
                            {rateType === "daily" ? tStep3("ratePerNight") : tStep3("ratePerMonth")}
                          </label>
                          <input
                            type="number" min={0} step="0.001"
                            className={`block w-full rounded-lg border-0 py-1.5 px-2.5 text-sm ring-1 ring-inset focus:ring-2 focus:ring-purple-500 ltr-numbers ${
                              hasTotal ? "bg-gray-50 ring-gray-200 text-gray-400" : "ring-purple-300"
                            }`}
                            placeholder={hasTotal
                              ? tStep3("ratePlaceholderFromTotal", { amount: fmtOMR(displayRate) })
                              : tStep3("ratePlaceholderDefault", { amount: fmtOMR(unit.rateAmount) })}
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
                          <span className="text-[10px] font-medium text-gray-400">{tStep3("or")}</span>
                          <div className="flex-1 border-t border-gray-200" />
                        </div>

                        {/* Total amount for the full period */}
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">
                            {rateType === "daily"
                              ? tStep3("totalForPeriodNights", { count: periodCount })
                              : tStep3("totalForPeriodMonths", { count: periodCount })}
                          </label>
                          <input
                            type="number" min={0} step="0.001"
                            className={`block w-full rounded-lg border-0 py-1.5 px-2.5 text-sm ring-1 ring-inset focus:ring-2 focus:ring-purple-500 ltr-numbers ${
                              hasRate ? "bg-gray-50 ring-gray-200 text-gray-400" : "ring-purple-300"
                            }`}
                            placeholder={hasRate
                              ? tStep3("totalPlaceholderFromRate", { amount: fmtOMR(displaySubtotal) })
                              : tStep3("totalPlaceholderDefault", { amount: fmtOMR(unit.subtotal) })}
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
                      <span className="text-xs font-medium bg-purple-100 text-purple-700 rounded-full px-2 py-0.5">{tStep4("customRateBadge")}</span>
                    )}
                    <span className="ltr-numbers">
                      {rateType === "daily"
                        ? tStep4("perNight", { amount: fmtOMR(customRate ?? unit.rateAmount) })
                        : tStep4("perMonth", { amount: fmtOMR(customRate ?? unit.rateAmount) })}
                    </span>
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs font-medium text-gray-400 uppercase">
                      <th className="text-start pb-1">{tStep4("periodCol")}</th>
                      <th className="text-end pb-1">{rateType === "daily" ? tStep4("nightsCol") : tStep4("monthsCol")}</th>
                      <th className="text-end pb-1">{tStep4("rateCol")}</th>
                      <th className="text-end pb-1">{tStep4("amountCol")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {breakdownRows.map((row, i) => (
                      <tr key={i} className="text-gray-700">
                        <td className="py-1.5">
                          <div className="text-xs ltr-numbers">{row.label}</div>
                          {row.priceName && !row.isCustom && (
                            <div className="text-[10px] text-yellow-700">🌟 {row.priceName}</div>
                          )}
                          {row.isCustom && (
                            <div className="text-[10px] text-purple-700">{tStep4("customRateRow")}</div>
                          )}
                        </td>
                        <td className="text-end py-1.5 text-xs ltr-numbers">
                          {rateType === "daily" ? row.nights : 1}
                        </td>
                        <td className="text-end py-1.5 text-xs ltr-numbers">{fmtOMR(row.rate)}</td>
                        <td className="text-end py-1.5 font-medium ltr-numbers">{fmtOMR(row.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 font-semibold text-gray-900">
                      <td colSpan={3} className="pt-2 text-xs uppercase text-gray-500">{tStep4("unitTotal")}</td>
                      <td className="pt-2 text-end ltr-numbers">{fmtOMR(subtotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}

          {/* Booking details */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-gray-900">{tStep4("bookingDetails")}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{tStep4("discount")}</label>
                <input
                  type="number" min="0" step="0.001"
                  className="block w-full rounded-lg border-0 py-2.5 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm ltr-numbers"
                  placeholder={tStep4("discountPlaceholder")}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{tStep4("source")}</label>
                <select
                  className="block w-full rounded-lg border-0 py-2.5 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  {SOURCE_KEYS.map((k) => (
                    <option key={k} value={k}>{tSrc(k)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tStep4("notes")}</label>
              <textarea
                rows={2}
                className="block w-full rounded-lg border-0 py-2.5 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm resize-none"
                placeholder={tStep4("notesPlaceholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Grand total */}
          <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-5">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-700">
                <span>{tStep4("subtotal")}</span>
                <span className="ltr-numbers">{fmtOMR(grandTotal.totalAmount)} {t("omr")}</span>
              </div>
              {grandTotal.discountAmount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>{tStep4("discountSummary")}</span>
                  <span className="ltr-numbers">− {fmtOMR(grandTotal.discountAmount)} {t("omr")}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-blue-200">
                <span>{tStep4("grandTotal")}</span>
                <span className="ltr-numbers">{fmtOMR(grandTotal.grandTotal)} {t("omr")}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 5: Confirm ────────────────────────────────────────────────── */}
      {step === 5 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">{tStep5("title")}</h2>

          {selectedTenant && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <UserIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
              <div>
                <div className="font-medium text-gray-900">{selectedTenant.firstName} {selectedTenant.lastName}</div>
                {selectedTenant.phone && <div className="text-sm text-gray-500 ltr-numbers">{selectedTenant.phone}</div>}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
            <CalendarIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <div>
              <div className="font-medium text-gray-900 ltr-numbers">{startDate} → {endDate}</div>
              <div className="text-sm text-gray-500">
                {rateType === "daily"
                  ? tStep5("rateLineDaily", { count: nights })
                  : tStep5("rateLineMonthly", { count: calMonths })}
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <HomeIcon className="h-5 w-5 text-gray-400" />
              <span className="font-medium text-gray-900">{tStep5("unitsCount", { count: selectedUnitObjects.length })}</span>
            </div>
            {selectedUnitObjects.map(({ unit, subtotal, customRate }) => (
              <div key={unit.id} className="flex justify-between text-sm text-gray-700">
                <span>
                  {unit.name}
                  <span className="text-gray-400 ms-1">({unitTypeLabel(unit.unitType)})</span>
                  {customRate != null && <span className="ms-1 text-xs text-purple-600">{tStep5("customRateInline")}</span>}
                </span>
                <span className="font-medium ltr-numbers">{fmtOMR(subtotal)} {t("omr")}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <CurrencyDollarIcon className="h-5 w-5 text-blue-500 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-bold text-gray-900 text-lg ltr-numbers">{fmtOMR(grandTotal.grandTotal)} {t("omr")}</div>
              {grandTotal.discountAmount > 0 && (
                <div className="text-xs text-gray-500">{tStep5("afterDiscount", { amount: fmtOMR(grandTotal.discountAmount) })}</div>
              )}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors disabled:opacity-60"
          >
            {submitting ? tStep5("submitting") : tStep5("submit")}
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
          <ChevronLeftIcon className="h-4 w-4 rtl:rotate-180" />
          {tNav("back")}
        </button>

        {step < 5 && (
          <button
            onClick={advance}
            disabled={!canAdvance()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {step === 4 ? tNav("reviewConfirm") : tNav("next")}
            <ChevronRightIcon className="h-4 w-4 rtl:rotate-180" />
          </button>
        )}
      </div>
    </div>
  );
}
