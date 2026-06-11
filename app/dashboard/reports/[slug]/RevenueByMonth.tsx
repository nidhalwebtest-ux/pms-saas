"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { DATE_PRESETS } from "../reports-config";
import type { RevByMonthReport } from "@/lib/reports/revenue-by-month";

interface Props {
  data: RevByMonthReport;
  properties: { id: string; name: string }[];
  preset: string;
  rangeText: string;
  fromDate: string;
  toDate: string;
  selectedPropertyId: string;
}

const fmt0 = (n: number) => Math.round(n).toLocaleString("en-US");
const fmt3 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
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

export default function RevenueByMonth({ data, properties, preset, rangeText, fromDate, toDate, selectedPropertyId }: Props) {
  const router = useRouter();
  const t = useTranslations("reports");
  const tf = useTranslations("reports.filters");
  const tr = useTranslations("reports.revenue");
  const tm = useTranslations("reports.revMonth");
  const locale = useLocale();
  const loc = locale === "ar" ? "ar" : "en-GB";
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(true);

  const allBuildings = tf("allBuildings");
  const selectedBuilding = properties.find((p) => p.id === selectedPropertyId)?.name ?? allBuildings;
  const monthLabel = (iso: string) => new Date(iso).toLocaleDateString(loc, { month: "long", year: "numeric" });
  const maxNet = Math.max(1, ...data.months.map((m) => Math.abs(m.net)));

  function navigate(next: { preset?: string; propertyId?: string | null; from?: string; to?: string }) {
    const sp = new URLSearchParams();
    const p = next.preset ?? preset;
    if (p && p !== "year") sp.set("preset", p);
    if (p === "custom") {
      const f = next.from ?? fromDate, tt = next.to ?? toDate;
      if (f) sp.set("from", f); if (tt) sp.set("to", tt);
    }
    const pid = next.propertyId === undefined ? selectedPropertyId : next.propertyId;
    if (pid) sp.set("propertyId", pid);
    const qs = sp.toString();
    startTransition(() => router.push(`/dashboard/reports/revenue-by-month${qs ? `?${qs}` : ""}`));
  }

  function exportCsv() {
    const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [["Month", "Invoices", "Invoiced", "Returns", "Net revenue", "Cumulative"]];
    for (const m of data.months) rows.push([m.start.slice(0, 7), String(m.txCount), m.invoiced.toFixed(3), m.returned.toFixed(3), m.net.toFixed(3), m.cumulative.toFixed(3)]);
    rows.push([]);
    rows.push(["Total", String(k.txCount), k.invoiced.toFixed(3), k.returned.toFixed(3), k.total.toFixed(3), ""]);
    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `revenue-by-month-${fromDate}_${toDate}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const k = data.kpis;
  const presetItems = DATE_PRESETS.map((p) => ({ key: p.key, label: t(`presets.${p.key}`) }));
  const presetLabel = t(`presets.${preset === "custom" ? "custom" : preset}` as never);
  const buildingOptions = [allBuildings, ...properties.map((p) => p.name)];

  return (
    <main className="rpage">
      <div className="crumbs">
        <span>{t("breadcrumbRoot")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span>{t("groups.tax")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span className="current">{t("items.revenue-by-month")}</span>
      </div>

      <div className="rhead">
        <div className="title-block">
          <h1>{t("items.revenue-by-month")}</h1>
          <p className="sub">{tm("subtitle")}<span className="tag">{rangeText}</span></p>
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
            <button className="link muted" onClick={() => navigate({ preset: "year", propertyId: null })}>{tf("reset")}</button>
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
              onChange={(lbl) => { const p = presetItems.find((x) => x.label === lbl); navigate({ preset: p?.key ?? "year" }); }} />
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
          <div className="kpi-label">{tm("kpiAvg")}</div>
          <div className="kpi-value">{pending ? <Skel w={70} h={22} /> : <>{fmt0(k.avgPerMonth)}<span className="unit">{tr("omr")}</span></>}</div>
          <div className="kpi-sub">{tm("perMonth")}</div>
        </div>
      </div>

      {/* Monthly register */}
      <section className="rtable-wrap">
        <div className="rtable-toolbar">
          <div className="left">
            <span className="title">{tm("tableTitle")}</span>
            <span className="meta">{tm("tableMeta", { count: data.months.length })}</span>
          </div>
        </div>
        <div className="rtable-scroll">
          <table className="rtable">
            <thead>
              <tr>
                <th>{tm("colMonth")}</th>
                <th className="num">{tm("colInvoices")}</th>
                <th className="num">{tr("kpiInvoiced")}</th>
                <th className="num">{tr("kpiReturns")}</th>
                <th className="num">{tm("colNet")}</th>
                <th className="num">{tm("colCumulative")}</th>
              </tr>
            </thead>
            <tbody>
              {pending ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td><Skel w={120} /></td>{[0, 1, 2, 3, 4].map((j) => <td key={j} className="num"><Skel w={52} /></td>)}</tr>
                ))
              ) : data.months.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "var(--gray-500)" }}>{tm("empty")}</td></tr>
              ) : (
                <>
                  {data.months.map((m) => (
                    <tr key={m.key}>
                      <td>{monthLabel(m.start)}</td>
                      <td className="num dim">{m.txCount || <span style={{ color: "var(--gray-300)" }}>—</span>}</td>
                      <td className="num dim">{m.invoiced > 0 ? fmt3(m.invoiced) : "—"}</td>
                      <td className="num" style={{ color: m.returned > 0 ? "var(--error-600)" : "var(--gray-300)" }}>{m.returned > 0 ? `−${fmt3(m.returned)}` : "—"}</td>
                      <td className="num">
                        <span className="bar-cell"><span className="bar"><i style={{ width: `${Math.round((Math.abs(m.net) / maxNet) * 100)}%`, background: m.net < 0 ? "var(--error-400)" : "var(--brand-400)" }} /></span><span style={{ fontWeight: 600 }}>{fmt3(m.net)}</span></span>
                      </td>
                      <td className="num dim">{fmt3(m.cumulative)}</td>
                    </tr>
                  ))}
                  <tr className="is-grand">
                    <td>{tm("grandTotal")}</td>
                    <td className="num">{k.txCount}</td>
                    <td className="num">{fmt3(k.invoiced)}</td>
                    <td className="num" style={{ color: k.returned > 0 ? "var(--error-600)" : undefined }}>{k.returned > 0 ? `−${fmt3(k.returned)}` : "—"}</td>
                    <td className="num">{fmt3(k.total)}</td>
                    <td className="num">—</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="rtable-footer">
          <span>{tm("footer")}</span>
          <div className="right"><span>{tm("source")}</span></div>
        </div>
      </section>
    </main>
  );
}
