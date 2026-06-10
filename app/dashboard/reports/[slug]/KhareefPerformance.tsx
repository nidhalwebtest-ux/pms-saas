"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { DATE_PRESETS } from "../reports-config";
import type { KhareefReport } from "@/lib/reports/khareef-performance";

interface Props {
  data: KhareefReport;
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

type SortKey = "revenue" | "occupancy" | "adr" | "stays";

export default function KhareefPerformance({ data, properties, preset, rangeText, fromDate, toDate, selectedPropertyId }: Props) {
  const router = useRouter();
  const t = useTranslations("reports");
  const tf = useTranslations("reports.filters");
  const tr = useTranslations("reports.revenue");
  const tk = useTranslations("reports.khareef");
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: "desc" | "asc" }>({ key: "revenue", dir: "desc" });

  const allBuildings = tf("allBuildings");
  const selectedBuilding = properties.find((p) => p.id === selectedPropertyId)?.name ?? allBuildings;

  const sortedBuildings = useMemo(() => {
    const dir = sort.dir === "desc" ? -1 : 1;
    return [...data.buildings].sort((a, b) => dir * ((a[sort.key] as number) - (b[sort.key] as number)));
  }, [data.buildings, sort]);
  const maxRevenue = useMemo(() => Math.max(1, ...data.buildings.map((b) => b.revenue)), [data.buildings]);

  function navigate(next: { preset?: string; propertyId?: string | null; from?: string; to?: string }) {
    const sp = new URLSearchParams();
    const p = next.preset ?? preset;
    if (p && p !== "khareef") sp.set("preset", p);
    if (p === "custom") {
      const f = next.from ?? fromDate, tt = next.to ?? toDate;
      if (f) sp.set("from", f); if (tt) sp.set("to", tt);
    }
    const pid = next.propertyId === undefined ? selectedPropertyId : next.propertyId;
    if (pid) sp.set("propertyId", pid);
    const qs = sp.toString();
    startTransition(() => router.push(`/dashboard/reports/khareef-performance${qs ? `?${qs}` : ""}`));
  }

  function setSortKey(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  }

