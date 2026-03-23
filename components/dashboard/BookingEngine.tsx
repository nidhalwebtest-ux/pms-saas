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
  TrashIcon,
  UserIcon,
  BuildingOfficeIcon,
  StarIcon,
  NoSymbolIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolid } from "@heroicons/react/24/solid";
import {
  calculateNights,
  calculateMonths,
  collapseToSegments,
  buildMonthlyBreakdown,
  calculateGrandTotal,
  formatDuration,
  roundOMR,
} from "@/lib/reservation-engine";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PropertyOption {
  id:   string;
  name: string;
}

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
  id:          string;
  name:        string;
  unitType:    string;
  floor:       number;
  bedrooms:    number;
  bathrooms:   number;
  area:        number | null;
  amenities:   string[];
  status:      string;
  available:   boolean;
  nights:      number;
  rateType:    string;
  rateAmount:  number;
  rateSource:  string;
  priceName:   string | null;
  subtotal:    number;
  breakdown:   object[];
}

interface SelectedUnit {
  unit:     UnitOption;
  subtotal: number;
}

// ── Small helpers ─────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Tenant",   icon: UserIcon },
  { id: 2, label: "Dates",    icon: CalendarIcon },
  { id: 3, label: "Units",    icon: HomeIcon },
  { id: 4, label: "Summary",  icon: CurrencyDollarIcon },
  { id: 5, label: "Confirm",  icon: CheckCircleIcon },
];

const UNIT_TYPE_LABELS: Record<string, string> = {
  STUDIO:   "Studio",
  ONE_BR:   "1 BR",
  TWO_BR:   "2 BR",
  THREE_BR: "3 BR",
  SUITE:    "Suite",
};

function ClassBadge({ classification }: { classification: string | null }) {
  if (classification === "vip")
    return <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-full px-1.5 py-0.5"><StarIcon className="h-2.5 w-2.5" />VIP</span>;
  if (classification === "blacklisted")
    return <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5"><NoSymbolIcon className="h-2.5 w-2.5" />Blacklisted</span>;
  return null;
}

