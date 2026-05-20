import {
  CalendarDays, ArrowDown, ArrowUp, AlertTriangle, Users,
} from "lucide-react";
import Container, { SectionHead } from "../ui/Container";
import { Reveal } from "../ui/Reveal";

/* ============================================================================
 *  RTL Preview — side-by-side English / Arabic product previews so visitors
 *  can see that the Arabic experience is first-class, not bolted on. Both
 *  cards are static UI snapshots: real layout, real translations.
 * ========================================================================= */

const EN_STATS = [
  { label: "Arriving",  value: 8,  tint: "from-brand-500 to-brand-600",     Icon: ArrowDown },
  { label: "Checkout",  value: 5,  tint: "from-warning-500 to-warning-700", Icon: ArrowUp },
  { label: "Overstay",  value: 1,  tint: "from-error-500 to-[oklch(0.5_0.18_25)]", Icon: AlertTriangle, pulse: true },
  { label: "In-house",  value: 23, tint: "from-success-500 to-success-700", Icon: Users },
];

const AR_STATS = [
  { label: "الوصول",      value: 8,  tint: "from-brand-500 to-brand-600",     Icon: ArrowDown },
  { label: "المغادرة",    value: 5,  tint: "from-warning-500 to-warning-700", Icon: ArrowUp },
  { label: "تجاوز",        value: 1,  tint: "from-error-500 to-[oklch(0.5_0.18_25)]", Icon: AlertTriangle, pulse: true },
  { label: "داخل الفندق",  value: 23, tint: "from-success-500 to-success-700", Icon: Users },
];

const EN_LIST = [
  { name: "Reem Al-Hinai",     unit: "Marina · 304", balance: "0.000",   badge: "VIP",      badgeCls: "bg-[oklch(0.95_0.04_80)] text-warning-700" },
  { name: "Salim Al-Khalili",  unit: "Haffa · 102",  balance: "42.500",  badge: null,       badgeCls: "" },
  { name: "Ahmed Al Balushi",  unit: "Marina · 211", balance: "120.000", badge: "Overdue",  badgeCls: "bg-error-50 text-error-500" },
];

const AR_LIST = [
  { name: "ريم الهنائي",       unit: "المرسى · 304", balance: "0.000",   badge: "كبار الضيوف", badgeCls: "bg-[oklch(0.95_0.04_80)] text-warning-700" },
  { name: "سالم الخليلي",      unit: "الحفة · 102",   balance: "42.500",  badge: null,         badgeCls: "" },
  { name: "أحمد البلوشي",      unit: "المرسى · 211", balance: "120.000", badge: "متأخر",       badgeCls: "bg-error-50 text-error-500" },
];

export default function RtlPreviewSection() {
  return (
    <section
      id="rtl"
      data-screen-label="RTL Preview"
      className="relative overflow-hidden border-y border-gray-200 bg-gradient-to-b from-white via-khareef-50/30 to-white py-16 md:py-24"
    >
      <Container className="relative">
        <SectionHead
          eyebrow="عربي · Arabic-first"
          title="Same product. Both directions."
          description="Every screen, every form, every report flips right-to-left without a single missing translation or broken layout. Train your team in their preferred language."
        />

        <div className="grid items-stretch gap-6 md:grid-cols-2">
          <Reveal from="left">
            <PreviewCard dir="ltr" label="English · LTR">
              <DashboardPanel
                dir="ltr"
                greeting="Good morning, Reem"
                date="Saturday · 21 June 2026"
                statsLabel="Today"
                stats={EN_STATS}
                listTitle="Arriving today"
                rows={EN_LIST}
                balanceLabel="Balance"
                payText="Collect"
                viewText="View"
                fontClass=""
              />
            </PreviewCard>
          </Reveal>

          <Reveal from="right" delay={120}>
            <PreviewCard dir="rtl" label="عربي · RTL">
              <DashboardPanel
                dir="rtl"
                greeting="صباح الخير، ريم"
                date="السبت · ٢١ يونيو ٢٠٢٦"
                statsLabel="اليوم"
                stats={AR_STATS}
                listTitle="الوصول اليوم"
                rows={AR_LIST}
                balanceLabel="الرصيد"
                payText="تحصيل"
                viewText="عرض"
                fontClass="font-arabic"
              />
            </PreviewCard>
          </Reveal>
        </div>

        <p className="mx-auto mt-10 max-w-[640px] text-center text-sm text-gray-500">
          Every number stays LTR · every chevron flips · every date uses the
          right calendar conventions. <span className="font-arabic">يدعم العربية بالكامل.</span>
        </p>
      </Container>
    </section>
  );
}

