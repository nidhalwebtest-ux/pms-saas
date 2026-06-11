"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { DATE_PRESETS } from "../reports-config";
import type { PnlReport, PnlBuilding } from "@/lib/reports/pnl-by-building";

interface Props {
  data: PnlReport;
  properties: { id: string; name: string }[];
  preset: string;
  rangeText: string;
  fromDate: string;
  toDate: string;
  selectedPropertyId: string;
}

const fmt0 = (n: number) => Math.round(n).toLocaleString("en-US");
const fmt3 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const pctSigned = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${Math.round(n * 100)}%`);
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

type SortKey = "net" | "revenue" | "expenses" | "margin";

export default function PnlByBuilding({ data, properties, preset, rangeText, fromDate, toDate, selectedPropertyId }: Props) {
  const router = useRouter();
  const t = useTranslations("reports");
  const tf = useTranslations("reports.filters");
  const tp = useTranslations("reports.pnl");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: "desc" | "asc" }>({ key: "net", dir: "desc" });

  const allBuildings = tf("allBuildings");
  const selectedBuilding = properties.find((p) => p.id === selectedPropertyId)?.name ?? allBuildings;
  const isAr = locale === "ar";

  const sortedBuildings = useMemo(() => {
    const dir = sort.dir === "desc" ? -1 : 1;
    return [...data.buildings].sort((a, b) => dir * (((a[sort.key] ?? -Infinity) as number) - ((b[sort.key] ?? -Infinity) as number)));
  }, [data.buildings, sort]);

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
    startTransition(() => router.push(`/dashboard/reports/pnl-by-building${qs ? `?${qs}` : ""}`));
  }

  function toggle(id: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  const allOpen = expanded.size >= data.buildings.length && data.buildings.length > 0;

  function exportCsv() {
    const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [["Building", "Revenue", "Expenses", "Net profit", "Margin %"]];
    for (const b of sortedBuildings) rows.push([b.name, b.revenue.toFixed(3), b.expenses.toFixed(3), b.net.toFixed(3), b.margin === null ? "" : String(Math.round(b.margin * 100))]);
    rows.push([]);
    rows.push(["Total", k.revenue.toFixed(3), k.expenses.toFixed(3), k.net.toFixed(3), k.margin === null ? "" : String(Math.round(k.margin * 100))]);
    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `pnl-by-building-${fromDate}_${toDate}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const k = data.kpis;
  const presetItems = DATE_PRESETS.map((p) => ({ key: p.key, label: t(`presets.${p.key}`) }));
  const presetLabel = t(`presets.${preset === "custom" ? "custom" : preset}` as never);
  const buildingOptions = [allBuildings, ...properties.map((p) => p.name)];

  const Th = ({ k: key, label }: { k: SortKey; label: string }) => (
    <th className={`num sortable ${sort.key === key ? (sort.dir === "desc" ? "sorted-desc" : "sorted-asc") : ""}`} onClick={() => setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }))}>
      {label}<span className="sort"><svg className="ic-xs up"><use href="#i-chev-up" /></svg><svg className="ic-xs down"><use href="#i-chev-down" /></svg></span>
    </th>
  );

  return (
    <main className="rpage">
      <div className="crumbs">
        <span>{t("breadcrumbRoot")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span>{t("groups.financial")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span className="current">{t("items.pnl-by-building")}</span>
      </div>

      <div className="rhead">
        <div className="title-block">
          <h1>{t("items.pnl-by-building")}</h1>
          <p className="sub">{tp("subtitle")}<span className="tag">{rangeText}</span></p>
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

      {/* KPI cards */}
      <div className="kpi-row cols-4">
        <div className="kpi-card is-primary">
          <div className="kpi-label"><span className="pulse" />{tp("kpiNet")}</div>
          <div className="kpi-value" style={{ color: k.net > 0 ? "var(--success-600)" : k.net < 0 ? "var(--error-600)" : undefined }}>
            {pending ? <Skel w={90} h={22} /> : <>{k.net > 0 ? "+" : ""}{fmt0(k.net)}<span className="unit">{tp("omr")}</span></>}
          </div>
          <div className="kpi-sub">{tp("profitable", { count: k.profitableCount, total: k.buildingCount })}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tp("kpiRevenue")}</div>
          <div className="kpi-value" style={{ color: "var(--success-600)" }}>{pending ? <Skel w={80} h={22} /> : <>{fmt0(k.revenue)}<span className="unit">{tp("omr")}</span></>}</div>
        </div>
        <div className="kpi-card is-warning">
          <div className="kpi-label">{tp("kpiExpenses")}</div>
          <div className="kpi-value" style={{ color: k.expenses > 0 ? "var(--error-600)" : undefined }}>{pending ? <Skel w={70} h={22} /> : <>−{fmt0(k.expenses)}<span className="unit">{tp("omr")}</span></>}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tp("kpiMargin")}</div>
          <div className="kpi-value" style={{ color: (k.margin ?? 0) > 0 ? "var(--success-600)" : (k.margin ?? 0) < 0 ? "var(--error-600)" : undefined }}>
            {pending ? <Skel w={50} h={22} /> : pctSigned(k.margin)}
          </div>
        </div>
      </div>

      {/* Report table */}
      <section className="rtable-wrap">
        <div className="rtable-toolbar">
          <div className="left">
            <span className="title">{tp("tableTitle")}</span>
            <span className="meta">{tp("tableMeta", { count: k.buildingCount })}</span>
          </div>
          <div className="left" style={{ gap: 8 }}>
            <div className="seg">
              <button className={!allOpen ? "active" : ""} onClick={() => setExpanded(new Set())}>{tp("collapseAll")}</button>
              <button className={allOpen ? "active" : ""} onClick={() => setExpanded(new Set(data.buildings.map((b) => b.id)))}>{tp("expandAll")}</button>
            </div>
          </div>
        </div>

        <div className="rtable-scroll">
          <table className="rtable">
            <thead>
              <tr>
                <th>{tp("colName")}</th>
                <Th k="revenue" label={tp("colRevenue")} />
                <Th k="expenses" label={tp("colExpenses")} />
                <Th k="net" label={tp("colNet")} />
                <Th k="margin" label={tp("colMargin")} />
              </tr>
            </thead>
            <tbody>
              {pending ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td><Skel w={160} /></td>{[0, 1, 2, 3].map((j) => <td key={j} className="num"><Skel w={56} /></td>)}</tr>
                ))
              ) : data.buildings.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "var(--gray-500)" }}>{tp("empty")}</td></tr>
              ) : (
                <>
                  {sortedBuildings.map((b) => (
                    <BuildingRows key={b.id} b={b} open={expanded.has(b.id)} toggle={toggle} isAr={isAr} tp={tp} />
                  ))}
                  <tr className="is-grand">
                    <td>{tp("grandTotal", { count: k.buildingCount })}</td>
                    <td className="num">{fmt0(k.revenue)}</td>
                    <td className="num" style={{ color: k.expenses > 0 ? "var(--error-600)" : undefined }}>{k.expenses > 0 ? `−${fmt0(k.expenses)}` : "—"}</td>
                    <td className="num" style={{ color: k.net > 0 ? "var(--success-600)" : k.net < 0 ? "var(--error-600)" : undefined }}>{k.net > 0 ? "+" : ""}{fmt0(k.net)}</td>
                    <td className="num">{pctSigned(k.margin)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="rtable-footer">
          <span>{tp("footer")}</span>
          <div className="right"><span>{tp("source")}</span></div>
        </div>
      </section>
    </main>
  );
}

