"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { downloadXlsx } from "@/lib/reports/export-xlsx";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { DATE_PRESETS } from "../reports-config";
import type { CmpReport } from "@/lib/reports/revenue-comparison";

interface Props {
  data: CmpReport;
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

function DeltaCell({ delta, deltaPct, newLabel }: { delta: number; deltaPct: number | null; newLabel: string }) {
  const color = delta > 0 ? "var(--success-600)" : delta < 0 ? "var(--error-600)" : "var(--gray-500)";
  const arrow = delta > 0 ? "#i-chev-up" : delta < 0 ? "#i-chev-down" : null;
  return (
    <span style={{ color, display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
      {arrow && <svg className="ic-xs"><use href={arrow} /></svg>}
      {delta > 0 ? "+" : ""}{fmt3(delta)}
      <span style={{ fontSize: 10.5, opacity: 0.8 }}>{deltaPct === null ? (delta > 0 ? newLabel : "") : `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(0)}%`}</span>
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

type SortKey = "current" | "prior" | "delta";

export default function RevenueComparison({ data, properties, preset, rangeText, fromDate, toDate, selectedPropertyId }: Props) {
  const router = useRouter();
  const t = useTranslations("reports");
  const tf = useTranslations("reports.filters");
  const tr = useTranslations("reports.revenue");
  const tc = useTranslations("reports.cmp");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: "desc" | "asc" }>({ key: "current", dir: "desc" });

  const allBuildings = tf("allBuildings");
  const selectedBuilding = properties.find((p) => p.id === selectedPropertyId)?.name ?? allBuildings;
  const loc = locale === "ar" ? "ar" : "en-GB";
  const fmtRange = (a: string, b: string) => {
    const o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
    return `${new Date(a).toLocaleDateString(loc, { day: "numeric", month: "short" })} – ${new Date(b).toLocaleDateString(loc, o)}`;
  };
  const priorRangeText = fmtRange(data.priorFrom, data.priorTo);

  const sortedBuildings = useMemo(() => {
    const dir = sort.dir === "desc" ? -1 : 1;
    return [...data.buildings].sort((a, b) => dir * ((a[sort.key] as number) - (b[sort.key] as number)));
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
    startTransition(() => router.push(`/dashboard/reports/revenue-comparison${qs ? `?${qs}` : ""}`));
  }

  function setSortKey(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  }

  function exportXlsx() {
    const rows = [["Building", "Prior (OMR)", "Current (OMR)", "Delta", "Delta %"]];
    for (const b of sortedBuildings) rows.push([b.name, b.prior.toFixed(3), b.current.toFixed(3), b.delta.toFixed(3), b.deltaPct === null ? "" : `${b.deltaPct}`]);
    rows.push([]);
    rows.push(["Total", k.prior.toFixed(3), k.current.toFixed(3), k.delta.toFixed(3), k.deltaPct === null ? "" : `${k.deltaPct}`]);
    void downloadXlsx(rows, `revenue-comparison-${fromDate}_${toDate}`);
  }

  const k = data.kpis;
  const presetItems = DATE_PRESETS.map((p) => ({ key: p.key, label: t(`presets.${p.key}`) }));
  const presetLabel = t(`presets.${preset === "custom" ? "custom" : preset}` as never);
  const buildingOptions = [allBuildings, ...properties.map((p) => p.name)];
  const newLabel = tc("new");

  const Th = ({ k: key, label, group }: { k: SortKey; label: string; group?: string }) => (
    <th className={`num sortable ${sort.key === key ? (sort.dir === "desc" ? "sorted-desc" : "sorted-asc") : ""}`} onClick={() => setSortKey(key)}>
      {label}{group && <span className="col-group">{group}</span>}
      <span className="sort"><svg className="ic-xs up"><use href="#i-chev-up" /></svg><svg className="ic-xs down"><use href="#i-chev-down" /></svg></span>
    </th>
  );

  return (
    <main className="rpage">
      <div className="crumbs">
        <span>{t("breadcrumbRoot")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span>{t("groups.revenue")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span className="current">{t("items.revenue-comparison")}</span>
      </div>

      <div className="rhead">
        <div className="title-block">
          <h1>{t("items.revenue-comparison")}</h1>
          <p className="sub">{tc("subtitle")}<span className="tag">{rangeText}</span><span className="tag" style={{ opacity: 0.7 }}>{tc("vs")} {priorRangeText}</span></p>
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
          <div className="kpi-label"><span className="pulse" />{tc("kpiCurrent")}</div>
          <div className="kpi-value">{pending ? <Skel w={90} h={22} /> : <>{fmt0(k.current)}<span className="unit">{tr("omr")}</span></>}</div>
          <div className="kpi-sub">{rangeText}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tc("kpiPrior")}</div>
          <div className="kpi-value">{pending ? <Skel w={80} h={22} /> : <>{fmt0(k.prior)}<span className="unit">{tr("omr")}</span></>}</div>
          <div className="kpi-sub">{priorRangeText}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tc("kpiDelta")}</div>
          <div className="kpi-value" style={{ color: k.delta > 0 ? "var(--success-600)" : k.delta < 0 ? "var(--error-600)" : undefined }}>
            {pending ? <Skel w={80} h={22} /> : <>{k.delta > 0 ? "+" : ""}{fmt0(k.delta)}<span className="unit">{tr("omr")}</span></>}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tc("kpiChange")}</div>
          <div className="kpi-value" style={{ color: (k.deltaPct ?? 0) > 0 ? "var(--success-600)" : (k.deltaPct ?? 0) < 0 ? "var(--error-600)" : undefined }}>
            {pending ? <Skel w={60} h={22} /> : (k.deltaPct === null ? newLabel : <>{k.deltaPct > 0 ? "+" : ""}{k.deltaPct.toFixed(0)}<span className="unit">%</span></>)}
          </div>
        </div>
      </div>

      {/* Report table */}
      <section className="rtable-wrap">
        <div className="rtable-toolbar">
          <div className="left">
            <span className="title">{tc("tableTitle")}</span>
            <span className="meta">{tc("tableMeta", { count: k.buildingCount })}</span>
          </div>
        </div>
        <div className="rtable-scroll">
          <table className="rtable">
            <thead>
              <tr>
                <th>{tc("colName")}</th>
                <Th k="prior" label={tc("colPrior")} group={priorRangeText} />
                <Th k="current" label={tc("colCurrent")} group={rangeText} />
                <Th k="delta" label={tc("colDelta")} />
              </tr>
            </thead>
            <tbody>
              {pending ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td><Skel w={160} /></td><td className="num"><Skel w={70} /></td><td className="num"><Skel w={70} /></td><td className="num"><Skel w={80} /></td></tr>
                ))
              ) : data.buildings.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: "40px", textAlign: "center", color: "var(--gray-500)" }}>{tc("empty")}</td></tr>
              ) : (
                <>
                  {sortedBuildings.map((b) => (
                    <tr key={b.id} className="lvl-1">
                      <td>{b.name}</td>
                      <td className="num dim">{fmt3(b.prior)}</td>
                      <td className="num">{fmt3(b.current)}</td>
                      <td className="num"><DeltaCell delta={b.delta} deltaPct={b.deltaPct} newLabel={newLabel} /></td>
                    </tr>
                  ))}
                  <tr className="is-grand">
                    <td>{tc("grandTotal", { count: k.buildingCount })}</td>
                    <td className="num">{fmt3(k.prior)}</td>
                    <td className="num">{fmt3(k.current)}</td>
                    <td className="num"><DeltaCell delta={k.delta} deltaPct={k.deltaPct} newLabel={newLabel} /></td>
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
