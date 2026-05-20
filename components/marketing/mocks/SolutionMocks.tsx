import { Waves, Smartphone, Monitor, Tablet } from "lucide-react";

/* ============================================================================
 *  Solution section mini-mocks. Smaller, atmospheric — each one lives inside
 *  a 180 px tall card. Not full UIs, just suggestive vignettes.
 * ========================================================================= */

/* ── Availability calendar ─────────────────────────────────────────────── */
export function CalendarMini() {
  const DAYS = Array.from({ length: 28 });
  // Color seed map for the heatmap dots.
  const FILL = [
    [0,1,4,5,8,9,12,13],          // bookings
    [2,3,6,7,10,11,14,15,18,19],  // confirmed
    [16,17,20,21,22,23,24,25],    // khareef
  ];
  function tintFor(i: number) {
    if (FILL[0].includes(i)) return "bg-brand-500";
    if (FILL[1].includes(i)) return "bg-success-500";
    if (FILL[2].includes(i)) return "bg-khareef-500";
    return "bg-gray-200";
  }
  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto] bg-white p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-gray-900">June · 2026</p>
        <span className="font-mono text-[9px] text-gray-500">All buildings</span>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <span key={i} className="text-center font-mono text-[8px] uppercase text-gray-400">{d}</span>
        ))}
        {DAYS.map((_, i) => (
          <span
            key={i}
            className={`relative aspect-square rounded-sm ${tintFor(i)} opacity-90`}
          >
            <span className="absolute inset-0 grid place-items-center text-[7.5px] font-medium text-white/95 tabular-nums">
              {i + 1}
            </span>
          </span>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-[8.5px]">
        <span className="inline-flex items-center gap-1 text-gray-500">
          <span className="h-1.5 w-1.5 rounded-sm bg-brand-500" />Booked
        </span>
        <span className="inline-flex items-center gap-1 text-gray-500">
          <span className="h-1.5 w-1.5 rounded-sm bg-khareef-500" />Khareef
        </span>
      </div>
    </div>
  );
}

/* ── Khareef pricing ───────────────────────────────────────────────────── */
export function KhareefPricingMini() {
  return (
    <div className="relative h-full overflow-hidden bg-gradient-to-br from-khareef-50 to-white p-3">
      <div className="flex items-center gap-1.5">
        <Waves className="h-3 w-3 text-khareef-700" strokeWidth={1.75} />
        <span className="font-mono text-[9px] uppercase tracking-wide text-khareef-700">Khareef · Jun 15 – Sep 15</span>
      </div>

      <div className="mt-2 space-y-1.5">
        <PricingRow label="Marina · Studio"   normal="22.000" khareef="38.000" />
        <PricingRow label="Marina · 1 BR"     normal="32.000" khareef="48.000" highlighted />
        <PricingRow label="Haffa · 2 BR"      normal="45.000" khareef="68.000" />
      </div>

      {/* Floating chip */}
      <div className="absolute bottom-2 end-2 inline-flex items-center gap-1 rounded-full bg-success-500 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wide text-white shadow-md">
        Auto-applied
      </div>
    </div>
  );
}

function PricingRow({
  label, normal, khareef, highlighted,
}: { label: string; normal: string; khareef: string; highlighted?: boolean }) {
  return (
    <div
      className={[
        "flex items-center justify-between rounded-md border bg-white px-2 py-1.5",
        highlighted ? "border-khareef-500 ring-2 ring-khareef-500/20" : "border-gray-200",
      ].join(" ")}
    >
      <span className="text-[9.5px] font-medium text-gray-700">{label}</span>
      <span className="flex items-center gap-1.5 font-mono text-[9px] tabular-nums">
        <span className="text-gray-400 line-through">{normal}</span>
        <span className="font-semibold text-khareef-700">{khareef}</span>
      </span>
    </div>
  );
}

/* ── Multi-device ──────────────────────────────────────────────────────── */
export function MultiDeviceMini() {
  return (
    <div className="relative h-full overflow-hidden bg-white p-3">
      {/* Laptop */}
      <div className="absolute inset-x-3 top-3 h-24 rounded-md border border-gray-200 bg-gray-50 shadow-sm">
        <span className="grid h-full place-items-center">
          <Monitor className="h-7 w-7 text-gray-300" strokeWidth={1.5} />
        </span>
        <span className="absolute inset-x-0 -bottom-1 h-1 rounded-b-md bg-gray-300" />
      </div>

      {/* Tablet */}
      <div className="absolute bottom-3 start-4 h-14 w-10 rounded-md border border-gray-200 bg-white shadow-md">
        <span className="grid h-full place-items-center">
          <Tablet className="h-4 w-4 text-gray-300" strokeWidth={1.5} />
        </span>
      </div>

      {/* Phone */}
      <div className="absolute -bottom-1 end-3 h-16 w-9 rounded-lg border-2 border-gray-900 bg-white shadow-lg">
        <span className="absolute inset-x-1/2 top-0.5 h-1 w-3 -translate-x-1/2 rounded-full bg-gray-900" />
        <span className="grid h-full place-items-center pt-1">
          <Smartphone className="h-3.5 w-3.5 text-gray-300" strokeWidth={1.5} />
        </span>
      </div>

      {/* Glow */}
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_55%,oklch(0.94_0.04_258/0.6),transparent)]" />
    </div>
  );
}
