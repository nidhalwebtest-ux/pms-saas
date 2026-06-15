"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { downloadXlsx } from "@/lib/reports/export-xlsx";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { DATE_PRESETS } from "../reports-config";
import type { CashReport, Granularity } from "@/lib/reports/cash-flow";

interface Props {
  data: CashReport;
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

export default function CashFlow({ data, properties, preset, rangeText, fromDate, toDate, selectedPropertyId }: Props) {
  const router = useRouter();
  const t = useTranslations("reports");
  const tf = useTranslations("reports.filters");
  const tg = useTranslations("reports.trend");
  const tc = useTranslations("reports.cashflow");
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
    startTransition(() => router.push(`/dashboard/reports/cash-flow${qs ? `?${qs}` : ""}`));
  }

  const bucketLabel = (startISO: string) => {
    const d = new Date(startISO);
    if (data.granularity === "month") return d.toLocaleDateString(loc, { month: "short", year: "2-digit" });
    return d.toLocaleDateString(loc, { day: "numeric", month: "short" });
  };

  function exportXlsx() {
    const rows = [["Period start", "Period end", "Cash in", "Expenses", "Refunds", "Net", "Cumulative"]];
    for (const b of data.buckets) rows.push([b.start.slice(0, 10), b.end.slice(0, 10), b.inflows.toFixed(3), b.expenses.toFixed(3), b.refunds.toFixed(3), b.net.toFixed(3), b.cumulative.toFixed(3)]);
    rows.push([]);
    rows.push(["Total", "", k.inflows.toFixed(3), k.expenses.toFixed(3), k.refunds.toFixed(3), k.net.toFixed(3), ""]);
    void downloadXlsx(rows, `cash-flow-${fromDate}_${toDate}`);
  }

  const k = data.kpis;
  const presetItems = DATE_PRESETS.map((p) => ({ key: p.key, label: t(`presets.${p.key}`) }));
  const presetLabel = t(`presets.${preset === "custom" ? "custom" : preset}` as never);
  const buildingOptions = [allBuildings, ...properties.map((p) => p.name)];
  const grans: Granularity[] = ["day", "week", "month"];

  // ── Chart geometry: diverging bars (inflows up, outflows down) ───────────
  const chart = useMemo(() => {
    const PAD = { l: 48, r: 14, t: 14, b: 26 };
    const VW = 1000, VH = 300;
    const iw = VW - PAD.l - PAD.r, ih = VH - PAD.t - PAD.b;
    const n = data.buckets.length;
    const maxIn = Math.max(0, ...data.buckets.map((b) => b.inflows));
    const maxOut = Math.max(0, ...data.buckets.map((b) => b.outflows));
    const top = maxIn || 1, bottom = -(maxOut || (maxIn ? 0 : 1));
    const span = top - bottom || 1;
    const colW = iw / Math.max(1, n);
    const barW = Math.max(2, Math.min(26, colW * 0.55));
    const cx = (i: number) => PAD.l + (i + 0.5) * colW;
    const y = (v: number) => PAD.t + (1 - (v - bottom) / span) * ih;
    const zeroY = y(0);
    const ticks = 4;
    const grid = Array.from({ length: ticks + 1 }, (_, i) => { const v = bottom + (span * i) / ticks; return { v, yg: y(v) }; });
    const labelEvery = Math.max(1, Math.ceil(n / 9));
    const xticks = data.buckets.map((b, i) => ({ i, x: cx(i), show: i % labelEvery === 0 || i === n - 1, label: bucketLabel(b.start) }));
    return { PAD, VW, VH, ih, cx, y, zeroY, grid, xticks, n, barW };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.buckets, data.granularity, locale]);

  const hasData = k.txCount > 0;

