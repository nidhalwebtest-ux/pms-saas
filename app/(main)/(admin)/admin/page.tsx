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
import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";
import { FUNNEL_STAGES } from "./_lib/crm-options";
import { getCrmSettings } from "./_lib/crm-settings";
import { getAreaClassifications } from "./_lib/areas";
import { pickAreaLabel } from "./_lib/area-label";
import { fmtDate, dueState } from "./_lib/format";
import { waLink } from "@/utils/whatsapp";
import MapSection, { type AreaLegend } from "./MapSection";
import type { MapProspect } from "./ProspectsMap";

const has = (stage: string, set: string[]) => set.includes(stage);

function StatCard({
  label,
  value,
  target,
  Icon,
  accent,
  targetLabel,
}: {
  label: string;
  value: number;
  target: number;
  Icon: typeof MapPinIcon;
  accent: string;
  targetLabel: string;
}) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  return (
    <div className="rounded-2xl border border-border-default bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-xs text-fg-tertiary">{targetLabel}</span>
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
  const t = await getTranslations("admin");
  const locale = await getLocale();
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const weekAhead = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59, 999);

  const [settings, areas, prospects, mapRows, visitsCount, objectionRows, lostRows, dueRows, plannedVisits] = await Promise.all([
    getCrmSettings(),
    getAreaClassifications(),
    prisma.prospect.findMany({ select: { stage: true, interestLevel: true } }),
    prisma.prospect.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      select: { id: true, businessName: true, latitude: true, longitude: true, stage: true, tier: true, areaId: true },
    }),
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
  const foundingRemaining = Math.max(0, settings.foundingSpots - signed);

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

  // ── Map: prospects with coordinates, coloured by area ─────────────────────
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const mapProspects: MapProspect[] = mapRows.map((p) => {
    const a = p.areaId ? areaById.get(p.areaId) : undefined;
    return {
      id: p.id,
      businessName: p.businessName,
      latitude: p.latitude as number,
      longitude: p.longitude as number,
      areaLabel: a ? pickAreaLabel(locale, a.name, a.nameAr) : t("map.noArea"),
      areaColor: a?.color ?? null,
      tier: p.tier,
      stage: p.stage,
    };
  });
  const legendCounts = new Map<string, number>();
  for (const p of mapRows) if (p.areaId) legendCounts.set(p.areaId, (legendCounts.get(p.areaId) ?? 0) + 1);
  const legend: AreaLegend[] = areas
    .filter((a) => legendCounts.get(a.id))
    .map((a) => ({
      id: a.id,
      label: pickAreaLabel(locale, a.name, a.nameAr),
      color: a.color,
      count: legendCounts.get(a.id) as number,
    }));
  const unmappedCount = prospects.length - mapRows.length;

  const cards = [
    { label: t("dashboard.kpi.visits"), value: visitsCount, target: settings.targetVisits, Icon: MapPinIcon, accent: "bg-brand-50 text-brand-700" },
    { label: t("dashboard.kpi.demos"), value: demos, target: settings.targetDemos, Icon: PresentationChartLineIcon, accent: "bg-info-50 text-info-700" },
    { label: t("dashboard.kpi.interested"), value: interested, target: settings.targetInterested, Icon: HandThumbUpIcon, accent: "bg-warning-50 text-warning-700" },
    { label: t("dashboard.kpi.signed"), value: signed, target: settings.targetSigned, Icon: TrophyIcon, accent: "bg-success-50 text-success-700" },
    { label: t("dashboard.kpi.active"), value: active, target: settings.targetActive, Icon: BoltIcon, accent: "bg-brand-100 text-brand-700" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-fg">{t("dashboard.title")}</h2>
        <p className="text-sm text-fg-tertiary">{t("dashboard.subtitle")}</p>
      </div>

      {/* ── Founding spots remaining (scarcity number) ─────────────── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t("dashboard.founding.label")}</p>
          <p className="mt-1 text-sm text-fg-secondary">
            {t("dashboard.founding.sub", { total: settings.foundingSpots })}
          </p>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-extrabold tabular-nums text-brand-600">{foundingRemaining}</span>
          <span className="text-sm text-fg-tertiary">{t("dashboard.founding.left", { total: settings.foundingSpots })}</span>
        </div>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} targetLabel={t("dashboard.kpi.target", { n: c.target })} />
        ))}
      </div>

      {/* ── Prospects map ──────────────────────────────────────────── */}
      <MapSection prospects={mapProspects} legend={legend} unmappedCount={unmappedCount} />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Funnel ───────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border-default bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-fg">{t("dashboard.funnel.title")}</h3>
          <ul className="space-y-2">
            {stageCounts.map(({ stage, count }) => (
              <li key={stage} className="flex items-center gap-3">
                <span className="w-28 flex-shrink-0 text-xs text-fg-secondary">{t(`enums.stage.${stage}`)}</span>
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
          <h3 className="mb-3 text-sm font-semibold text-fg">{t("dashboard.objections.title")}</h3>
          {patterns.length === 0 ? (
            <p className="text-sm text-fg-tertiary">{t("dashboard.objections.empty")}</p>
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
            <h3 className="text-sm font-semibold text-fg">{t("dashboard.due.title")}</h3>
            <Link href="/admin/followups" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
              {t("dashboard.due.openQueue")} <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
          {dueRows.length === 0 ? (
            <p className="text-sm text-fg-tertiary">{t("dashboard.due.empty")}</p>
          ) : (
            <ul className="space-y-2">
              {dueRows.map((f) => {
                const overdue = dueState(f.dueDate.toISOString()) === "overdue";
                const wa = f.channel === "WHATSAPP" ? waLink(f.prospect.phone, f.purpose ?? undefined) : null;
                return (
                  <li key={f.id} className="flex items-center gap-2">
                    <Badge tone={overdue ? "danger" : "warning"} appearance="solid" size="sm">
                      {overdue ? fmtDate(f.dueDate.toISOString()) : t("followups.badge.today")}
                    </Badge>
                    <Link href={`/admin/prospects/${f.prospect.id}`} className="min-w-0 flex-1 truncate text-sm text-fg hover:text-brand-600">
                      <span className="font-medium">{f.prospect.businessName}</span>
                      <span className="text-fg-tertiary"> · {f.purpose ?? t(`enums.channel.${f.channel}`)}</span>
                    </Link>
                    {wa && (
                      <a href={wa} target="_blank" rel="noopener noreferrer" className="text-success-600 hover:text-success-700" title={t("queue.whatsapp")}>
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
          <h3 className="mb-3 text-sm font-semibold text-fg">{t("dashboard.planned.title")}</h3>
          {plannedVisits.length === 0 ? (
            <p className="text-sm text-fg-tertiary">{t("dashboard.planned.empty")}</p>
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
