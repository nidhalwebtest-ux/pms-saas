import { Calendar, Filter, Plus, MoreHorizontal } from "lucide-react";

/* ============================================================================
 *  Reservations calendar mock — month strip with colored unit bars showing
 *  bookings, conflicts, and gaps. Stylized; not interactive.
 * ========================================================================= */

const DAYS = Array.from({ length: 14 }, (_, i) => i + 12);

type Bar = { unit: string; start: number; span: number; tone: "brand" | "success" | "warning" | "khareef"; label: string };

const ROWS: { unit: string; bars: Bar[] }[] = [
  { unit: "Marina · 304", bars: [
    { unit: "Marina · 304", start: 0,  span: 4,  tone: "brand",    label: "Al-Hinai" },
    { unit: "Marina · 304", start: 6,  span: 3,  tone: "success",  label: "Marri" },
    { unit: "Marina · 304", start: 11, span: 3,  tone: "khareef",  label: "Khareef" },
  ]},
  { unit: "Marina · 211", bars: [
    { unit: "Marina · 211", start: 2,  span: 7,  tone: "warning",  label: "Al Balushi · 7n" },
    { unit: "Marina · 211", start: 10, span: 4,  tone: "brand",    label: "Said" },
  ]},
  { unit: "Haffa · 102",  bars: [
    { unit: "Haffa · 102",  start: 0,  span: 5,  tone: "khareef",  label: "Khareef block" },
    { unit: "Haffa · 102",  start: 7,  span: 3,  tone: "success",  label: "Smith" },
  ]},
  { unit: "Haffa · 405",  bars: [
    { unit: "Haffa · 405",  start: 3,  span: 4,  tone: "brand",    label: "Al-Khalili" },
    { unit: "Haffa · 405",  start: 9,  span: 5,  tone: "warning",  label: "Marri · monthly" },
  ]},
  { unit: "Salalah Plaza · 18", bars: [
    { unit: "Salalah Plaza · 18", start: 1,  span: 4, tone: "success", label: "Al Saadi" },
    { unit: "Salalah Plaza · 18", start: 8,  span: 6, tone: "khareef", label: "Khareef rate" },
  ]},
];

const TONES: Record<Bar["tone"], string> = {
  brand:   "bg-brand-500/85 text-white",
  success: "bg-success-500/85 text-white",
  warning: "bg-warning-500/90 text-warning-700",
  khareef: "bg-khareef-500/85 text-white",
};

export function ReservationMock() {
  return (
    <div className="bg-white">
      <Toolbar />
      <div className="grid grid-cols-[112px_1fr] bg-gray-50">
        <div className="border-e border-gray-200 bg-white" />
        <DayStrip />
      </div>
      <div className="grid grid-cols-[112px_1fr]">
        {ROWS.map((r) => (
          <Row key={r.unit} unit={r.unit} bars={r.bars} />
        ))}
      </div>
      <Legend />
    </div>
  );
}

function Toolbar() {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <Calendar className="h-3.5 w-3.5 text-gray-500" strokeWidth={1.75} />
        <span className="text-[12.5px] font-semibold text-gray-900">June 2026</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-gray-500">Week view</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[10.5px] text-gray-600">
          <Filter className="h-3 w-3" strokeWidth={1.75} />
          All buildings
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-brand-500 px-2 py-1 text-[10.5px] font-semibold text-white">
          <Plus className="h-3 w-3" strokeWidth={2.5} />
          New
        </span>
      </div>
    </div>
  );
}

function DayStrip() {
  return (
    <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] border-b border-gray-200">
      {DAYS.map((d) => (
        <div
          key={d}
          className={[
            "px-1.5 py-1.5 text-center font-mono text-[10px] text-gray-500 tabular-nums",
            d % 7 === 0 ? "bg-gray-100" : "",
          ].join(" ")}
        >
          {d}
        </div>
      ))}
    </div>
  );
}

function Row({ unit, bars }: { unit: string; bars: Bar[] }) {
  return (
    <>
      <div className="flex items-center border-b border-gray-100 bg-white px-3 py-2.5">
        <p className="text-[10.5px] font-medium text-gray-700">{unit}</p>
      </div>
      <div className="relative grid grid-cols-[repeat(14,minmax(0,1fr))] border-b border-gray-100 bg-white">
        {DAYS.map((_, i) => (
          <span key={i} className={i % 7 === 0 ? "border-s border-gray-100" : ""} />
        ))}
        {bars.map((b, i) => (
          <span
            key={i}
            className={[
              "absolute top-1.5 bottom-1.5 inline-flex items-center overflow-hidden rounded-md px-1.5 text-[9px] font-semibold whitespace-nowrap",
              TONES[b.tone],
            ].join(" ")}
            style={{
              insetInlineStart: `${(b.start / 14) * 100}%`,
              width: `calc(${(b.span / 14) * 100}% - 4px)`,
            }}
          >
            {b.label}
          </span>
        ))}
      </div>
    </>
  );
}

function Legend() {
  const items = [
    { tone: "brand",    label: "Daily" },
    { tone: "success",  label: "Confirmed" },
    { tone: "warning",  label: "Monthly" },
    { tone: "khareef",  label: "Khareef" },
  ] as const;
  return (
    <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-2.5">
      <div className="flex items-center gap-3">
        {items.map((i) => (
          <span key={i.label} className="inline-flex items-center gap-1.5 text-[10px] text-gray-500">
            <span className={`inline-block h-2 w-2 rounded-sm ${TONES[i.tone].split(" ")[0]}`} />
            {i.label}
          </span>
        ))}
      </div>
      <MoreHorizontal className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
    </div>
  );
}
