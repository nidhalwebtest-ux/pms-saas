"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { downloadXlsx } from "@/lib/reports/export-xlsx";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { DATE_PRESETS } from "../reports-config";
import type { ExpReport, ExpCategory } from "@/lib/reports/expense-breakdown";

interface Props {
  data: ExpReport;
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

const DIST_COLORS = ["var(--brand-500)", "var(--warning-500)", "var(--success-500)", "var(--error-500)", "var(--gold-500)", "var(--gray-400)"];

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

export default function ExpenseBreakdown({ data, properties, preset, rangeText, fromDate, toDate, selectedPropertyId }: Props) {
  const router = useRouter();
  const t = useTranslations("reports");
  const tf = useTranslations("reports.filters");
  const te = useTranslations("reports.expenses");
  const locale = useLocale();
  const isAr = locale === "ar";
  const loc = isAr ? "ar" : "en-GB";
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(data.categories.map((c) => c.id)));

  const allBuildings = tf("allBuildings");
  const selectedBuilding = properties.find((p) => p.id === selectedPropertyId)?.name ?? allBuildings;
  const catName = (c: { name: string; nameAr: string | null }) => (isAr ? c.nameAr ?? c.name : c.name);

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
    startTransition(() => router.push(`/dashboard/reports/expense-breakdown${qs ? `?${qs}` : ""}`));
  }

  function toggle(id: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  const allOpen = expanded.size >= data.categories.length && data.categories.length > 0;

  function exportXlsx() {
    const rows = [["Category", "Expense", "Description", "Building", "Date", "Status", "Amount"]];
    for (const c of data.categories) for (const e of c.expenses) {
      rows.push([c.name, e.number, e.description, e.building, e.date.slice(0, 10), e.status, e.amount.toFixed(3)]);
    }
    rows.push([]);
    rows.push(["Total", "", "", "", "", "", k.total.toFixed(3)]);
    void downloadXlsx(rows, `expense-breakdown-${fromDate}_${toDate}`);
  }

  const k = data.kpis;
  const presetItems = DATE_PRESETS.map((p) => ({ key: p.key, label: t(`presets.${p.key}`) }));
  const presetLabel = t(`presets.${preset === "custom" ? "custom" : preset}` as never);
  const buildingOptions = [allBuildings, ...properties.map((p) => p.name)];
  const dist = useMemo(() => data.categories.map((c, i) => ({ id: c.id, label: catName(c), icon: c.icon, color: DIST_COLORS[i % DIST_COLORS.length], val: c.amount, pct: k.total > 0 ? (c.amount / k.total) * 100 : 0 })), [data.categories, k.total, isAr]);

  return (
    <main className="rpage">
      <div className="crumbs">
        <span>{t("breadcrumbRoot")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span>{t("groups.financial")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span className="current">{t("items.expense-breakdown")}</span>
      </div>

      <div className="rhead">
        <div className="title-block">
          <h1>{t("items.expense-breakdown")}</h1>
          <p className="sub">{te("subtitle")}<span className="tag">{rangeText}</span></p>
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
          <div className="kpi-label"><span className="pulse" />{te("kpiTotal")}</div>
          <div className="kpi-value">{pending ? <Skel w={90} h={22} /> : <>{fmt0(k.total)}<span className="unit">{te("omr")}</span></>}</div>
          <div className="kpi-sub">{te("expenseCount", { count: k.count })}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{te("kpiTop")}</div>
          <div className="kpi-value kpi-value small">{pending ? <Skel w={80} h={18} /> : (k.topName ? (isAr ? k.topNameAr ?? k.topName : k.topName) : "—")}</div>
          <div className="kpi-sub">{fmt0(k.topAmount)} {te("omr")}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{te("kpiAvg")}</div>
          <div className="kpi-value">{pending ? <Skel w={70} h={22} /> : <>{fmt0(k.avgPerExpense)}<span className="unit">{te("omr")}</span></>}</div>
          <div className="kpi-sub">{te("perExpense")}</div>
        </div>
        <div className="kpi-card is-warning">
          <div className="kpi-label">{te("kpiPending")}</div>
          <div className="kpi-value" style={{ color: k.pending > 0 ? "var(--warning-600)" : undefined }}>{pending ? <Skel w={70} h={22} /> : <>{fmt0(k.pending)}<span className="unit">{te("omr")}</span></>}</div>
          <div className="kpi-sub">{te("awaiting", { count: k.pendingCount })}</div>
        </div>
      </div>

      {/* Category distribution */}
      {!pending && k.total > 0 && (
        <section className="occ-chart" style={{ padding: "12px 16px" }}>
          <div className="chart-head" style={{ marginBottom: 8 }}><span className="title">{te("distribution")}</span></div>
          <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", background: "var(--gray-100)" }}>
            {dist.filter((d) => d.pct > 0).map((d) => (
              <div key={d.id} style={{ width: `${d.pct}%`, background: d.color }} title={`${d.label} · ${fmt0(d.val)} ${te("omr")} (${d.pct.toFixed(0)}%)`} />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
            {dist.map((d) => (
              <div key={d.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--gray-700)" }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color, display: "inline-block" }} />
                {d.icon ? `${d.icon} ` : ""}{d.label} <span className="mono" style={{ color: "var(--gray-500)" }}>{d.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Report table */}
      <section className="rtable-wrap">
        <div className="rtable-toolbar">
          <div className="left">
            <span className="title">{te("tableTitle")}</span>
            <span className="meta">{te("tableMeta", { count: k.categoryCount })}</span>
          </div>
          <div className="left" style={{ gap: 8 }}>
            <div className="seg">
              <button className={!allOpen ? "active" : ""} onClick={() => setExpanded(new Set())}>{te("collapseAll")}</button>
              <button className={allOpen ? "active" : ""} onClick={() => setExpanded(new Set(data.categories.map((c) => c.id)))}>{te("expandAll")}</button>
            </div>
          </div>
        </div>

        <div className="rtable-scroll">
          <table className="rtable">
            <thead>
              <tr>
                <th>{te("colName")}</th>
                <th className="num">{te("colAmount")}<span className="col-group">{rangeText}</span></th>
              </tr>
            </thead>
            <tbody>
              {pending ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td><Skel w={180} /></td><td className="num"><Skel w={80} /></td></tr>
                ))
              ) : data.categories.length === 0 ? (
                <tr><td colSpan={2} style={{ padding: "40px", textAlign: "center", color: "var(--gray-500)" }}>{te("empty")}</td></tr>
              ) : (
                <>
                  {data.categories.map((c) => (
                    <CategoryRows key={c.id} c={c} open={expanded.has(c.id)} toggle={toggle} total={k.total} label={catName(c)} locale={loc} te={te} />
                  ))}
                  <tr className="is-grand">
                    <td>{te("grandTotal", { count: k.categoryCount })}</td>
                    <td className="num">{fmt3(k.total)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="rtable-footer">
          <span>{te("footer")}</span>
          <div className="right"><span>{te("source")}</span></div>
        </div>
      </section>
    </main>
  );
}

function CategoryRows({ c, open, toggle, total, label, locale, te }: {
  c: ExpCategory; open: boolean; toggle: (id: string) => void; total: number; label: string; locale: string;
  te: (k: string, v?: Record<string, string | number>) => string;
}) {
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  const pct = total > 0 ? c.amount / total : 0;
  const hasKids = c.expenses.length > 0;
  return (
    <>
      <tr className="lvl-1">
        <td>
          {hasKids ? <Chevron open={open} onClick={() => toggle(c.id)} /> : <span className="row-leaf" />}
          <span style={{ marginInlineEnd: 6 }}>{c.icon ?? "•"}</span>{label}
          <span className="mono" style={{ color: "var(--gray-500)", fontWeight: 400, marginInlineStart: 6, fontSize: 11 }}>{te("expenseCount", { count: c.count })} · {Math.round(pct * 100)}%</span>
        </td>
        <td className="num">
          <span className="bar-cell"><span className="bar"><i style={{ width: `${pct * 100}%`, background: "var(--error-400)" }} /></span><span>{fmt3(c.amount)}</span></span>
        </td>
      </tr>
      {open && c.expenses.map((e) => (
        <tr className="lvl-2" key={e.id}>
          <td>
            <span className="row-leaf" />
            <span className={`badge ${e.status === "PROCESSED" ? "b-paid" : "b-due"}`} style={{ marginInlineEnd: 8 }}>
              <span className="dot" />{te(`status_${e.status}`)}
            </span>
            <a className="r-link" href={`/dashboard/expenses/${e.id}`}>{e.number}</a>
            {e.description ? <> · {e.description}</> : null}
            <span className="mono" style={{ color: "var(--gray-500)", fontSize: "10.5px", marginInlineStart: 6 }}>{e.building} · {fmtDate(e.date)}</span>
          </td>
          <td className="num" style={{ color: "var(--error-600)" }}>−{fmt3(e.amount)}</td>
        </tr>
      ))}
      {open && hasKids && (
        <tr className="is-total">
          <td>{te("subtotal", { name: label })}</td>
          <td className="num">{fmt3(c.amount)}</td>
        </tr>
      )}
    </>
  );
}
