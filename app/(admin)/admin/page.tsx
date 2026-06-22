import Link from "next/link";
import {
  MapPinIcon,
  PresentationChartLineIcon,
  HandThumbUpIcon,
  TrophyIcon,
  BoltIcon,
  ArrowRightIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";
import { FUNNEL_STAGES, STAGE_LABELS, CHANNEL_LABELS, stageBadge } from "./_lib/crm-options";
import { fmtDate, dueState } from "./_lib/format";
import { waLink } from "@/utils/whatsapp";

/** Playbook 30-day targets. */
const TARGETS = { visits: 40, demos: 15, interested: 10, signed: 5, active: 3 };
const FOUNDING_SPOTS = 5;

const has = (stage: string, set: string[]) => set.includes(stage);

function StatCard({
  label,
  value,
  target,
  Icon,
  accent,
}: {
  label: string;
  value: number;
  target: number;
  Icon: typeof MapPinIcon;
  accent: string;
}) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  return (
    <div className="rounded-2xl border border-border-default bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-xs text-fg-tertiary">Target {target}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tabular-nums text-fg">{value}</span>
        <span className="text-sm text-fg-tertiary">/ {target}</span>
      </div>
      <p className="text-xs font-medium text-fg-secondary">{label}</p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-subtle">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const weekAhead = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59, 999);

  const [prospects, visitsCount, objectionRows, lostRows, dueRows, plannedVisits] = await Promise.all([
    prisma.prospect.findMany({ select: { stage: true, interestLevel: true } }),
    prisma.prospectVisit.count(),
    prisma.prospectVisit.findMany({
      where: { objectionRaised: { not: null } },
      select: { objectionRaised: true },
    }),
    prisma.prospect.findMany({
      where: { stage: "LOST", lostReason: { not: null } },
      select: { lostReason: true },
    }),
    prisma.prospectFollowup.findMany({
      where: { completed: false, dueDate: { lte: endOfToday } },
      orderBy: { dueDate: "asc" },
      take: 6,
      include: { prospect: { select: { id: true, businessName: true, phone: true } } },
    }),
    prisma.prospectFollowup.findMany({
      where: { completed: false, channel: "VISIT", dueDate: { gt: endOfToday, lte: weekAhead } },
      orderBy: { dueDate: "asc" },
      include: { prospect: { select: { id: true, businessName: true } } },
    }),
  ]);

  // ── Funnel KPIs ──────────────────────────────────────────────────────────
  const signed = prospects.filter((p) => has(p.stage, ["SIGNED", "ACTIVE"])).length;
  const active = prospects.filter((p) => p.stage === "ACTIVE").length;
  const demos = prospects.filter((p) => has(p.stage, ["DEMO_DONE", "INTERESTED", "SIGNED", "ACTIVE"])).length;
  const interested = prospects.filter(
    (p) => has(p.stage, ["INTERESTED", "SIGNED", "ACTIVE"]) || has(p.interestLevel, ["HOT", "WARM"]),
  ).length;
  const foundingRemaining = Math.max(0, FOUNDING_SPOTS - signed);

  // ── Funnel stage counts (current stage) ──────────────────────────────────
  const stageCounts = FUNNEL_STAGES.map((s) => ({
    stage: s,
    count: prospects.filter((p) => p.stage === s).length,
  }));
  const maxStage = Math.max(1, ...stageCounts.map((s) => s.count));

  // ── Objection / lost-reason patterns ─────────────────────────────────────
  const freq = new Map<string, { label: string; count: number }>();
  const tally = (text: string | null) => {
    if (!text) return;
    const label = text.trim();
    if (!label) return;
    const key = label.toLowerCase();
    const cur = freq.get(key);
    if (cur) cur.count += 1;
    else freq.set(key, { label, count: 1 });
  };
  objectionRows.forEach((o) => tally(o.objectionRaised));
  lostRows.forEach((l) => tally(l.lostReason));
  const patterns = [...freq.values()].sort((a, b) => b.count - a.count).slice(0, 8);

  const cards = [
    { label: "Visits completed", value: visitsCount, target: TARGETS.visits, Icon: MapPinIcon, accent: "bg-brand-50 text-brand-700" },
    { label: "Demos delivered", value: demos, target: TARGETS.demos, Icon: PresentationChartLineIcon, accent: "bg-info-50 text-info-700" },
    { label: "Interested / warm+", value: interested, target: TARGETS.interested, Icon: HandThumbUpIcon, accent: "bg-warning-50 text-warning-700" },
    { label: "Signed founders", value: signed, target: TARGETS.signed, Icon: TrophyIcon, accent: "bg-success-50 text-success-700" },
    { label: "Active users", value: active, target: TARGETS.active, Icon: BoltIcon, accent: "bg-brand-100 text-brand-700" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-fg">Sales dashboard</h2>
        <p className="text-sm text-fg-tertiary">Your funnel against the 30-day founding-member push</p>
      </div>

      {/* ── Founding spots remaining (scarcity number) ─────────────── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Founding spots remaining</p>
          <p className="mt-1 text-sm text-fg-secondary">
            Out of {FOUNDING_SPOTS} — this is the scarcity number you quote to prospects.
          </p>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-extrabold tabular-nums text-brand-600">{foundingRemaining}</span>
          <span className="text-sm text-fg-tertiary">/ {FOUNDING_SPOTS} left</span>
        </div>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Funnel ───────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border-default bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-fg">Pipeline funnel</h3>
          <ul className="space-y-2">
            {stageCounts.map(({ stage, count }) => (
              <li key={stage} className="flex items-center gap-3">
                <span className="w-28 flex-shrink-0 text-xs text-fg-secondary">{STAGE_LABELS[stage]}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-md bg-subtle">
                  <div
                    className="flex h-full items-center rounded-md bg-brand-400 px-2"
                    style={{ width: `${Math.max(8, (count / maxStage) * 100)}%` }}
                  >
                    <span className="text-[11px] font-bold text-white">{count}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Objection patterns ───────────────────────────────────── */}
        <div className="rounded-2xl border border-border-default bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-fg">Objection &amp; lost-reason patterns</h3>
          {patterns.length === 0 ? (
            <p className="text-sm text-fg-tertiary">No objections logged yet — they’ll surface here as you log visits.</p>
          ) : (
            <ul className="space-y-1.5">
              {patterns.map((p) => (
                <li key={p.label} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm text-fg-secondary">{p.label}</span>
                  <Badge tone={p.count > 1 ? "warning" : "neutral"} appearance="subtle" size="sm">
                    ×{p.count}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Today's / overdue follow-ups ─────────────────────────── */}
        <div className="rounded-2xl border border-border-default bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-fg">Due today &amp; overdue</h3>
            <Link href="/admin/followups" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
              Open queue <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
          {dueRows.length === 0 ? (
            <p className="text-sm text-fg-tertiary">Nothing due. You’re caught up.</p>
          ) : (
            <ul className="space-y-2">
              {dueRows.map((f) => {
                const overdue = dueState(f.dueDate.toISOString()) === "overdue";
                const wa = f.channel === "WHATSAPP" ? waLink(f.prospect.phone, f.purpose ?? undefined) : null;
                return (
                  <li key={f.id} className="flex items-center gap-2">
                    <Badge tone={overdue ? "danger" : "warning"} appearance="solid" size="sm">
                      {overdue ? fmtDate(f.dueDate.toISOString()) : "Today"}
                    </Badge>
                    <Link href={`/admin/prospects/${f.prospect.id}`} className="min-w-0 flex-1 truncate text-sm text-fg hover:text-brand-600">
                      <span className="font-medium">{f.prospect.businessName}</span>
                      <span className="text-fg-tertiary"> · {f.purpose ?? CHANNEL_LABELS[f.channel]}</span>
                    </Link>
                    {wa && (
                      <a href={wa} target="_blank" rel="noopener noreferrer" className="text-success-600 hover:text-success-700" title="WhatsApp">
                        <ChatBubbleLeftRightIcon className="h-4 w-4" />
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── This week's planned visits ───────────────────────────── */}
        <div className="rounded-2xl border border-border-default bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-fg">This week’s planned visits</h3>
          {plannedVisits.length === 0 ? (
            <p className="text-sm text-fg-tertiary">No visits scheduled in the next 7 days.</p>
          ) : (
            <ul className="space-y-2">
              {plannedVisits.map((f) => (
                <li key={f.id} className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <MapPinIcon className="h-4 w-4" />
                  </span>
                  <Link href={`/admin/prospects/${f.prospect.id}`} className="min-w-0 flex-1 truncate text-sm text-fg hover:text-brand-600">
                    <span className="font-medium">{f.prospect.businessName}</span>
                  </Link>
                  <span className="flex-shrink-0 text-xs text-fg-tertiary">{fmtDate(f.dueDate.toISOString())}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