  return (
    <main className="rpage">
      <div className="crumbs">
        <span>{t("breadcrumbRoot")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span>{t("groups.financial")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span className="current">{t("items.cash-flow")}</span>
      </div>

      <div className="rhead">
        <div className="title-block">
          <h1>{t("items.cash-flow")}</h1>
          <p className="sub">{tc("subtitle")}<span className="tag">{rangeText}</span></p>
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
          <div className="kpi-label"><span className="pulse" />{tc("kpiNet")}</div>
          <div className="kpi-value" style={{ color: k.net > 0 ? "var(--success-600)" : k.net < 0 ? "var(--error-600)" : undefined }}>
            {pending ? <Skel w={90} h={22} /> : <>{k.net > 0 ? "+" : ""}{fmt0(k.net)}<span className="unit">{tc("omr")}</span></>}
          </div>
          <div className="kpi-sub">{rangeText}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tc("kpiIn")}</div>
          <div className="kpi-value" style={{ color: "var(--success-600)" }}>{pending ? <Skel w={80} h={22} /> : <>{fmt0(k.inflows)}<span className="unit">{tc("omr")}</span></>}</div>
        </div>
        <div className="kpi-card is-warning">
          <div className="kpi-label">{tc("kpiOut")}</div>
          <div className="kpi-value" style={{ color: k.outflows > 0 ? "var(--error-600)" : undefined }}>{pending ? <Skel w={70} h={22} /> : <>−{fmt0(k.outflows)}<span className="unit">{tc("omr")}</span></>}</div>
          <div className="kpi-sub">{tc("outSplit", { expenses: fmt0(k.expenses), refunds: fmt0(k.refunds) })}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tc("kpiPeak")}</div>
          <div className="kpi-value">{pending ? <Skel w={70} h={22} /> : <>{fmt0(k.peakNet)}<span className="unit">{tc("omr")}</span></>}</div>
          <div className="kpi-sub">{k.peakKey ? bucketLabel(k.peakKey) : "—"}</div>
        </div>
      </div>

      {/* Chart */}
      <section className="occ-chart" dir="ltr">
        <div className="chart-head">
          <span className="title">{tc("chartTitle")}</span>
          <div className="seg">
            {grans.map((g) => (
              <button key={g} className={data.granularity === g ? "active" : ""} onClick={() => navigate({ bucket: g })}>{tg(`gran.${g}`)}</button>
            ))}
          </div>
        </div>
        {!hasData ? (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--gray-500)", fontSize: 13 }}>{tc("empty")}</div>
        ) : (
          <>
            <svg viewBox={`0 0 ${chart.VW} ${chart.VH}`} role="img" aria-label={tc("chartTitle")}>
              <g className="grid">
                {chart.grid.map(({ v, yg }, i) => (
                  <g key={i}>
                    <line x1={chart.PAD.l} y1={yg} x2={chart.VW - chart.PAD.r} y2={yg} style={Math.abs(v) < 0.001 ? { stroke: "var(--border-strong)" } : undefined} />
                    <text x={chart.PAD.l - 6} y={yg + 3} textAnchor="end">{compact(v)}</text>
                  </g>
                ))}
              </g>
              {data.buckets.map((b, i) => {
                const x = chart.cx(i) - chart.barW / 2;
                const inTop = chart.y(b.inflows), inH = Math.max(0, chart.zeroY - inTop);
                const outBot = chart.y(-b.outflows), outH = Math.max(0, outBot - chart.zeroY);
                return (
                  <g key={b.key}>
                    {b.inflows > 0 && <rect x={x} y={inTop} width={chart.barW} height={inH} rx={1.5} fill="var(--success-500)"><title>{`${bucketLabel(b.start)} · +${fmt3(b.inflows)}`}</title></rect>}
                    {b.outflows > 0 && <rect x={x} y={chart.zeroY} width={chart.barW} height={outH} rx={1.5} fill="var(--error-500)"><title>{`${bucketLabel(b.start)} · −${fmt3(b.outflows)}`}</title></rect>}
                  </g>
                );
              })}
              <g className="axis">
                {chart.xticks.filter((x) => x.show).map((x) => (
                  <text key={x.i} x={x.x} y={chart.VH - 8} textAnchor="middle">{x.label}</text>
                ))}
              </g>
            </svg>
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--gray-700)" }}><span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--success-500)" }} />{tc("legendIn")}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--gray-700)" }}><span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--error-500)" }} />{tc("legendOut")}</span>
            </div>
          </>
        )}
      </section>

      {/* Per-bucket table */}
      <section className="rtable-wrap">
        <div className="rtable-toolbar">
          <div className="left">
            <span className="title">{tc("tableTitle")}</span>
            <span className="meta">{tc("tableMeta", { count: data.buckets.length })}</span>
          </div>
        </div>
        <div className="rtable-scroll">
          <table className="rtable">
            <thead>
              <tr>
                <th>{tc("colPeriod")}</th>
                <th className="num">{tc("colIn")}</th>
                <th className="num">{tc("colExpenses")}</th>
                <th className="num">{tc("colRefunds")}</th>
                <th className="num">{tc("colNet")}</th>
                <th className="num">{tc("colRunning")}</th>
              </tr>
            </thead>
            <tbody>
              {pending ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td><Skel w={110} /></td>{[0, 1, 2, 3, 4].map((j) => <td key={j} className="num"><Skel w={52} /></td>)}</tr>
                ))
              ) : data.buckets.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "var(--gray-500)" }}>{tc("empty")}</td></tr>
              ) : (
                <>
                  {data.buckets.map((b) => (
                    <tr key={b.key}>
                      <td>{bucketLabel(b.start)}</td>
                      <td className="num" style={{ color: b.inflows > 0 ? "var(--success-600)" : "var(--gray-400)" }}>{b.inflows > 0 ? fmt3(b.inflows) : "—"}</td>
                      <td className="num" style={{ color: b.expenses > 0 ? "var(--error-600)" : "var(--gray-300)" }}>{b.expenses > 0 ? `−${fmt3(b.expenses)}` : "—"}</td>
                      <td className="num" style={{ color: b.refunds > 0 ? "var(--error-600)" : "var(--gray-300)" }}>{b.refunds > 0 ? `−${fmt3(b.refunds)}` : "—"}</td>
                      <td className="num" style={{ fontWeight: 600, color: b.net > 0 ? "var(--success-600)" : b.net < 0 ? "var(--error-600)" : undefined }}>{b.net > 0 ? "+" : ""}{fmt3(b.net)}</td>
                      <td className="num dim">{fmt3(b.cumulative)}</td>
                    </tr>
                  ))}
                  <tr className="is-grand">
                    <td>{tc("total")}</td>
                    <td className="num">{fmt3(k.inflows)}</td>
                    <td className="num" style={{ color: k.expenses > 0 ? "var(--error-600)" : undefined }}>{k.expenses > 0 ? `−${fmt3(k.expenses)}` : "—"}</td>
                    <td className="num" style={{ color: k.refunds > 0 ? "var(--error-600)" : undefined }}>{k.refunds > 0 ? `−${fmt3(k.refunds)}` : "—"}</td>
                    <td className="num" style={{ color: k.net > 0 ? "var(--success-600)" : k.net < 0 ? "var(--error-600)" : undefined }}>{k.net > 0 ? "+" : ""}{fmt3(k.net)}</td>
                    <td className="num">—</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="rtable-footer">
          <span>{tc("footer")}</span>
          <div className="right"><span>{tc("source")}</span></div>
        </div>
      </section>
    </main>
  );
}