function fmtOMR(v: number) {
  return v.toLocaleString("en-OM", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function BookingEngine({ properties }: { properties: PropertyOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1: Tenant
  const [tenantQuery,   setTenantQuery]   = useState("");
  const [tenantResults, setTenantResults] = useState<TenantResult[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<TenantResult | null>(null);
  const [tenantLoading, setTenantLoading]   = useState(false);
  const [showDropdown,  setShowDropdown]    = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Step 2: Dates
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [startDate,  setStartDate]  = useState("");
  const [endDate,    setEndDate]    = useState("");
  const [rateType,   setRateType]   = useState<"daily" | "monthly">("daily");
  const [calMode,    setCalMode]    = useState(false);
  const [calRange,   setCalRange]   = useState<DateRange | undefined>();

  // Step 3: Units
  const [units,        setUnits]        = useState<UnitOption[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [selectedUnits, setSelectedUnits] = useState<SelectedUnit[]>([]);

  // Step 4: Summary
  const [discount, setDiscount] = useState("");
  const [source,   setSource]   = useState("walk_in");
  const [notes,    setNotes]    = useState("");

  // Step 5: Submitting
  const [submitting, setSubmitting] = useState(false);

  // ── Close dropdown on outside click ────────────────────────────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setShowDropdown(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Tenant search (debounced 350 ms) ────────────────────────────────────────
  useEffect(() => {
    if (!tenantQuery.trim()) { setTenantResults([]); return; }
    const t = setTimeout(async () => {
      setTenantLoading(true);
      try {
        const res = await fetch(`/api/tenants?q=${encodeURIComponent(tenantQuery)}`);
        const data = await res.json();
        setTenantResults(data.tenants ?? []);
        setShowDropdown(true);
      } catch {
        // ignore
      } finally {
        setTenantLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [tenantQuery]);

  // ── Sync calendar range → text inputs ─────────────────────────────────────
  useEffect(() => {
    if (calRange?.from) setStartDate(toDateInput(calRange.from));
    if (calRange?.to)   setEndDate(toDateInput(calRange.to));
  }, [calRange]);

  // ── Step 3: fetch availability when we arrive ──────────────────────────────
  const fetchUnits = useCallback(async () => {
    if (!propertyId || !startDate || !endDate) return;
    setUnitsLoading(true);
    setSelectedUnits([]);
    try {
      const url = `/api/units/availability?propertyId=${propertyId}&startDate=${startDate}&endDate=${endDate}&rateType=${rateType}`;
      const res  = await fetch(url);
      const data = await res.json();
      setUnits(data.units ?? []);
    } catch {
      toast.error("Failed to load units.");
    } finally {
      setUnitsLoading(false);
    }
  }, [propertyId, startDate, endDate, rateType]);

  // ── Grand total ────────────────────────────────────────────────────────────
  const grandTotal = useMemo(() => {
    const disc = parseFloat(discount) || 0;
    return calculateGrandTotal(
      selectedUnits.map((u) => u.subtotal),
      disc,
    );
  }, [selectedUnits, discount]);

  // ── Nights / duration ─────────────────────────────────────────────────────
  const nights = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return calculateNights(parseLocalDate(startDate), parseLocalDate(endDate));
  }, [startDate, endDate]);

  // ── Validation per step ────────────────────────────────────────────────────
  function canAdvance() {
    if (step === 1) return !!selectedTenant;
    if (step === 2) return !!propertyId && !!startDate && !!endDate && nights > 0;
    if (step === 3) return selectedUnits.length > 0;
    if (step === 4) return true;
    return false;
  }

  async function advance() {
    if (!canAdvance()) return;
    if (step === 2) await fetchUnits();
    setStep((s) => s + 1);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!selectedTenant || !startDate || !endDate || selectedUnits.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/reservations", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId:       selectedTenant.id,
          unitIds:        selectedUnits.map((u) => u.unit.id),
          startDate,
          endDate,
          rateType,
          source,
          notes:          notes || null,
          discountAmount: parseFloat(discount) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create reservation.");
        return;
      }
      toast.success("Reservation created!");
      router.push(`/dashboard/reservations/${data.reservation.id}`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
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

      {/* ── Step 1: Tenant ─────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Select Tenant / Guest</h2>
          <div className="relative" ref={dropdownRef}>
            <div className="relative">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                className="block w-full rounded-lg border-0 py-2.5 pl-9 pr-4 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 sm:text-sm"
                placeholder="Search by name, phone, or ID…"
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

            {/* Dropdown */}
            {showDropdown && !selectedTenant && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-64 overflow-y-auto">
                {tenantLoading && (
                  <div className="px-4 py-3 text-sm text-gray-500">Searching…</div>
                )}
                {!tenantLoading && tenantResults.length === 0 && tenantQuery && (
                  <div className="px-4 py-3 text-sm text-gray-500">No tenants found.</div>
                )}
                {tenantResults.map((t) => (
                  <button
                    key={t.id}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50"
                    onClick={() => {
                      setSelectedTenant(t);
                      setShowDropdown(false);
                      setTenantQuery("");
                    }}
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
                        <ClassBadge classification={t.classification} />
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
              "border-blue-200 bg-blue-50"
            }`}>
              <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-lg font-bold ${
                selectedTenant.classification === "vip" ? "bg-yellow-200 text-yellow-900" :
                selectedTenant.classification === "blacklisted" ? "bg-red-200 text-red-900" :
                "bg-blue-200 text-blue-900"
              }`}>
                {selectedTenant.firstName[0]}{selectedTenant.lastName[0]}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{selectedTenant.firstName} {selectedTenant.lastName}</span>
                  <ClassBadge classification={selectedTenant.classification} />
                </div>
                <div className="text-sm text-gray-600">{selectedTenant.phone}</div>
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
        </div>
      )}

      {/* ── Step 2: Dates & Property ────────────────────────────────────────── */}
      {step === 2 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">Dates & Property</h2>

          {/* Property selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
            <select
              className="block w-full rounded-lg border-0 py-2.5 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Rate type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Billing Mode</label>
            <div className="flex gap-2">
              {(["daily", "monthly"] as const).map((rt) => (
                <button
                  key={rt}
                  onClick={() => setRateType(rt)}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-medium border transition-colors ${
                    rateType === rt
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {rt === "daily" ? "Daily / Nightly" : "Monthly"}
                </button>
              ))}
            </div>
          </div>

          {/* Date input mode toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Select Dates</span>
            <button
              onClick={() => setCalMode((v) => !v)}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {calMode ? "Use text inputs" : "Open calendar"}
            </button>
          </div>

          {!calMode ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Check-In</label>
                <input
                  type="date"
                  className="block w-full rounded-lg border-0 py-2.5 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Check-Out</label>
                <input
                  type="date"
                  className="block w-full rounded-lg border-0 py-2.5 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          ) : (
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

          {/* Duration summary */}
          {nights > 0 && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-700">
              <span className="font-semibold">
                {formatDuration(parseLocalDate(startDate), parseLocalDate(endDate), rateType)}
              </span>
              {" "}· {startDate} → {endDate}
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Unit Selection ──────────────────────────────────────────── */}
      {step === 3 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Select Units</h2>
            {selectedUnits.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                {selectedUnits.length} selected
              </span>
            )}
          </div>

          {unitsLoading && (
            <div className="text-center py-8 text-gray-500 text-sm">Loading availability…</div>
          )}

          {!unitsLoading && units.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">No units found for this property.</div>
          )}

          {!unitsLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {units.map((unit) => {
                const isSelected = selectedUnits.some((u) => u.unit.id === unit.id);
                const canSelect  = unit.available;
                return (
                  <div
                    key={unit.id}
                    onClick={() => {
                      if (!canSelect) return;
                      if (isSelected) {
                        setSelectedUnits((prev) => prev.filter((u) => u.unit.id !== unit.id));
                      } else {
                        setSelectedUnits((prev) => [...prev, { unit, subtotal: unit.subtotal }]);
                      }
                    }}
                    className={`relative rounded-xl border-2 p-4 transition-all cursor-pointer ${
                      !canSelect      ? "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed" :
                      isSelected      ? "border-blue-600 bg-blue-50 shadow-sm" :
                                        "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
                    }`}
                  >
                    {/* Status badge */}
                    <div className={`absolute top-3 right-3 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      !unit.available ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                    }`}>
                      {unit.available ? "Available" : "Occupied"}
                    </div>

                    {isSelected && (
                      <CheckCircleSolid className="absolute top-3 left-3 h-5 w-5 text-blue-600" />
                    )}

                    <div className="mt-4">
                      <h3 className="font-semibold text-gray-900">{unit.name}</h3>
                      <p className="text-xs text-gray-500">
                        {UNIT_TYPE_LABELS[unit.unitType] ?? unit.unitType}
                        {unit.floor > 0 ? ` · Floor ${unit.floor}` : ""}
                        {" · "}
                        {unit.bedrooms}bd / {unit.bathrooms}ba
                        {unit.area ? ` · ${unit.area} m²` : ""}
                      </p>
                    </div>

                    {unit.available && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-end justify-between">
                          <div>
                            <span className="text-xs text-gray-500">
                              {rateType === "daily"
                                ? `${fmtOMR(unit.rateAmount)} / night`
                                : `${fmtOMR(unit.rateAmount)} / mo`}
                            </span>
                            {unit.priceName && (
                              <div className="text-[10px] text-yellow-700 font-medium">🌟 {unit.priceName}</div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-base font-bold text-gray-900">{fmtOMR(unit.subtotal)}</div>
                            <div className="text-[10px] text-gray-400">OMR total</div>
                          </div>
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

      {/* ── Step 4: Pricing Summary ─────────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-4">
          {/* Breakdown per unit */}
          {selectedUnits.map(({ unit }) => (
            <div key={unit.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">{unit.name}</h3>
                <span className="text-sm text-gray-500">
                  {rateType === "daily"
                    ? `${fmtOMR(unit.rateAmount)} / night`
                    : `${fmtOMR(unit.rateAmount)} / mo`}
                </span>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-medium text-gray-400 uppercase">
                    <th className="text-left pb-1">Period</th>
                    <th className="text-right pb-1">Nights</th>
                    <th className="text-right pb-1">Rate</th>
                    <th className="text-right pb-1">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {/* Rebuild breakdown for display */}
                  {rateType === "daily"
                    ? (() => {
                        const segs = unit.breakdown as ReturnType<typeof collapseToSegments>;
                        return segs.map((seg, i) => (
                          <tr key={i} className="text-gray-700">
                            <td className="py-1.5">
                              <div className="text-xs">{seg.startDate} → {seg.endDate}</div>
                              {seg.priceName && <div className="text-[10px] text-yellow-700">🌟 {seg.priceName}</div>}
                            </td>
                            <td className="text-right py-1.5 text-xs">{seg.nights}</td>
                            <td className="text-right py-1.5 text-xs">{fmtOMR(seg.ratePerNight)}</td>
                            <td className="text-right py-1.5 font-medium">{fmtOMR(seg.subtotal)}</td>
                          </tr>
                        ));
                      })()
                    : (() => {
                        const segs = unit.breakdown as ReturnType<typeof buildMonthlyBreakdown>;
                        return segs.map((seg, i) => (
                          <tr key={i} className="text-gray-700">
                            <td className="py-1.5">
                              <div className="text-xs">{seg.label}</div>
                            </td>
                            <td className="text-right py-1.5 text-xs">{seg.nights}</td>
                            <td className="text-right py-1.5 text-xs">{fmtOMR(seg.ratePerNight)}</td>
                            <td className="text-right py-1.5 font-medium">{fmtOMR(seg.subtotal)}</td>
                          </tr>
                        ));
                      })()
                  }
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 font-semibold text-gray-900">
                    <td colSpan={3} className="pt-2 text-xs uppercase text-gray-500">Unit Total</td>
                    <td className="pt-2 text-right">{fmtOMR(unit.subtotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}

          {/* Discount, Source, Notes */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-gray-900">Booking Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount (OMR)</label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
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

          {/* Grand Total */}
          <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-5 shadow-sm">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-700">
                <span>Subtotal</span>
                <span>{fmtOMR(grandTotal.totalAmount)} OMR</span>
              </div>
              {grandTotal.discountAmount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Discount</span>
                  <span>- {fmtOMR(grandTotal.discountAmount)} OMR</span>
                </div>
              )}
              {grandTotal.taxAmount > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>Tax</span>
                  <span>{fmtOMR(grandTotal.taxAmount)} OMR</span>
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

      {/* ── Step 5: Confirm ─────────────────────────────────────────────────── */}
      {step === 5 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">Confirm Booking</h2>

          {/* Tenant */}
          {selectedTenant && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <UserIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
              <div>
                <div className="font-medium text-gray-900">{selectedTenant.firstName} {selectedTenant.lastName}</div>
                <div className="text-sm text-gray-500">{selectedTenant.phone}</div>
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
            <CalendarIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <div>
              <div className="font-medium text-gray-900">
                {startDate} → {endDate}
              </div>
              <div className="text-sm text-gray-500 capitalize">
                {formatDuration(parseLocalDate(startDate), parseLocalDate(endDate), rateType)} · {rateType} rate
              </div>
            </div>
          </div>

          {/* Units */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <HomeIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
              <span className="font-medium text-gray-900">{selectedUnits.length} Unit{selectedUnits.length !== 1 ? "s" : ""}</span>
            </div>
            {selectedUnits.map(({ unit }) => (
              <div key={unit.id} className="flex justify-between text-sm text-gray-700">
                <span>{unit.name} <span className="text-gray-400">({UNIT_TYPE_LABELS[unit.unitType] ?? unit.unitType})</span></span>
                <span className="font-medium">{fmtOMR(unit.subtotal)} OMR</span>
              </div>
            ))}
          </div>

          {/* Amount */}
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

      {/* ── Navigation bar ─────────────────────────────────────────────────── */}
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