function PreviewCard({
  dir, label, children,
}: { dir: "ltr" | "rtl"; label: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg transition-shadow hover:shadow-xl">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-gray-500">
          {label}
        </span>
        <span className="font-mono text-[10px] text-gray-400">app.binaya.om</span>
      </div>
      <div dir={dir}>{children}</div>
    </div>
  );
}

function DashboardPanel({
  dir, greeting, date, statsLabel, stats, listTitle, rows, balanceLabel, payText, viewText, fontClass,
}: {
  dir: "ltr" | "rtl";
  greeting: string;
  date: string;
  statsLabel: string;
  stats: typeof EN_STATS;
  listTitle: string;
  rows: typeof EN_LIST;
  balanceLabel: string;
  payText: string;
  viewText: string;
  fontClass: string;
}) {
  return (
    <div className={`bg-white p-4 ${fontClass}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-gray-500 ltr-num">
            {date}
          </p>
          <p className="text-[15px] font-semibold text-gray-900">{greeting}</p>
        </div>
        <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-medium text-gray-600">
          {statsLabel}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className={`relative overflow-hidden rounded-md bg-gradient-to-br ${s.tint} p-2.5 text-white`}>
            {s.pulse && (
              <span className="absolute top-1.5 end-1.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-80" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
            )}
            <s.Icon className="h-3 w-3 opacity-80" strokeWidth={2} />
            <p className="mt-1 font-mono text-[18px] font-bold leading-none tabular-nums" dir="ltr">
              {s.value}
            </p>
            <p className="mt-0.5 text-[8.5px] font-medium uppercase tracking-wide opacity-90">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 overflow-hidden rounded-md border border-gray-200">
        <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50 px-3 py-2">
          <CalendarDays className="h-3 w-3 text-gray-500" strokeWidth={1.75} />
          <span className="text-[10.5px] font-semibold text-gray-900">{listTitle}</span>
          <span className="rounded-full bg-gray-100 px-1.5 py-px font-mono text-[9px] font-medium text-gray-600 ltr-num">
            {rows.length}
          </span>
        </div>
        <ul className="divide-y divide-gray-100">
          {rows.map((r) => (
            <li key={r.name} className="flex items-center justify-between px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[10.5px] font-semibold text-gray-900 truncate">{r.name}</p>
                  {r.badge && (
                    <span className={`rounded-full px-1.5 py-px text-[8px] font-semibold ${r.badgeCls}`}>
                      {r.badge}
                    </span>
                  )}
                </div>
                <p className="text-[9px] text-gray-500">{r.unit}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={[
                    "font-mono text-[9.5px] tabular-nums",
                    parseFloat(r.balance) > 0 ? "text-error-500" : "text-success-700",
                  ].join(" ")}
                  dir="ltr"
                >
                  {parseFloat(r.balance) > 0
                    ? `${balanceLabel}: ${r.balance}`
                    : "✓"}
                </span>
                {parseFloat(r.balance) > 0 ? (
                  <span className="rounded-md bg-brand-500 px-1.5 py-0.5 text-[8.5px] font-semibold text-white">
                    {payText}
                  </span>
                ) : (
                  <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[8.5px] font-semibold text-gray-700">
                    {viewText}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