function BuildingRows({ b, open, toggle, isAr, tp }: {
  b: PnlBuilding; open: boolean; toggle: (id: string) => void; isAr: boolean;
  tp: (k: string, v?: Record<string, string | number>) => string;
}) {
  const hasKids = b.categories.length > 0 || b.revenue > 0;
  return (
    <>
      <tr className="lvl-1">
        <td>
          {hasKids ? <Chevron open={open} onClick={() => toggle(b.id)} /> : <span className="row-leaf" />}
          {b.name}
        </td>
        <td className="num">{fmt0(b.revenue)}</td>
        <td className="num" style={{ color: b.expenses > 0 ? "var(--error-600)" : "var(--gray-300)" }}>{b.expenses > 0 ? `−${fmt0(b.expenses)}` : "—"}</td>
        <td className="num" style={{ fontWeight: 600, color: b.net > 0 ? "var(--success-600)" : b.net < 0 ? "var(--error-600)" : undefined }}>{b.net > 0 ? "+" : ""}{fmt0(b.net)}</td>
        <td className="num" style={{ color: (b.margin ?? 0) > 0 ? "var(--success-600)" : (b.margin ?? 0) < 0 ? "var(--error-600)" : undefined }}>{pctSigned(b.margin)}</td>
      </tr>
      {open && b.revenue > 0 && (
        <tr className="lvl-2">
          <td><span className="row-leaf" /><span className="badge b-paid" style={{ marginInlineEnd: 8 }}><span className="dot" />{tp("revenueLine")}</span></td>
          <td className="num" style={{ color: "var(--success-600)" }}>{fmt3(b.revenue)}</td>
          <td className="num"><span style={{ color: "var(--gray-300)" }}>—</span></td>
          <td className="num"><span style={{ color: "var(--gray-300)" }}>—</span></td>
          <td className="num"><span style={{ color: "var(--gray-300)" }}>—</span></td>
        </tr>
      )}
      {open && b.categories.map((c) => (
        <tr className="lvl-2" key={c.id}>
          <td>
            <span className="row-leaf" />
            <span style={{ marginInlineEnd: 6 }}>{c.icon ?? "•"}</span>
            {isAr ? c.nameAr ?? c.name : c.name}
          </td>
          <td className="num"><span style={{ color: "var(--gray-300)" }}>—</span></td>
          <td className="num" style={{ color: "var(--error-600)" }}>−{fmt3(c.amount)}</td>
          <td className="num"><span style={{ color: "var(--gray-300)" }}>—</span></td>
          <td className="num"><span style={{ color: "var(--gray-300)" }}>—</span></td>
        </tr>
      ))}
      {open && hasKids && (
        <tr className="is-total">
          <td>{tp("subtotal", { name: b.name })}</td>
          <td className="num">{fmt3(b.revenue)}</td>
          <td className="num" style={{ color: b.expenses > 0 ? "var(--error-600)" : undefined }}>{b.expenses > 0 ? `−${fmt3(b.expenses)}` : "—"}</td>
          <td className="num" style={{ color: b.net > 0 ? "var(--success-600)" : b.net < 0 ? "var(--error-600)" : undefined }}>{b.net > 0 ? "+" : ""}{fmt3(b.net)}</td>
          <td className="num">{pctSigned(b.margin)}</td>
        </tr>
      )}
    </>
  );
}
