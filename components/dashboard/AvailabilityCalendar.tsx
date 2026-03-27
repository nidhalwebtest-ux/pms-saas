"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { addDays, addMonths, differenceInDays, format, isToday, parseISO, startOfMonth, endOfMonth } from "date-fns";
import {
  XMarkIcon,
  CalendarDaysIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ResInfo {
  id: string;
  reservationNumber: string | null;
  guestName: string;
  startDate: string;
  endDate: string;
  status: string;
  rateAmount: number;
}

interface DayCell {
  date: string;
  leftColor: string;
  rightColor: string;
  solid: boolean;
  isGap: boolean;
  arriving: ResInfo | null;
  departing: ResInfo | null;
  staying: ResInfo | null;
  turnaround: { departing: ResInfo; arriving: ResInfo } | null;
}

interface UnitData {
  id: string;
  name: string;
  floor: number;
  unitType: string;
  status: string;
  defaultDailyRate: number;
  days: DayCell[];
}

interface CalendarData {
  units: UnitData[];
  dates: string[];
  stats: {
    totalUnitNights: number;
    occupied: number;
    reserved: number;
    vacant: number;
    blocked: number;
    potentialRevenue: string;
  };
  propertyName: string;
  startDate: string;
  endDate: string;
}

interface Property {
  id: string;
  name: string;
}

interface TooltipState {
  cell: DayCell;
  unit: UnitData;
  x: number;
  y: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const UNIT_TYPE_LABELS: Record<string, string> = {
  STUDIO:   "Studio",
  ONE_BR:   "1 BR",
  TWO_BR:   "2 BR",
  THREE_BR: "3 BR",
  SUITE:    "Suite",
  VILLA:    "Villa",
};

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED:  "Confirmed",
  CHECKED_IN: "Checked In",
  PENDING:    "Pending",
};

// Omani weekend = Friday (5) + Saturday (6)
function isOmaniWeekend(d: Date) {
  const day = d.getDay();
  return day === 5 || day === 6;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function AvailabilityCalendar({
  properties,
  defaultPropertyId,
}: {
  properties: Property[];
  defaultPropertyId?: string;
}) {
  const router = useRouter();

  // Widget state (controls that persist even when modal is closed)
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [propertyId, setPropertyId] = useState(
    defaultPropertyId ?? properties[0]?.id ?? "",
  );
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate]     = useState(
    format(addDays(new Date(), 14), "yyyy-MM-dd"),
  );

  // Modal state
  const [isOpen, setIsOpen]   = useState(false);
  const [data, setData]       = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Tooltip
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!propertyId || !startDate || !endDate) return;
    setLoading(true);
    setError(null);
    setTooltip(null);
    try {
      const params = new URLSearchParams({ propertyId, startDate, endDate });
      const res = await fetch(`/api/availability?${params}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to fetch");
      }
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load availability");
    } finally {
      setLoading(false);
    }
  }, [propertyId, startDate, endDate]);

  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen, fetchData]);

  // ── Preset helpers ───────────────────────────────────────────────────────────

  function applyPreset(days: number) {
    const now = new Date();
    setStartDate(format(now, "yyyy-MM-dd"));
    setEndDate(format(addDays(now, days), "yyyy-MM-dd"));
  }

  function applyMonthPreset(offset: number) {
    const m = addMonths(new Date(), offset);
    setStartDate(format(startOfMonth(m), "yyyy-MM-dd"));
    setEndDate(format(endOfMonth(m), "yyyy-MM-dd"));
  }

  function applyKhareef() {
    const year = new Date().getFullYear();
    setStartDate(`${year}-07-01`);
    setEndDate(`${year}-09-15`);
  }

  // ── Click handler ────────────────────────────────────────────────────────────

  function handleCellClick(cell: DayCell, unit: UnitData) {
    setTooltip(null);
    const res =
      cell.staying ??
      cell.arriving ??
      cell.turnaround?.arriving ??
      cell.departing ??
      null;
    if (res) {
      router.push(`/dashboard/reservations/${res.id}`);
      setIsOpen(false);
    } else {
      // Vacant → new reservation with unit & date pre-filled
      router.push(
        `/dashboard/reservations/new?unitId=${unit.id}&startDate=${cell.date}`,
      );
      setIsOpen(false);
    }
  }

  // ── Date range display ───────────────────────────────────────────────────────

  const rangeDays = startDate && endDate
    ? differenceInDays(parseISO(endDate), parseISO(startDate))
    : 0;

  // ── Widget (always rendered on dashboard) ────────────────────────────────────

  return (
    <>
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDaysIcon className="h-5 w-5 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900">
            Availability Calendar
          </h3>
        </div>

        <div className="space-y-3">
          {/* Property */}
          {properties.length > 1 && (
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          {/* Date range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-1.5">
            {([7, 14, 30] as const).map((d) => (
              <button
                key={d}
                onClick={() => applyPreset(d)}
                className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-blue-100 hover:text-blue-700 transition-colors"
              >
                {d}d
              </button>
            ))}
            <button
              onClick={() => applyMonthPreset(0)}
              className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-blue-100 hover:text-blue-700 transition-colors"
            >
              This Month
            </button>
            <button
              onClick={() => applyMonthPreset(1)}
              className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-blue-100 hover:text-blue-700 transition-colors"
            >
              Next Month
            </button>
            <button
              onClick={applyKhareef}
              className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200 transition-colors"
            >
              Khareef
            </button>
          </div>

          <button
            onClick={() => setIsOpen(true)}
            disabled={!propertyId || !startDate || !endDate || rangeDays <= 0}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            View Availability Calendar
          </button>
        </div>
      </div>

      {/* ── Full-screen modal ──────────────────────────────────────────────────── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-100">
          {/* Header */}
          <div className="flex items-center gap-4 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
            <CalendarDaysIcon className="h-5 w-5 shrink-0 text-blue-600" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {data?.propertyName ?? properties.find((p) => p.id === propertyId)?.name ?? "Availability Calendar"}
              </p>
              <p className="text-xs text-gray-400">
                {startDate && endDate
                  ? `${format(parseISO(startDate), "MMM d")} – ${format(parseISO(endDate), "MMM d, yyyy")} · ${rangeDays} nights`
                  : ""}
              </p>
            </div>

            {/* Inline controls */}
            <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
              {properties.length > 1 && (
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}

              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-400 text-xs">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex gap-1">
                {([7, 14, 30] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => applyPreset(d)}
                    className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                  >
                    {d}d
                  </button>
                ))}
                <button
                  onClick={() => applyMonthPreset(0)}
                  className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                >
                  This Mo
                </button>
                <button
                  onClick={() => applyMonthPreset(1)}
                  className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                >
                  Next Mo
                </button>
                <button
                  onClick={applyKhareef}
                  className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200 transition-colors"
                >
                  Khareef
                </button>
              </div>

              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <ArrowPathIcon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Loading…" : "Refresh"}
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Stats bar */}
          {data && !loading && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-gray-200 bg-white px-6 py-2.5">
              <StatChip color="#22C55E" label="Vacant" value={data.stats.vacant} total={data.stats.totalUnitNights} />
              <StatChip color="#3B82F6" label="Confirmed" value={data.stats.reserved} total={data.stats.totalUnitNights} />
              <StatChip color="#EF4444" label="Checked In" value={data.stats.occupied} total={data.stats.totalUnitNights} />
              {data.stats.blocked > 0 && (
                <StatChip color="#6B7280" label="Blocked" value={data.stats.blocked} total={data.stats.totalUnitNights} />
              )}
              <div className="ml-auto text-xs text-gray-500">
                Potential revenue from vacancies:{" "}
                <span className="font-semibold text-green-700">
                  {data.stats.potentialRevenue} OMR
                </span>
              </div>
            </div>
          )}

          {/* Grid area */}
          <div className="flex-1 overflow-auto" ref={gridRef}>
            {loading && !data && (
              <div className="flex items-center justify-center h-full">
                <div className="text-sm text-gray-400">Loading availability…</div>
              </div>
            )}
            {error && (
              <div className="flex items-center justify-center h-full">
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              </div>
            )}

            {data && data.units.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <div className="text-sm text-gray-400">No units found for this property.</div>
              </div>
            )}

            {data && data.units.length > 0 && (
              <table
                className="border-collapse bg-white"
                style={{ tableLayout: "fixed", minWidth: "max-content" }}
              >
                <thead className="sticky top-0 z-20">
                  {/* Month header row */}
                  <MonthHeaderRow dates={data.dates} />

                  {/* Day header row */}
                  <tr>
                    <th
                      className="sticky left-0 z-30 bg-white border-b-2 border-r border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                      style={{ width: 168, minWidth: 168 }}
                    >
                      Unit
                    </th>
                    {data.dates.map((date) => {
                      const d = parseISO(date);
                      const todayFlag = isToday(d);
                      const weekend   = isOmaniWeekend(d);
                      return (
                        <th
                          key={date}
                          className={`border-b-2 border-r border-gray-100 text-center py-1.5 ${
                            todayFlag
                              ? "bg-blue-600 text-white"
                              : weekend
                                ? "bg-amber-50 text-gray-600"
                                : "bg-white text-gray-500"
                          }`}
                          style={{ width: 40, minWidth: 40 }}
                        >
                          <div className="text-xs font-bold leading-none">
                            {format(d, "d")}
                          </div>
                          <div className="text-[10px] leading-none mt-0.5 opacity-70">
                            {format(d, "EEE")}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {data.units.map((unit, unitIdx) => (
                    <tr
                      key={unit.id}
                      className={unitIdx % 2 === 0 ? "bg-white" : "bg-gray-50/60"}
                    >
                      {/* Unit label — sticky */}
                      <td
                        className={`sticky left-0 z-10 border-b border-r border-gray-200 px-3 py-1.5 ${
                          unitIdx % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }`}
                        style={{ width: 168, minWidth: 168 }}
                      >
                        <div className="text-sm font-semibold text-gray-900 truncate leading-tight">
                          {unit.name}
                        </div>
                        <div className="text-[10px] text-gray-400 leading-tight">
                          {UNIT_TYPE_LABELS[unit.unitType] ?? unit.unitType}
                          {unit.floor > 0 ? ` · Floor ${unit.floor}` : ""}
                        </div>
                      </td>

                      {/* Day cells */}
                      {unit.days.map((cell) => {
                        const d = parseISO(cell.date);
                        const todayFlag = isToday(d);
                        return (
                          <td
                            key={cell.date}
                            className="border-b border-r border-gray-100 p-0 cursor-pointer"
                            style={{ width: 40, minWidth: 40, height: 40 }}
                            title=""
                            onClick={() => handleCellClick(cell, unit)}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTooltip({
                                cell,
                                unit,
                                x: rect.left + rect.width / 2,
                                y: rect.bottom + 6,
                              });
                            }}
                            onMouseLeave={() => setTooltip(null)}
                          >
                            <div
                              className="relative w-full h-full"
                              style={{
                                height: 40,
                                background: cell.solid
                                  ? cell.leftColor
                                  : `linear-gradient(135deg, ${cell.leftColor} 50%, ${cell.rightColor} 50%)`,
                                outline: todayFlag
                                  ? "2px solid #2563EB"
                                  : cell.isGap
                                    ? "2px dashed #F97316"
                                    : "none",
                                outlineOffset: "-2px",
                              }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Legend footer */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-gray-200 bg-white px-6 py-2.5">
            {[
              { color: "#22C55E", label: "Vacant" },
              { color: "#EAB308", label: "Pending" },
              { color: "#3B82F6", label: "Confirmed" },
              { color: "#EF4444", label: "Checked In" },
              { color: "#6B7280", label: "Blocked" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div
                  className="h-3.5 w-3.5 rounded-sm shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs text-gray-500">{item.label}</span>
              </div>
            ))}
            <span className="text-xs text-gray-400 ml-2 hidden sm:block">
              · Diagonal = check-in / check-out day · Orange dashed border = short gap
            </span>
            <span className="text-xs text-gray-400 ml-auto hidden sm:block">
              Fri & Sat are highlighted (Omani weekend)
            </span>
          </div>
        </div>
      )}

      {/* ── Tooltip ──────────────────────────────────────────────────────────── */}
      {tooltip && <CalendarTooltip tooltip={tooltip} />}
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatChip({
  color,
  label,
  value,
  total,
}: {
  color: string;
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
      <span className="text-xs text-gray-600">
        {label}: <strong>{value}</strong>
        <span className="text-gray-400 ml-1">({pct}%)</span>
      </span>
    </div>
  );
}

function MonthHeaderRow({ dates }: { dates: string[] }) {
  // Group consecutive dates by month
  const groups: { label: string; count: number }[] = [];
  for (const date of dates) {
    const label = format(parseISO(date), "MMMM yyyy");
    const last = groups.at(-1);
    if (last && last.label === label) {
      last.count++;
    } else {
      groups.push({ label, count: 1 });
    }
  }

  return (
    <tr>
      <th
        className="sticky left-0 z-30 bg-gray-50 border-b border-r border-gray-200"
        style={{ width: 168, minWidth: 168 }}
      />
      {groups.map((g) => (
        <th
          key={g.label}
          colSpan={g.count}
          className="bg-gray-50 border-b border-r border-gray-200 text-left px-2 py-1 text-xs font-semibold text-gray-600"
          style={{ minWidth: 40 * g.count }}
        >
          {g.label}
        </th>
      ))}
    </tr>
  );
}

function CalendarTooltip({ tooltip }: { tooltip: TooltipState }) {
  const { cell, unit, x, y } = tooltip;

  // Clamp x so tooltip doesn't overflow right edge
  const safeX =
    typeof window !== "undefined"
      ? Math.min(x - 8, window.innerWidth - 256)
      : x - 8;
  const safeY =
    typeof window !== "undefined"
      ? Math.min(y, window.innerHeight - 140)
      : y;

  return (
    <div
      className="fixed z-[200] w-56 rounded-xl bg-gray-900 px-3.5 py-3 text-xs text-white shadow-2xl pointer-events-none"
      style={{ left: safeX, top: safeY }}
    >
      <div className="font-semibold text-gray-200 mb-1.5 truncate">{unit.name}</div>

      {cell.turnaround ? (
        <>
          <div className="text-[10px] text-amber-400 uppercase tracking-wider font-bold mb-1">
            Turnaround Day
          </div>
          <div className="space-y-1.5">
            <div>
              <span className="text-orange-300 text-[10px]">Departing</span>
              <div className="font-medium truncate">{cell.turnaround.departing.guestName}</div>
              <div className="text-gray-400 text-[10px]">
                {cell.turnaround.departing.reservationNumber}
              </div>
            </div>
            <div className="border-t border-gray-700 pt-1.5">
              <span className="text-green-300 text-[10px]">Arriving</span>
              <div className="font-medium truncate">{cell.turnaround.arriving.guestName}</div>
              <div className="text-gray-400 text-[10px]">
                {cell.turnaround.arriving.reservationNumber}
              </div>
            </div>
          </div>
        </>
      ) : cell.staying ? (
        <>
          <div
            className="text-[10px] uppercase tracking-wider font-bold mb-1"
            style={{ color: STATUS_COLORS[cell.staying.status] ?? "#9CA3AF" }}
          >
            {STATUS_LABELS[cell.staying.status] ?? cell.staying.status}
          </div>
          <div className="font-medium truncate">{cell.staying.guestName}</div>
          <div className="text-gray-400 text-[10px]">
            {cell.staying.reservationNumber}
          </div>
          <div className="text-gray-300 mt-1.5 text-[10px]">
            {format(parseISO(cell.staying.startDate), "MMM d")} →{" "}
            {format(parseISO(cell.staying.endDate), "MMM d, yyyy")}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            {cell.staying.rateAmount.toFixed(3)} OMR / night
          </div>
          <div className="mt-2 text-[10px] text-blue-300">Click to open reservation →</div>
        </>
      ) : cell.arriving ? (
        <>
          <div className="text-[10px] text-green-400 uppercase tracking-wider font-bold mb-1">
            Check-In Today
          </div>
          <div className="font-medium truncate">{cell.arriving.guestName}</div>
          <div className="text-gray-400 text-[10px]">{cell.arriving.reservationNumber}</div>
          <div className="text-gray-300 mt-1.5 text-[10px]">
            Until {format(parseISO(cell.arriving.endDate), "MMM d, yyyy")}
          </div>
          <div className="mt-2 text-[10px] text-blue-300">Click to open reservation →</div>
        </>
      ) : cell.departing ? (
        <>
          <div className="text-[10px] text-orange-400 uppercase tracking-wider font-bold mb-1">
            Check-Out Today
          </div>
          <div className="font-medium truncate">{cell.departing.guestName}</div>
          <div className="text-gray-400 text-[10px]">{cell.departing.reservationNumber}</div>
          <div className="mt-2 text-[10px] text-blue-300">Click to open reservation →</div>
        </>
      ) : (
        <>
          <div className="text-[10px] text-green-400 uppercase tracking-wider font-bold mb-1">
            Vacant
          </div>
          {cell.isGap && (
            <div className="text-orange-300 text-[10px] mb-1">
              Short gap — consider filling
            </div>
          )}
          <div className="text-gray-400 text-[10px]">
            {unit.defaultDailyRate.toFixed(3)} OMR / night
          </div>
          <div className="mt-2 text-[10px] text-blue-300">Click to create reservation →</div>
        </>
      )}
    </div>
  );
}

// Color map (mirrors API colors — kept in sync manually)
const STATUS_COLORS: Record<string, string> = {
  CONFIRMED:  "#3B82F6",
  CHECKED_IN: "#EF4444",
  PENDING:    "#EAB308",
};