  function exportCsv() {
    const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [["Building", "Units", "Occupancy %", "Occupied nights", "Revenue (OMR)", "ADR (OMR)", "Stays"]];
    for (const b of sortedBuildings) rows.push([b.name, String(b.unitCount), String(Math.round(b.occupancy * 100)), String(b.occupiedNights), b.revenue.toFixed(3), b.adr.toFixed(3), String(b.stays)]);
    rows.push([]);
    rows.push(["Total", String(k.unitCount), String(Math.round(k.occupancy * 100)), String(k.occupiedNights), k.revenue.toFixed(3), k.adr.toFixed(3), String(k.stays)]);
    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `khareef-performance-${fromDate}_${toDate}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const k = data.kpis;
  const presetItems = DATE_PRESETS.map((p) => ({ key: p.key, label: t(`presets.${p.key}`) }));
  const presetLabel = t(`presets.${preset === "custom" ? "custom" : preset}` as never);
  const buildingOptions = [allBuildings, ...properties.map((p) => p.name)];

  const Th = ({ k: key, label }: { k: SortKey; label: string }) => (
    <th className={`num sortable ${sort.key === key ? (sort.dir === "desc" ? "sorted-desc" : "sorted-asc") : ""}`} onClick={() => setSortKey(key)}>
      {label}
      <span className="sort"><svg className="ic-xs up"><use href="#i-chev-up" /></svg><svg className="ic-xs down"><use href="#i-chev-down" /></svg></span>
    </th>
  );

  return (
    <main className="rpage">
      <div className="crumbs">
        <span>{t("breadcrumbRoot")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span>{t("groups.occupancy")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span className="current">{t("items.khareef-performance")}</span>
      </div>

      <div className="rhead">
        <div className="title-block">
          <h1>{t("items.khareef-performance")}</h1>
          <p className="sub">{tk("subtitle")}<span className="tag is-khareef">{rangeText}</span></p>
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
            <button className="link muted" onClick={() => navigate({ preset: "khareef", propertyId: null })}>{tf("reset")}</button>
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
              onChange={(lbl) => { const p = presetItems.find((x) => x.label === lbl); navigate({ preset: p?.key ?? "khareef" }); }} />
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
          <div className="kpi-label"><span className="pulse" />{tk("kpiRevenue")}</div>
          <div className="kpi-value">{pending ? <Skel w={90} h={22} /> : <>{fmt0(k.revenue)}<span className="unit">{tr("omr")}</span></>}</div>
          <div className="kpi-sub">{rangeText}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tk("kpiOccupancy")}</div>
          <div className="kpi-value">{pending ? <Skel w={60} h={22} /> : pct0(k.occupancy)}</div>
          <div className="kpi-sub">{tk("occupiedNights", { count: k.occupiedNights })}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tk("kpiAdr")}</div>
          <div className="kpi-value">{pending ? <Skel w={70} h={22} /> : <>{fmt0(k.adr)}<span className="unit">{tr("omr")}</span></>}</div>
          <div className="kpi-sub">{tk("perNight")}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tk("kpiStays")}</div>
          <div className="kpi-value">{pending ? <Skel w={40} h={22} /> : k.stays}</div>
          <div className="kpi-sub">{tk("arrivals")}</div>
        </div>
      </div>

      {/* Report table */}
      <section className="rtable-wrap">
        <div className="rtable-toolbar">
          <div className="left">
            <span className="title">{tk("tableTitle")}</span>
            <span className="meta">{tk("tableMeta", { count: k.buildingCount })}</span>
          </div>
        </div>
        <div className="rtable-scroll">
          <table className="rtable">
            <thead>
              <tr>
                <th>{tk("colName")}</th>
                <Th k="occupancy" label={tk("colOccupancy")} />
                <Th k="revenue" label={tk("colRevenue")} />
                <Th k="adr" label={tk("colAdr")} />
                <Th k="stays" label={tk("colStays")} />
              </tr>
            </thead>
            <tbody>
              {pending ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td><Skel w={160} /></td><td className="num"><Skel w={70} /></td><td className="num"><Skel w={70} /></td><td className="num"><Skel w={50} /></td><td className="num"><Skel w={30} /></td></tr>
                ))
              ) : data.buildings.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "var(--gray-500)" }}>{tk("empty")}</td></tr>
              ) : (
                <>
                  {sortedBuildings.map((b) => (
                    <tr key={b.id} className="lvl-1">
                      <td>
                        {b.name} <span className="mono" style={{ color: "var(--gray-500)", fontWeight: 400, marginInlineStart: 6, fontSize: 11 }}>{tk("unitsCount", { count: b.unitCount })}</span>
                      </td>
                      <td className="num">
                        <span className="bar-cell"><span className="bar"><i style={{ width: `${Math.round(b.occupancy * 100)}%` }} /></span><span>{pct0(b.occupancy)}</span></span>
                      </td>
                      <td className="num">
                        <span className="bar-cell"><span className="bar"><i style={{ width: `${Math.round((b.revenue / maxRevenue) * 100)}%`, background: "var(--success-500)" }} /></span><span>{fmt3(b.revenue)}</span></span>
                      </td>
                      <td className="num dim">{fmt3(b.adr)}</td>
                      <td className="num dim">{b.stays}</td>
                    </tr>
                  ))}
                  <tr className="is-grand">
                    <td>{tk("grandTotal", { count: k.buildingCount })}</td>
                    <td className="num">{pct0(k.occupancy)}</td>
                    <td className="num">{fmt3(k.revenue)}</td>
                    <td className="num">{fmt3(k.adr)}</td>
                    <td className="num">{k.stays}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="rtable-footer">
          <span>{tk("footer")}</span>
          <div className="right"><span>{tk("source")}</span></div>
        </div>
      </section>
    </main>
  );
}
