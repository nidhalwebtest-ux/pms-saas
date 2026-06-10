"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { DATE_PRESETS } from "../reports-config";
import type { RevReport, RevBuilding, RevUnit } from "@/lib/reports/revenue-by-building";

interface Props {
  data: RevReport;
  properties: { id: string; name: string }[];
  preset: string;
  rangeText: string;
  fromDate: string;
  toDate: string;
  selectedPropertyId: string;
}

const fmt3 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const fmt0 = (n: number) => Math.round(n).toLocaleString("en-US");
const Skel = ({ w, h = 16 }: { w: number; h?: number }) => <span className="skel" style={{ width: w, height: h, verticalAlign: "middle" }} />;

function Chevron({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <span className={`row-chev${open ? " is-open" : ""}`} role="button" tabIndex={0}
      onClick={onClick} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}>
      <svg className="ic-xs"><use href="#i-chev-right" /></svg>
    </span>
  );
}

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

export default function RevenueByBuilding({ data, properties, preset, rangeText, fromDate, toDate, selectedPropertyId }: Props) {
  const router = useRouter();
  const t = useTranslations("reports");
  const tf = useTranslations("reports.filters");
  const tr = useTranslations("reports.revenue");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [level, setLevel] = useState<"collapse" | "l2" | "l3" | "expand">("l2");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(data.buildings.map((b) => b.id)));
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const allBuildings = tf("allBuildings");
  const selectedBuilding = properties.find((p) => p.id === selectedPropertyId)?.name ?? allBuildings;

  const sortedBuildings = useMemo(() => {
    const dir = sortDir === "desc" ? -1 : 1;
    return [...data.buildings]
      .map((b) => ({ ...b, units: [...b.units].sort((a, c) => dir * (a.revenue - c.revenue)) }))
      .sort((a, c) => dir * (a.revenue - c.revenue));
  }, [data.buildings, sortDir]);

  function navigate(next: { preset?: string; propertyId?: string | null; from?: string; to?: string }) {
    const sp = new URLSearchParams();
    const p = next.preset ?? preset;
    if (p && p !== "month") sp.set("preset", p);
    if (p === "custom") {
      const f = next.from ?? fromDate, tt = next.to ?? toDate;
      if (f) sp.set("from", f); if (tt) sp.set("to", tt);
    }
    const pid = next.propertyId === undefined ? selectedPropertyId : next.propertyId;
    if (pid) sp.set("propertyId", pid);
    const qs = sp.toString();
    startTransition(() => router.push(`/dashboard/reports/revenue-by-building${qs ? `?${qs}` : ""}`));
  }

  function applyLevel(l: typeof level) {
    setLevel(l);
    if (l === "collapse") setExpanded(new Set());
    else if (l === "l2") setExpanded(new Set(data.buildings.map((b) => b.id)));
    else setExpanded(new Set([...data.buildings.map((b) => b.id), ...data.buildings.flatMap((b) => b.units.map((u) => u.id))]));
  }
  function toggle(id: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function exportCsv() {
    const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [["Building", "Unit", "Type", "Number", "Date", "Guest", "Reservation", "Amount (OMR)"]];
    for (const b of sortedBuildings) for (const u of b.units) for (const tx of u.transactions) {
      rows.push([b.name, u.name, tx.kind, tx.number, tx.date.slice(0, 10), tx.guest, tx.reservationRef ?? "", tx.amount.toFixed(3)]);
    }
    rows.push([]);
    rows.push(["", "", "", "", "", "", "Net total", k.totalRevenue.toFixed(3)]);
    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `revenue-by-building-${fromDate}_${toDate}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const k = data.kpis;
  const presetItems = DATE_PRESETS.map((p) => ({ key: p.key, label: t(`presets.${p.key}`) }));
  const presetLabel = t(`presets.${preset === "custom" ? "custom" : preset}` as never);
  const buildingOptions = [allBuildings, ...properties.map((p) => p.name)];
  const barPct = (v: number) => (k.totalRevenue > 0 ? Math.max(0, Math.min(1, v / k.totalRevenue)) : 0);

  return (
    <main className="rpage">
      <div className="crumbs">
        <span>{t("breadcrumbRoot")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span>{t("groups.revenue")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span className="current">{t("items.revenue-by-building")}</span>
      </div>

      <div className="rhead">
        <div className="title-block">
          <h1>{t("items.revenue-by-building")}</h1>
          <p className="sub">{tr("subtitle")}<span className="tag">{rangeText}</span></p>
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
            <button className="link muted" onClick={() => navigate({ preset: "month", propertyId: null })}>{tf("reset")}</button>
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

      {/* KPI cards — netting story */}
      <div className="kpi-row cols-4">
        <div className="kpi-card is-primary">
          <div className="kpi-label"><span className="pulse" />{tr("kpiNet")}</div>
          <div className="kpi-value">{pending ? <Skel w={90} h={22} /> : <>{fmt0(k.totalRevenue)}<span className="unit">{tr("omr")}</span></>}</div>
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
          <div className="kpi-label">{tr("kpiTxns")}</div>
          <div className="kpi-value">{pending ? <Skel w={40} h={22} /> : k.txCount}</div>
        </div>
      </div>

      {/* Report table */}
      <section className="rtable-wrap">
        <div className="rtable-toolbar">
          <div className="left">
            <span className="title">{tr("tableTitle")}</span>
            <span className="meta">{tr("tableMeta", { count: k.buildingCount })}</span>
          </div>
          <div className="left" style={{ gap: 8 }}>
            <div className="seg">
              <button className={level === "collapse" ? "active" : ""} onClick={() => applyLevel("collapse")}>{tr("collapseAll")}</button>
              <button className={level === "l2" ? "active" : ""} onClick={() => applyLevel("l2")}>{tr("level", { n: 2 })}</button>
              <button className={level === "l3" ? "active" : ""} onClick={() => applyLevel("l3")}>{tr("level", { n: 3 })}</button>
              <button className={level === "expand" ? "active" : ""} onClick={() => applyLevel("expand")}>{tr("expandAll")}</button>
            </div>
          </div>
        </div>

        <div className="rtable-scroll">
          <table className="rtable">
            <thead>
              <tr>
                <th>{tr("colName")}</th>
                <th className={`num sortable ${sortDir === "desc" ? "sorted-desc" : "sorted-asc"}`} onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}>
                  {tr("colRevenue")}<span className="col-group">{rangeText}</span>
                  <span className="sort"><svg className="ic-xs up"><use href="#i-chev-up" /></svg><svg className="ic-xs down"><use href="#i-chev-down" /></svg></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pending ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td><Skel w={180} /></td><td className="num"><Skel w={90} /></td></tr>
                ))
              ) : data.buildings.length === 0 ? (
                <tr><td colSpan={2} style={{ padding: "40px", textAlign: "center", color: "var(--gray-500)" }}>{tr("empty")}</td></tr>
              ) : (
                <>
                  {sortedBuildings.map((b) => (
                    <BuildingRows key={b.id} b={b} open={expanded.has(b.id)} expanded={expanded} toggle={toggle} unitsLabel={(n) => tr("unitsCount", { count: n })} subtotalLabel={(name) => tr("subtotal", { name })} barPct={barPct} pctLabel={(p) => tr("ofTotal", { pct: p })} locale={locale} />
                  ))}
                  <tr className="is-grand">
                    <td>{tr("grandTotal", { count: k.buildingCount })}</td>
                    <td className="num">{fmt3(k.totalRevenue)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="rtable-footer">
          <span>{tr("footer")}</span>
          <div className="right"><span>{tr("source")}</span></div>
        </div>
      </section>
    </main>
  );
}

function BuildingRows({ b, open, expanded, toggle, unitsLabel, subtotalLabel, barPct, pctLabel, locale }: {
  b: RevBuilding; open: boolean; expanded: Set<string>; toggle: (id: string) => void;
  unitsLabel: (n: number) => string; subtotalLabel: (name: string) => string;
  barPct: (v: number) => number; pctLabel: (p: string) => string; locale: string;
}) {
  const pct = barPct(b.revenue);
  return (
    <>
      <tr className="lvl-1">
        <td>
          <Chevron open={open} onClick={() => toggle(b.id)} />
          {b.name} <span className="mono" style={{ color: "var(--gray-500)", fontWeight: 400, marginInlineStart: 6, fontSize: 11 }}>{unitsLabel(b.unitCount)} · {pctLabel((pct * 100).toFixed(0))}</span>
        </td>
        <td className="num">
          <span className="bar-cell"><span className="bar"><i style={{ width: `${pct * 100}%` }} /></span><span>{fmt3(b.revenue)}</span></span>
        </td>
      </tr>
      {open && b.units.map((u) => (
        <UnitRows key={u.id} u={u} open={expanded.has(u.id)} toggle={toggle} locale={locale} />
      ))}
      {open && (
        <tr className="is-total">
          <td>{subtotalLabel(b.name)}</td>
          <td className="num">{fmt3(b.revenue)}</td>
        </tr>
      )}
    </>
  );
}

function UnitRows({ u, open, toggle, locale }: { u: RevUnit; open: boolean; toggle: (id: string) => void; locale: string }) {
  const tr = useTranslations("reports.revenue");
  const hasKids = u.transactions.length > 0;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale === "ar" ? "ar" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
  return (
    <>
      <tr className="lvl-2">
        <td>
          {hasKids ? <Chevron open={open} onClick={() => toggle(u.id)} /> : <span className="row-leaf" />}
          {u.name}
        </td>
        <td className="num">{fmt3(u.revenue)}</td>
      </tr>
      {open && hasKids && u.transactions.map((tx) => {
        const isReturn = tx.kind === "return";
        const href = isReturn ? `/dashboard/returns/${tx.refId}` : `/dashboard/invoices/${tx.refId}`;
        return (
          <tr className="lvl-3" key={tx.id}>
            <td>
              <span className="row-leaf" />
              <span className={`badge ${isReturn ? "b-due" : "b-paid"}`} style={{ marginInlineEnd: 8 }}>
                <span className="dot" />{isReturn ? tr("txReturn") : tr("txInvoice")}
              </span>
              <a className="r-link" href={href}>{tx.number}</a>
              {tx.guest && tx.guest !== "—" ? <> · {tx.guest}</> : null}
              <span className="mono" style={{ color: "var(--gray-500)", fontSize: "10.5px", marginInlineStart: 6 }}>{fmtDate(tx.date)}</span>
            </td>
            <td className="num" style={isReturn ? { color: "var(--error-600)" } : undefined}>{fmt3(tx.amount)}</td>
          </tr>
        );
      })}
    </>
  );
}
