import {
  Building2, Users, Wallet, BedDouble, ArrowUp, ArrowDown,
} from "lucide-react";

/* ============================================================================
 *  Hero dashboard mock — a stylised version of the Today view that lives
 *  inside the laptop chrome on the hero. No interactivity, no data fetching;
 *  pure presentation.
 * ========================================================================= */

const STATS = [
  { label: "Arriving today", value: 8,  tint: "from-brand-500 to-brand-600",       Icon: ArrowDown },
  { label: "Checking out",   value: 5,  tint: "from-warning-500 to-warning-700",   Icon: ArrowUp },
  { label: "Overstays",      value: 1,  tint: "from-error-500 to-[oklch(0.5_0.18_25)]",  Icon: BedDouble, pulse: true },
  { label: "In-house",       value: 23, tint: "from-success-500 to-success-700",   Icon: Users },
];

const ARRIVALS = [
  { name: "Reem Al-Hinai",     unit: "Marina · 304", time: "14:30",   badge: "VIP",      badgeCls: "bg-[oklch(0.95_0.04_80)] text-warning-700" },
  { name: "Salim Al-Khalili",  unit: "Haffa · 102",  time: "16:00",   badge: null },
  { name: "Ahmed Al Balushi",  unit: "Marina · 211", time: "Overdue", badge: "1 day",    badgeCls: "bg-error-50 text-error-500" },
  { name: "Jamil Marri",       unit: "Haffa · 405",  time: "18:45",   badge: null },
];

export function HeroDashboardMock() {
  return (
    <div className="grid h-full grid-cols-[80px_1fr] bg-white">
      <Sidebar />
      <div className="bg-gray-50 p-4">
        <Header />
        <div className="mt-3 grid grid-cols-4 gap-2">
          {STATS.map((s) => <StatTile key={s.label} {...s} />)}
        </div>
        <ArrivalsTable />
      </div>
    </div>
  );
}

function Sidebar() {
  const items = [
    { Icon: BedDouble, active: true },
    { Icon: Users },
    { Icon: Building2 },
    { Icon: Wallet },
  ];
  return (
    <aside className="flex flex-col items-center gap-1.5 border-e border-gray-200 bg-white py-3">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-500 text-[12px] font-semibold text-white">B</span>
      <span className="mt-2 h-px w-7 bg-gray-200" />
      {items.map(({ Icon, active }, i) => (
        <span
          key={i}
          className={[
            "grid h-8 w-8 place-items-center rounded-lg",
            active ? "bg-brand-50 text-brand-600" : "text-gray-400",
          ].join(" ")}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
      ))}
    </aside>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-[0.06em] text-gray-500">Today · 21 Jun</p>
        <p className="text-[14px] font-semibold text-gray-900">Good morning, Reem</p>
      </div>
      <div className="inline-flex rounded-md border border-gray-200 bg-white p-[2px] text-[10.5px] font-medium">
        <span className="rounded-[5px] bg-gray-900 px-2 py-1 text-white">Today</span>
        <span className="px-2 py-1 text-gray-500">Receptionist</span>
        <span className="px-2 py-1 text-gray-500">Manager</span>
      </div>
    </div>
  );
}

function StatTile({
  label, value, tint, Icon, pulse,
}: {
  label: string; value: number; tint: string; Icon: React.ElementType; pulse?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-gradient-to-br ${tint} p-2.5 text-white`}>
      {pulse && (
        <span className="absolute top-1.5 end-1.5 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-80" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
      )}
      <Icon className="h-3 w-3 opacity-80" strokeWidth={2} />
      <p className="mt-1 text-[18px] font-bold leading-none">{value}</p>
      <p className="mt-0.5 text-[8.5px] font-medium uppercase tracking-wide opacity-85">{label}</p>
    </div>
  );
}

function ArrivalsTable() {
  return (
    <div className="mt-3 overflow-hidden rounded-md border border-gray-200 bg-white">
      <div className="flex items-center gap-1.5 border-b border-gray-100 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-brand-500" />
        <span className="text-[10.5px] font-semibold text-gray-900">Arriving today</span>
        <span className="rounded-full bg-gray-100 px-1.5 py-px text-[9px] font-medium text-gray-600 ltr-num">4</span>
      </div>
      <ul className="divide-y divide-gray-50">
        {ARRIVALS.map((a) => (
          <li key={a.name} className="flex items-center justify-between px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold text-gray-900 truncate">{a.name}</p>
              <p className="text-[9px] text-gray-500">{a.unit}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {a.badge && (
                <span className={`rounded-full px-1.5 py-px text-[8.5px] font-semibold ${a.badgeCls}`}>
                  {a.badge}
                </span>
              )}
              <span className="font-mono text-[9px] text-gray-500 tabular-nums">{a.time}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
