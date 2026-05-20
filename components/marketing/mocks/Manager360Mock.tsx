import { TrendingUp, BarChart3, Building2 } from "lucide-react";

/* ============================================================================
 *  Manager 360 mock — revenue chart, occupancy heatmap row, building KPIs.
 *  Stylised; SVG chart paths are bespoke.
 * ========================================================================= */

const BUILDINGS = [
  { name: "Salalah Plaza",     occ: 96, rev: "8,420", color: "bg-brand-500" },
  { name: "Marina Suites",     occ: 88, rev: "6,910", color: "bg-success-500" },
  { name: "Haffa Residences",  occ: 71, rev: "4,200", color: "bg-warning-500" },
];

export function Manager360Mock() {
  return (
    <div className="grid grid-cols-[1fr_220px] bg-white">
      <div className="bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-gray-500">Manager view · June</p>
            <p className="text-[14px] font-semibold text-gray-900">Revenue across all buildings</p>
          </div>
          <div className="inline-flex items-center gap-1 rounded-md bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success-700">
            <TrendingUp className="h-2.5 w-2.5" strokeWidth={2.5} />
            +18%
          </div>
        </div>

        <div className="mt-3 rounded-md border border-gray-200 bg-white p-3">
          <KpiRow />
          <RevenueChart />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {BUILDINGS.map((b) => (
            <div key={b.name} className="rounded-md border border-gray-200 bg-white p-2.5">
              <p className="text-[9px] text-gray-500">{b.name}</p>
              <p className="mt-1 font-mono text-[14px] font-semibold text-gray-900 tabular-nums">{b.rev}</p>
              <p className="text-[8.5px] text-gray-400">OMR · {b.occ}% occ.</p>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-100">
                <div className={`h-full ${b.color}`} style={{ width: `${b.occ}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <Sidebar />
    </div>
  );
}

function KpiRow() {
  const kpis = [
    { label: "Revenue",   value: "19,530", sub: "OMR",  trend: "+18%", tone: "text-success-700" },
    { label: "Occupancy", value: "88%",    sub: "Avg.", trend: "+6 pts", tone: "text-success-700" },
    { label: "Outstanding", value: "1,240", sub: "OMR", trend: "−12%", tone: "text-error-500" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {kpis.map((k) => (
        <div key={k.label}>
          <p className="text-[9px] font-mono uppercase tracking-wide text-gray-500">{k.label}</p>
          <p className="mt-0.5 font-mono text-[16px] font-semibold text-gray-900 tabular-nums">{k.value}</p>
          <p className="text-[9px] text-gray-400">{k.sub}<span className={`ms-1 font-semibold ${k.tone}`}>{k.trend}</span></p>
        </div>
      ))}
    </div>
  );
}

function RevenueChart() {
  // Stylised area chart — bespoke SVG, deterministic curve.
  return (
    <div className="mt-3">
      <svg viewBox="0 0 300 80" className="h-20 w-full overflow-visible">
        <defs>
          <linearGradient id="manRev" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"  stopColor="var(--brand-500)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--brand-500)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,60 L25,55 L50,52 L75,45 L100,42 L125,30 L150,33 L175,28 L200,22 L225,18 L250,14 L275,10 L300,8 L300,80 L0,80 Z"
          fill="url(#manRev)"
        />
        <path
          d="M0,60 L25,55 L50,52 L75,45 L100,42 L125,30 L150,33 L175,28 L200,22 L225,18 L250,14 L275,10 L300,8"
          fill="none"
          stroke="var(--brand-500)"
          strokeWidth="1.5"
        />
        {[60, 55, 52, 45, 42, 30, 33, 28, 22, 18, 14, 10, 8].map((y, i) => (
          <circle key={i} cx={i * 25} cy={y} r="2" fill="var(--brand-600)" />
        ))}
      </svg>
      <div className="mt-1.5 flex justify-between font-mono text-[8.5px] text-gray-400 tabular-nums">
        <span>Jun 1</span><span>Jun 7</span><span>Jun 14</span><span>Jun 21</span><span>Jun 28</span>
      </div>
    </div>
  );
}

function Sidebar() {
  const items = [
    { label: "Aging A/R",       value: "1,240", tint: "error",   icon: BarChart3 },
    { label: "Next month forecast", value: "26.4k", tint: "brand",  icon: TrendingUp },
    { label: "Pending approvals", value: "3",     tint: "warning", icon: Building2 },
  ] as const;
  const tints = {
    error:   "bg-error-50 text-error-500",
    brand:   "bg-brand-50 text-brand-700",
    warning: "bg-warning-50 text-warning-700",
  };
  return (
    <aside className="space-y-2 border-s border-gray-200 bg-white p-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.06em] text-gray-500">Quick KPIs</p>
      {items.map((i) => {
        const Icon = i.icon;
        return (
          <div key={i.label} className="flex items-center gap-2.5 rounded-md border border-gray-200 px-2 py-2">
            <span className={`grid h-7 w-7 place-items-center rounded-md ${tints[i.tint]}`}>
              <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
            </span>
            <div>
              <p className="font-mono text-[12px] font-semibold text-gray-900 tabular-nums">{i.value}</p>
              <p className="text-[9px] text-gray-500">{i.label}</p>
            </div>
          </div>
        );
      })}
    </aside>
  );
}
