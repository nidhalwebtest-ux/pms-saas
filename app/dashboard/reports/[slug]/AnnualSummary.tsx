"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { DATE_PRESETS } from "../reports-config";
import type { AnnualReport } from "@/lib/reports/annual-summary";

interface Props {
  data: AnnualReport;
  properties: { id: string; name: string }[];
  preset: string;
  rangeText: string;
  fromDate: string;
  toDate: string;
  selectedPropertyId: string;
}

const fmt0 = (n: number) => Math.round(n).toLocaleString("en-US");
const fmt3 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const pct0 = (n: number) => `${Math.round(n * 100)}%`;
const Skel = ({ w, h = 16 }: { w: number; h?: number }) => <span className="skel" style={{ width: w, height: h, verticalAlign: "middle" }} />;
const SOURCE_ICON: Record<string, string> = {
  walk_in: "🚶", phone: "📞", whatsapp: "💬", website: "🌐", online: "🌐", booking_com: "🏨", airbnb: "🏠", referral: "🤝", agent: "🧑‍💼", returning: "↩️", returning_guest: "↩️", corporate_contract: "🏢", other: "•",
};

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

export default function AnnualSummary({ data, properties, preset, rangeText, fromDate, toDate, selectedPropertyId }: Props) {
  const router = useRouter();
  const t = useTranslations("reports");
  const tf = useTranslations("reports.filters");
  const ta = useTranslations("reports.annual");
  const tRoot = useTranslations();
  const locale = useLocale();
  const loc = locale === "ar" ? "ar" : "en-GB";
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(true);

  const allBuildings = tf("allBuildings");
  const selectedBuilding = properties.find((p) => p.id === selectedPropertyId)?.name ?? allBuildings;
  const monthLabel = (iso: string) => new Date(iso).toLocaleDateString(loc, { month: "short" });
  const srcLabel = (s: string) => {
    const full = `tenants.sources.${s}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (tRoot as any).has(full) ? (tRoot as any)(full) : s.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  };
  const maxAbs = Math.max(1, ...data.months.map((m) => Math.max(Math.abs(m.revenue), Math.abs(m.expenses))));

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
    startTransition(() => router.push(`/dashboard/reports/annual-summary${qs ? `?${qs}` : ""}`));
  }

  function exportCsv() {
    const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [["Month", "Revenue", "Expenses", "Profit", "Cumulative"]];
    for (const m of data.months) rows.push([m.start.slice(0, 7), m.revenue.toFixed(3), m.expenses.toFixed(3), m.profit.toFixed(3), m.cumulative.toFixed(3)]);
    rows.push([]);
    rows.push(["Total", k.revenue.toFixed(3), k.expenses.toFixed(3), k.netProfit.toFixed(3), ""]);
    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `annual-summary-${fromDate}_${toDate}.csv`;
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
        <span className="current">{t("items.annual-summary")}</span>
      </div>

      <div className="rhead">
        <div className="title-block">
          <h1>{t("items.annual-summary")}</h1>
          <p className="sub">{ta("subtitle")}<span className="tag">{rangeText}</span></p>
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

      {/* Financial KPI row */}
      <div className="kpi-row cols-4">
        <div className="kpi-card is-primary">
          <div className="kpi-label"><span className="pulse" />{ta("kpiNetProfit")}</div>
          <div className="kpi-value" style={{ color: k.netProfit > 0 ? "var(--success-600)" : k.netProfit < 0 ? "var(--error-600)" : undefined }}>
            {pending ? <Skel w={90} h={22} /> : <>{k.netProfit > 0 ? "+" : ""}{fmt0(k.netProfit)}<span className="unit">{ta("omr")}</span></>}
          </div>
          <div className="kpi-sub">{ta("marginSub", { margin: k.margin === null ? "—" : pct0(k.margin) })}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{ta("kpiRevenue")}</div>
          <div className="kpi-value" style={{ color: "var(--success-600)" }}>{pending ? <Skel w={80} h={22} /> : <>{fmt0(k.revenue)}<span className="unit">{ta("omr")}</span></>}</div>
        </div>
        <div className="kpi-card is-warning">
          <div className="kpi-label">{ta("kpiExpenses")}</div>
          <div className="kpi-value" style={{ color: k.expenses > 0 ? "var(--error-600)" : undefined }}>{pending ? <Skel w={70} h={22} /> : <>−{fmt0(k.expenses)}<span className="unit">{ta("omr")}</span></>}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{ta("kpiOccupancy")}</div>
          <div className="kpi-value">{pending ? <Skel w={50} h={22} /> : pct0(k.occupancy)}</div>
          <div className="kpi-sub">{ta("nightsSub", { occupied: fmt0(k.occupiedNights), available: fmt0(k.availableNights) })}</div>
        </div>
      </div>

      {/* Operational KPI row */}
      <div className="kpi-row cols-4">
        <div className="kpi-card">
          <div className="kpi-label">{ta("kpiBookings")}</div>
          <div className="kpi-value">{pending ? <Skel w={50} h={22} /> : k.bookings}</div>
          <div className="kpi-sub">{ta("bookedValueSub", { value: fmt0(k.bookedValue) })}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{ta("kpiCancellations")}</div>
          <div className="kpi-value">{pending ? <Skel w={50} h={22} /> : k.cancellations}</div>
          <div className="kpi-sub">{ta("rateSub", { rate: pct0(k.cancellationRate) })}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{ta("kpiTopBuilding")}</div>
          <div className="kpi-value kpi-value small">{pending ? <Skel w={80} h={18} /> : (data.highlights.topBuilding?.name ?? "—")}</div>
          <div className="kpi-sub">{data.highlights.topBuilding ? `${fmt0(data.highlights.topBuilding.net)} ${ta("omr")} ${ta("net")}` : "—"}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{ta("kpiTopSource")}</div>
          <div className="kpi-value kpi-value small">{pending ? <Skel w={80} h={18} /> : (data.highlights.topSource ? `${SOURCE_ICON[data.highlights.topSource.source] ?? ""} ${srcLabel(data.highlights.topSource.source)}` : "—")}</div>
          <div className="kpi-sub">{data.highlights.topSource ? ta("bookingsN", { count: data.highlights.topSource.bookings }) : "—"}</div>
        </div>
      </div>

      {/* Monthly P&L register */}
      <section className="rtable-wrap">
        <div className="rtable-toolbar">
          <div className="left">
            <span className="title">{ta("tableTitle")}</span>
            <span className="meta">{ta("tableMeta", { count: data.months.length })}</span>
          </div>
        </div>
        <div className="rtable-scroll">
          <table className="rtable">
            <thead>
              <tr>
                <th>{ta("colMonth")}</th>
                <th className="num">{ta("colRevenue")}</th>
                <th className="num">{ta("colExpenses")}</th>
                <th className="num">{ta("colProfit")}</th>
                <th className="num">{ta("colCumulative")}</th>
              </tr>
            </thead>
            <tbody>
              {pending ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td><Skel w={80} /></td>{[0, 1, 2, 3].map((j) => <td key={j} className="num"><Skel w={56} /></td>)}</tr>
                ))
              ) : data.months.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "var(--gray-500)" }}>{ta("empty")}</td></tr>
              ) : (
                <>
                  {data.months.map((m) => (
                    <tr key={m.key}>
                      <td>{monthLabel(m.start)}</td>
                      <td className="num" style={{ color: m.revenue > 0 ? "var(--success-600)" : "var(--gray-400)" }}>
                        <span className="bar-cell"><span className="bar"><i style={{ width: `${Math.round((m.revenue / maxAbs) * 100)}%`, background: "var(--success-500)" }} /></span><span>{m.revenue ? fmt0(m.revenue) : "—"}</span></span>
                      </td>
                      <td className="num" style={{ color: m.expenses > 0 ? "var(--error-600)" : "var(--gray-300)" }}>{m.expenses > 0 ? `−${fmt0(m.expenses)}` : "—"}</td>
                      <td className="num" style={{ fontWeight: 600, color: m.profit > 0 ? "var(--success-600)" : m.profit < 0 ? "var(--error-600)" : undefined }}>{m.profit > 0 ? "+" : ""}{fmt0(m.profit)}</td>
                      <td className="num dim">{fmt0(m.cumulative)}</td>
                    </tr>
                  ))}
                  <tr className="is-grand">
                    <td>{ta("grandTotal")}</td>
                    <td className="num">{fmt3(k.revenue)}</td>
                    <td className="num" style={{ color: k.expenses > 0 ? "var(--error-600)" : undefined }}>{k.expenses > 0 ? `−${fmt3(k.expenses)}` : "—"}</td>
                    <td className="num" style={{ color: k.netProfit > 0 ? "var(--success-600)" : k.netProfit < 0 ? "var(--error-600)" : undefined }}>{k.netProfit > 0 ? "+" : ""}{fmt3(k.netProfit)}</td>
                    <td className="num">—</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="rtable-footer">
          <span>{ta("footer")}</span>
          <div className="right"><span>{ta("source")}</span></div>
        </div>
      </section>
    </main>
  );
}
