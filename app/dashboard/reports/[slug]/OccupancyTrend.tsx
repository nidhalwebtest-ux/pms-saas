"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { DATE_PRESETS } from "../reports-config";
import type { OccTrendReport, Granularity } from "@/lib/reports/occupancy-trend";

interface Props {
  data: OccTrendReport;
  properties: { id: string; name: string }[];
  preset: string;
  rangeText: string;
  fromDate: string;
  toDate: string;
  selectedPropertyId: string;
}

const fmt0 = (n: number) => Math.round(n).toLocaleString("en-US");
const pct0 = (n: number) => `${Math.round(n * 100)}%`;
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

export default function OccupancyTrend({ data, properties, preset, rangeText, fromDate, toDate, selectedPropertyId }: Props) {
  const router = useRouter();
  const t = useTranslations("reports");
  const tf = useTranslations("reports.filters");
  const tt = useTranslations("reports.trend");
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
    startTransition(() => router.push(`/dashboard/reports/occupancy-trend${qs ? `?${qs}` : ""}`));
  }

  const bucketLabel = (startISO: string) => {
    const d = new Date(startISO);
    if (data.granularity === "month") return d.toLocaleDateString(loc, { month: "short", year: "2-digit" });
    return d.toLocaleDateString(loc, { day: "numeric", month: "short" });
  };

  function exportCsv() {
    const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [["Period start", "Period end", "Occupied nights", "Available nights", "Occupancy %"]];
    for (const b of data.buckets) rows.push([b.start.slice(0, 10), b.end.slice(0, 10), String(b.occupiedNights), String(b.availableNights), String(Math.round(b.occupancy * 100))]);
    rows.push([]);
    rows.push(["Average", "", String(k.occupiedNights), String(k.availableNights), String(Math.round(k.avgOccupancy * 100))]);
    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `occupancy-trend-${fromDate}_${toDate}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const k = data.kpis;
  const presetItems = DATE_PRESETS.map((p) => ({ key: p.key, label: t(`presets.${p.key}`) }));
  const presetLabel = t(`presets.${preset === "custom" ? "custom" : preset}` as never);
  const buildingOptions = [allBuildings, ...properties.map((p) => p.name)];
  const grans: Granularity[] = ["day", "week", "month"];

  // ── Chart geometry ──────────────────────────────────────────────────────
  const chart = useMemo(() => {
    const PAD = { l: 38, r: 14, t: 14, b: 26 };
    const VW = 1000, VH = 300;
    const iw = VW - PAD.l - PAD.r, ih = VH - PAD.t - PAD.b;
    const n = data.buckets.length;
    const x = (i: number) => (n <= 1 ? PAD.l + iw / 2 : PAD.l + (i / (n - 1)) * iw);
    const y = (occ: number) => PAD.t + (1 - occ) * ih;
    const pts = data.buckets.map((b, i) => [x(i), y(b.occupancy)] as const);
    const line = pts.map((p, i) => `${i ? "L" : "M"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
    const base = (PAD.t + ih).toFixed(1);
    const area = n > 0 ? `M ${x(0).toFixed(1)} ${base} ${pts.map((p) => `L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ")} L ${x(n - 1).toFixed(1)} ${base} Z` : "";
    const grid = [0, 0.25, 0.5, 0.75, 1].map((g) => ({ g, yg: y(g) }));
    const labelEvery = Math.max(1, Math.ceil(n / 9));
    const xticks = data.buckets.map((b, i) => ({ i, x: x(i), show: i % labelEvery === 0 || i === n - 1, label: bucketLabel(b.start) }));
    return { PAD, VW, VH, ih, x, y, pts, line, area, grid, xticks, n, base };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.buckets, data.granularity, locale]);

  return (
    <main className="rpage">
      <div className="crumbs">
        <span>{t("breadcrumbRoot")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span>{t("groups.occupancy")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span className="current">{t("items.occupancy-trend")}</span>
      </div>

      <div className="rhead">
        <div className="title-block">
          <h1>{t("items.occupancy-trend")}</h1>
          <p className="sub">{tt("subtitle")}<span className="tag">{rangeText}</span></p>
        </div>
        <div className="rhead-actions">
          <button className="btn btn-primary btn-sm" onClick={exportCsv}><svg className="ic-sm"><use href="#i-download" /></svg>{t("actions.export")}</button>
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
          <div className="kpi-label"><span className="pulse" />{tt("kpiAvg")}</div>
          <div className="kpi-value">{pending ? <Skel w={90} h={22} /> : pct0(k.avgOccupancy)}</div>
          <div className="kpi-sub">{rangeText}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tt("kpiPeak")}</div>
          <div className="kpi-value">{pending ? <Skel w={70} h={22} /> : pct0(k.peakOccupancy)}</div>
          <div className="kpi-sub">{k.peakKey ? bucketLabel(k.peakKey) : "—"}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tt("kpiLow")}</div>
          <div className="kpi-value">{pending ? <Skel w={70} h={22} /> : pct0(k.lowOccupancy)}</div>
          <div className="kpi-sub">{k.lowKey ? bucketLabel(k.lowKey) : "—"}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tt("kpiChange")}</div>
          <div className="kpi-value" style={{ color: k.deltaPts > 0 ? "var(--success-600)" : k.deltaPts < 0 ? "var(--error-600)" : undefined }}>
            {pending ? <Skel w={60} h={22} /> : <>{k.deltaPts > 0 ? "+" : ""}{k.deltaPts.toFixed(0)}<span className="unit">{tt("pts")}</span></>}
          </div>
          <div className="kpi-sub">{tt("firstToLast")}</div>
        </div>
      </div>

      {/* Chart */}
      <section className="occ-chart" dir="ltr">
        <div className="chart-head">
          <span className="title">{tt("chartTitle")}</span>
          <div className="seg">
            {grans.map((g) => (
              <button key={g} className={data.granularity === g ? "active" : ""} onClick={() => navigate({ bucket: g })}>{tt(`gran.${g}`)}</button>
            ))}
          </div>
        </div>
        {data.buckets.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--gray-500)", fontSize: 13 }}>{tt("empty")}</div>
        ) : (
          <svg viewBox={`0 0 ${chart.VW} ${chart.VH}`} role="img" aria-label={tt("chartTitle")}>
            <defs>
              <linearGradient id="occ-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand-500)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--brand-500)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g className="grid">
              {chart.grid.map(({ g, yg }) => (
                <g key={g}>
                  <line x1={chart.PAD.l} y1={yg} x2={chart.VW - chart.PAD.r} y2={yg} />
                  <text x={chart.PAD.l - 6} y={yg + 3} textAnchor="end">{Math.round(g * 100)}</text>
                </g>
              ))}
            </g>
            {chart.area && <path className="area" d={chart.area} />}
            <path className="line" d={chart.line} />
            {chart.pts.map((p, i) => {
              const b = data.buckets[i];
              const isPeak = k.peakKey === b.key;
              return (
                <circle key={b.key} className={`dot${isPeak ? " is-peak" : ""}`} cx={p[0]} cy={p[1]} r={isPeak ? 4 : 3}>
                  <title>{`${bucketLabel(b.start)} · ${pct0(b.occupancy)} (${b.occupiedNights}/${b.availableNights})`}</title>
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
            <span className="title">{tt("tableTitle")}</span>
            <span className="meta">{tt("tableMeta", { count: data.buckets.length })}</span>
          </div>
        </div>
        <div className="rtable-scroll">
          <table className="rtable">
            <thead>
              <tr>
                <th>{tt("colPeriod")}</th>
                <th className="num">{tt("colOccupancy")}<span className="col-group">{rangeText}</span></th>
                <th className="num">{tt("colNights")}</th>
              </tr>
            </thead>
            <tbody>
              {pending ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td><Skel w={120} /></td><td className="num"><Skel w={90} /></td><td className="num"><Skel w={70} /></td></tr>
                ))
              ) : data.buckets.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: "40px", textAlign: "center", color: "var(--gray-500)" }}>{tt("empty")}</td></tr>
              ) : (
                <>
                  {data.buckets.map((b) => (
                    <tr key={b.key}>
                      <td>{bucketLabel(b.start)}</td>
                      <td className="num">
                        <span className="bar-cell"><span className="bar"><i style={{ width: `${Math.round(b.occupancy * 100)}%` }} /></span><span>{pct0(b.occupancy)}</span></span>
                      </td>
                      <td className="num dim">{b.occupiedNights}/{b.availableNights}</td>
                    </tr>
                  ))}
                  <tr className="is-grand">
                    <td>{tt("average")}</td>
                    <td className="num">{pct0(k.avgOccupancy)}</td>
                    <td className="num">{fmt0(k.occupiedNights)}/{fmt0(k.availableNights)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="rtable-footer">
          <span>{tt("footer")}</span>
          <div className="right"><span>{tt("source")}</span></div>
        </div>
      </section>
    </main>
  );
}
