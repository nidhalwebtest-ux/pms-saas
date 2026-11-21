"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { downloadXlsx } from "@/lib/reports/export-xlsx";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { DATE_PRESETS } from "../reports-config";
import type { RevTrendReport, Granularity } from "@/lib/reports/revenue-trend";

interface Props {
  data: RevTrendReport;
  properties: { id: string; name: string }[];
  preset: string;
  rangeText: string;
  fromDate: string;
  toDate: string;
  selectedPropertyId: string;
}

const fmt0 = (n: number) => Math.round(n).toLocaleString("en-US");
const fmt3 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const compact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1000) return `${n < 0 ? "-" : ""}${(a / 1000).toFixed(a % 1000 === 0 ? 0 : 1)}k`;
  return String(Math.round(n));
};
const Skel = ({ w, h = 16 }: { w: number; h?: number }) => <span className="skel" style={{ width: w, height: h, verticalAlign: "middle" }} />;

function FilterControl({
  label, value, display, options, onChange, icon, active, span2,
}: {
  label: string; value: string; display?: string; options: string[]; onChange: (v: string) => void; icon?: React.ReactNode; active?: boolean; span2?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div className={`fpanel-field${span2 ? " span-2" : ""}`}>
      <span className="fpanel-label">{label}</span>
      <div className="rdrop" ref={ref}>
        <button type="button" className={`fpanel-control${active ? " is-active" : ""}`} onClick={() => setOpen((v) => !v)}>
          {icon}<span>{display ?? value}</span><svg className="ic-xs chev"><use href="#i-chev-down" /></svg>
        </button>
        {open && (
          <div className="rdrop-menu">
            {options.map((o) => (
              <button key={o} type="button" className={`rdrop-item${o === value ? " is-selected" : ""}`} onClick={() => { onChange(o); setOpen(false); }}>
                {o}{o === value && <svg className="ic-xs check"><use href="#i-chev-right" /></svg>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RevenueTrend({ data, properties, preset, rangeText, fromDate, toDate, selectedPropertyId }: Props) {
  const router = useRouter();
  const t = useTranslations("reports");
  const tf = useTranslations("reports.filters");
  const tr = useTranslations("reports.revenue");
  const tg = useTranslations("reports.trend");
  const trt = useTranslations("reports.revTrend");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(true);

  const allBuildings = tf("allBuildings");
  const selectedBuilding = properties.find((p) => p.id === selectedPropertyId)?.name ?? allBuildings;
  const loc = locale === "ar" ? "ar" : "en-GB";

  function navigate(next: { preset?: string; propertyId?: string | null; from?: string; to?: string; bucket?: string | null }) {
    const sp = new URLSearchParams();
    const p = next.preset ?? preset;
    if (p && p !== "month") sp.set("preset", p);
    if (p === "custom") {
      const f = next.from ?? fromDate, tto = next.to ?? toDate;
      if (f) sp.set("from", f); if (tto) sp.set("to", tto);
    }
    const pid = next.propertyId === undefined ? selectedPropertyId : next.propertyId;
    if (pid) sp.set("propertyId", pid);
    const bk = next.bucket === undefined ? null : next.bucket;
    if (bk) sp.set("bucket", bk);
    const qs = sp.toString();
    startTransition(() => router.push(`/dashboard/reports/revenue-trend${qs ? `?${qs}` : ""}`));
  }

  const bucketLabel = (startISO: string) => {
    const d = new Date(startISO);
    if (data.granularity === "month") return d.toLocaleDateString(loc, { month: "short", year: "2-digit" });
    return d.toLocaleDateString(loc, { day: "numeric", month: "short" });
  };

  function exportXlsx() {
    const rows = [["Period start", "Period end", "Net (OMR)", "Invoiced", "Returns", "Transactions"]];
    for (const b of data.buckets) rows.push([b.start.slice(0, 10), b.end.slice(0, 10), b.net.toFixed(3), b.invoiced.toFixed(3), b.returned.toFixed(3), String(b.txCount)]);
    rows.push([]);
    rows.push(["Total", "", k.total.toFixed(3), k.invoiced.toFixed(3), k.returned.toFixed(3), String(k.txCount)]);
    void downloadXlsx(rows, `revenue-trend-${fromDate}_${toDate}`);
  }

  const k = data.kpis;
  const presetItems = DATE_PRESETS.map((p) => ({ key: p.key, label: t(`presets.${p.key}`) }));
  const presetLabel = t(`presets.${preset === "custom" ? "custom" : preset}` as never);
  const buildingOptions = [allBuildings, ...properties.map((p) => p.name)];
  const grans: Granularity[] = ["day", "week", "month"];

  // ── Chart geometry (money domain with a zero baseline) ──────────────────
  const chart = useMemo(() => {
    const PAD = { l: 48, r: 14, t: 14, b: 26 };
    const VW = 1000, VH = 300;
    const iw = VW - PAD.l - PAD.r, ih = VH - PAD.t - PAD.b;
    const n = data.buckets.length;
    const nets = data.buckets.map((b) => b.net);
    const rawMax = Math.max(0, ...nets), rawMin = Math.min(0, ...nets);
    const max = rawMax === 0 && rawMin === 0 ? 1 : rawMax;
    const min = rawMin;
    const span = max - min || 1;
    const x = (i: number) => (n <= 1 ? PAD.l + iw / 2 : PAD.l + (i / (n - 1)) * iw);
    const y = (v: number) => PAD.t + (1 - (v - min) / span) * ih;
    const pts = data.buckets.map((b, i) => [x(i), y(b.net)] as const);
    const line = pts.map((p, i) => `${i ? "L" : "M"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
    const baseY = y(0).toFixed(1);
    const area = n > 0 ? `M ${x(0).toFixed(1)} ${baseY} ${pts.map((p) => `L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ")} L ${x(n - 1).toFixed(1)} ${baseY} Z` : "";
    const ticks = 4;
    const grid = Array.from({ length: ticks + 1 }, (_, i) => { const v = min + (span * i) / ticks; return { v, yg: y(v) }; });
    const labelEvery = Math.max(1, Math.ceil(n / 9));
    const xticks = data.buckets.map((b, i) => ({ i, x: x(i), show: i % labelEvery === 0 || i === n - 1, label: bucketLabel(b.start) }));
    return { PAD, VW, VH, x, y, pts, line, area, grid, xticks, n, baseY };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.buckets, data.granularity, locale]);

  return (
    <main className="rpage">
      <div className="crumbs">
        <span>{t("breadcrumbRoot")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span>{t("groups.revenue")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span className="current">{t("items.revenue-trend")}</span>
      </div>

      <div className="rhead">
        <div className="title-block">
          <h1>{t("items.revenue-trend")}</h1>
          <p className="sub">{trt("subtitle")}<span className="tag">{rangeText}</span></p>
        </div>
        <div className="rhead-actions">
          <button className="btn btn-primary btn-sm" onClick={exportXlsx}><svg className="ic-sm"><use href="#i-download" /></svg>{t("actions.export")}</button>
        </div>
      </div>

      <section className={`fpanel${filtersOpen ? "" : " is-collapsed"}`}>
        <div className="fpanel-head">
          <button className="title" onClick={() => setFiltersOpen((v) => !v)} style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}>
            <svg className="ic-sm chev"><use href="#i-chev-down" /></svg>{tf("title")}
          </button>
          <span className="pill-summary">{tf("active", { count: (selectedPropertyId ? 1 : 0) + 1 })}</span>
          <div className="actions">
            <button className="link muted" onClick={() => navigate({ preset: "month", propertyId: null, bucket: null })}>{tf("reset")}</button>
          </div>
        </div>
        <div className="date-presets">
          {presetItems.map((p) => (
            <button key={p.key} className={`preset${preset === p.key ? " is-active" : ""}${p.key === "khareef" ? " is-khareef" : ""}`} onClick={() => navigate({ preset: p.key })}>{p.label}</button>
          ))}
        </div>
        <div className="fpanel-body">
          <div className="fpanel-grid cols-4">
            <FilterControl label={tf("dateRange")} span2 active icon={<svg className="ic-sm ic-cal"><use href="#i-cal" /></svg>}
              value={presetLabel} display={rangeText}
              options={presetItems.map((p) => p.label)}
              onChange={(lbl) => { const p = presetItems.find((x) => x.label === lbl); navigate({ preset: p?.key ?? "month" }); }} />
            <FilterControl label={tf("building")} span2 active={!!selectedPropertyId} icon={<svg className="ic-sm" style={{ color: "var(--brand-500)" }}><use href="#i-building" /></svg>}
              value={selectedBuilding}
              options={buildingOptions}
              onChange={(name) => { const prop = properties.find((p) => p.name === name); navigate({ propertyId: prop ? prop.id : null }); }} />
            <div className="fpanel-field">
              <span className="fpanel-label">{tf("from")}</span>
              <input type="date" className="fpanel-control" value={fromDate} max={toDate} onChange={(e) => navigate({ preset: "custom", from: e.target.value, to: toDate })} />
            </div>
            <div className="fpanel-field">
              <span className="fpanel-label">{tf("to")}</span>
              <input type="date" className="fpanel-control" value={toDate} min={fromDate} onChange={(e) => navigate({ preset: "custom", from: fromDate, to: e.target.value })} />
            </div>
          </div>
        </div>
      </section>

      {/* KPI cards */}
      <div className="kpi-row cols-4">
        <div className="kpi-card is-primary">
          <div className="kpi-label"><span className="pulse" />{tr("kpiNet")}</div>
          <div className="kpi-value">{pending ? <Skel w={90} h={22} /> : <>{fmt0(k.total)}<span className="unit">{tr("omr")}</span></>}</div>
          <div className="kpi-sub">{rangeText}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tr("kpiInvoiced")}</div>
          <div className="kpi-value">{pending ? <Skel w={80} h={22} /> : <>{fmt0(k.invoiced)}<span className="unit">{tr("omr")}</span></>}</div>
        </div>
        <div className="kpi-card is-warning">
          <div className="kpi-label">{tr("kpiReturns")}</div>
          <div className="kpi-value" style={{ color: k.returned > 0 ? "var(--error-600)" : undefined }}>{pending ? <Skel w={70} h={22} /> : <>−{fmt0(k.returned)}<span className="unit">{tr("omr")}</span></>}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{trt("kpiPeak")}</div>
          <div className="kpi-value">{pending ? <Skel w={70} h={22} /> : <>{fmt0(k.peakNet)}<span className="unit">{tr("omr")}</span></>}</div>
          <div className="kpi-sub">{k.peakKey ? bucketLabel(k.peakKey) : "—"}</div>
        </div>
      </div>

      {/* Chart */}
      <section className="occ-chart" dir="ltr">
        <div className="chart-head">
          <span className="title">{trt("chartTitle")}</span>
          <div className="seg">
            {grans.map((g) => (
              <button key={g} className={data.granularity === g ? "active" : ""} onClick={() => navigate({ bucket: g })}>{tg(`gran.${g}`)}</button>
            ))}
          </div>
        </div>
        {data.buckets.length === 0 || k.txCount === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--gray-500)", fontSize: 13 }}>{trt("empty")}</div>
        ) : (
          <svg viewBox={`0 0 ${chart.VW} ${chart.VH}`} role="img" aria-label={trt("chartTitle")}>
            <defs>
              <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand-500)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--brand-500)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g className="grid">
              {chart.grid.map(({ v, yg }, i) => (
                <g key={i}>
                  <line x1={chart.PAD.l} y1={yg} x2={chart.VW - chart.PAD.r} y2={yg} style={v === 0 ? { stroke: "var(--border-strong)" } : undefined} />
                  <text x={chart.PAD.l - 6} y={yg + 3} textAnchor="end">{compact(v)}</text>
                </g>
              ))}
            </g>
            {chart.area && <path className="area" d={chart.area} style={{ fill: "url(#rev-grad)" }} />}
            <path className="line" d={chart.line} />
            {chart.pts.map((p, i) => {
              const b = data.buckets[i];
              const isPeak = k.peakKey === b.key;
              return (
                <circle key={b.key} className={`dot${isPeak ? " is-peak" : ""}`} cx={p[0]} cy={p[1]} r={isPeak ? 4 : 3}>
                  <title>{`${bucketLabel(b.start)} · ${fmt3(b.net)} ${tr("omr")} (${b.txCount} tx)`}</title>
                </circle>
              );
            })}
            <g className="axis">
              {chart.xticks.filter((x) => x.show).map((x) => (
                <text key={x.i} x={x.x} y={chart.VH - 8} textAnchor="middle">{x.label}</text>
              ))}
            </g>
          </svg>
        )}
      </section>

      {/* Per-bucket table */}
      <section className="rtable-wrap">
        <div className="rtable-toolbar">
          <div className="left">
            <span className="title">{trt("tableTitle")}</span>
            <span className="meta">{trt("tableMeta", { count: data.buckets.length })}</span>
          </div>
        </div>
        <div className="rtable-scroll">
          <table className="rtable">
            <thead>
              <tr>
                <th>{trt("colPeriod")}</th>
                <th className="num">{tr("kpiInvoiced")}</th>
                <th className="num">{tr("kpiReturns")}</th>
                <th className="num">{trt("colNet")}<span className="col-group">{rangeText}</span></th>
              </tr>
            </thead>
            <tbody>
              {pending ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td><Skel w={120} /></td><td className="num"><Skel w={60} /></td><td className="num"><Skel w={50} /></td><td className="num"><Skel w={80} /></td></tr>
                ))
              ) : data.buckets.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: "40px", textAlign: "center", color: "var(--gray-500)" }}>{trt("empty")}</td></tr>
              ) : (
                <>
                  {data.buckets.map((b) => (
                    <tr key={b.key}>
                      <td>{bucketLabel(b.start)}</td>
                      <td className="num dim">{fmt3(b.invoiced)}</td>
                      <td className="num" style={{ color: b.returned > 0 ? "var(--error-600)" : "var(--gray-400)" }}>{b.returned > 0 ? `−${fmt3(b.returned)}` : "—"}</td>
                      <td className="num">{fmt3(b.net)}</td>
                    </tr>
                  ))}
                  <tr className="is-grand">
                    <td>{trt("total")}</td>
                    <td className="num">{fmt3(k.invoiced)}</td>
                    <td className="num" style={{ color: k.returned > 0 ? "var(--error-600)" : undefined }}>{k.returned > 0 ? `−${fmt3(k.returned)}` : "—"}</td>
                    <td className="num">{fmt3(k.total)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="rtable-footer">
          <span>{trt("footer")}</span>
          <div className="right"><span>{trt("source")}</span></div>
        </div>
      </section>
    </main>
  );
}
