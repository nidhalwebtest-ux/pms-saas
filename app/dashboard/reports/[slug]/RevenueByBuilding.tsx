"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { DATE_PRESETS } from "../reports-config";
import type { RevReport, RevBuilding, RevUnit } from "@/lib/reports/revenue-by-building";

interface Props {
  data: RevReport;
  properties: { id: string; name: string }[];
  preset: string;
  rangeText: string;
  selectedPropertyId: string;
}

const fmt3 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const fmt0 = (n: number) => Math.round(n).toLocaleString("en-US");
const pct = (n: number | null) => (n == null ? "—" : `${(n * 100).toFixed(1)}%`);

function Delta({ v, light }: { v: number | null; light?: boolean }) {
  if (v == null) return <span className="dim">—</span>;
  if (v === 0) return <span className="delta-cell flat">±0%</span>;
  const up = v > 0;
  return (
    <span className={`delta-cell ${up ? "up" : "down"}`} style={light ? { color: "oklch(0.91 0.06 155)" } : undefined}>
      <svg className="ic-xs"><use href={up ? "#i-arrow-up" : "#i-arrow-down"} /></svg>{Math.abs(v).toFixed(1)}%
    </span>
  );
}
function Heat({ occ, tone }: { occ: number | null; tone: "success" | "warning" }) {
  if (occ == null) return <span className="dim">—</span>;
  const bg = tone === "success" ? "oklch(0.560 0.140 155 / 0.18)" : "oklch(0.745 0.150 75 / 0.20)";
  const color = tone === "success" ? "var(--success-700)" : "var(--warning-700)";
  return <span className="heat" style={{ background: bg, color }}>{pct(occ)}</span>;
}
function Chevron({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <span className={`row-chev${open ? " is-open" : ""}`} role="button" onClick={onClick}>
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

export default function RevenueByBuilding({ data, properties, preset, rangeText, selectedPropertyId }: Props) {
  const router = useRouter();
  const t = useTranslations("reports");
  const tf = useTranslations("reports.filters");
  const tr = useTranslations("reports.revenue");
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [level, setLevel] = useState<"collapse" | "l2" | "l3" | "expand">("l2");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(data.buildings.map((b) => b.id)));
  // Cosmetic-only filters (not yet wired to data) — store canonical KEYS and
  // translate at render so switching language re-localizes the displayed value.
  const [granularity, setGranularity] = useState("monthly");
  const [unitType, setUnitType] = useState("typeAll");
  const [status, setStatus] = useState("statusConfirmed");
  const granKeys = ["daily", "weekly", "monthly", "quarterly"];
  const typeKeys = ["typeAll", "typeStudio", "type1br", "type2br", "type3br", "typeSuite"];
  const statusKeys = ["statusConfirmed", "statusAll", "statusCheckedIn", "statusCompleted"];

  const allBuildings = tf("allBuildings");
  const selectedBuilding = properties.find((p) => p.id === selectedPropertyId)?.name ?? allBuildings;

  function navigate(next: { preset?: string; propertyId?: string | null }) {
    const sp = new URLSearchParams();
    const p = next.preset ?? preset;
    if (p && p !== "month") sp.set("preset", p);
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

  const k = data.kpis;
  const presetItems = DATE_PRESETS.map((p) => ({ key: p.key, label: t(`presets.${p.key}`) }));
  const presetLabel = t(`presets.${preset === "custom" ? "custom" : preset}` as never);
  const compareText = tr("comparePrior", { period: presetLabel });
  const buildingOptions = [allBuildings, ...properties.map((p) => p.name)];
  const totalUnits = data.buildings.reduce((s, b) => s + b.unitCount, 0);

  return (
    <main className="rpage" style={pending ? { opacity: 0.6, transition: "opacity 120ms" } : undefined}>
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
          <button className="btn btn-ghost btn-sm"><svg className="ic-sm"><use href="#i-schedule" /></svg>{t("actions.schedule")}</button>
          <button className="btn btn-secondary btn-sm"><svg className="ic-sm"><use href="#i-save" /></svg>{t("actions.saveView")}</button>
          <button className="btn btn-primary btn-sm"><svg className="ic-sm"><use href="#i-download" /></svg>{t("actions.export")}<svg className="ic-xs chev"><use href="#i-chev-down" /></svg></button>
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
            <button className="link">{tf("saveCurrent")}</button>
          </div>
        </div>
        <div className="date-presets">
          {presetItems.map((p) => (
            <button key={p.key} className={`preset${preset === p.key ? " is-active" : ""}${p.key === "khareef" ? " is-khareef" : ""}`} onClick={() => navigate({ preset: p.key })}>{p.label}</button>
          ))}
        </div>
        <div className="fpanel-body">
          <div className="fpanel-grid">
            <FilterControl label={tf("dateRange")} span2 active icon={<svg className="ic-sm ic-cal"><use href="#i-cal" /></svg>}
              value={presetLabel} display={rangeText}
              options={presetItems.map((p) => p.label)}
              onChange={(lbl) => { const p = presetItems.find((x) => x.label === lbl); navigate({ preset: p?.key ?? "month" }); }} />
            <FilterControl label={tf("granularity")} value={tf(granularity)} options={granKeys.map((kk) => tf(kk))} onChange={(lbl) => setGranularity(granKeys.find((kk) => tf(kk) === lbl) ?? "monthly")} />
            <FilterControl label={tf("currency")} value={tf("currency3")} options={[tf("currency3"), tf("currency0")]} onChange={() => {}} />
            <FilterControl label={tf("building")} span2 active={!!selectedPropertyId} icon={<svg className="ic-sm" style={{ color: "var(--brand-500)" }}><use href="#i-building" /></svg>}
              value={selectedBuilding}
              options={buildingOptions}
              onChange={(name) => { const prop = properties.find((p) => p.name === name); navigate({ propertyId: prop ? prop.id : null }); }} />
            <FilterControl label={tf("unitType")} value={tf(unitType)} options={typeKeys.map((kk) => tf(kk))} onChange={(lbl) => setUnitType(typeKeys.find((kk) => tf(kk) === lbl) ?? "typeAll")} />
            <FilterControl label={tf("status")} value={tf(status)} active options={statusKeys.map((kk) => tf(kk))} onChange={(lbl) => setStatus(statusKeys.find((kk) => tf(kk) === lbl) ?? "statusConfirmed")} />
          </div>
        </div>
      </section>

      {/* KPI cards */}
      <div className="kpi-row cols-4">
        <div className="kpi-card is-primary">
          <div className="kpi-label"><span className="pulse" />{tr("kpiTotal")}</div>
          <div className="kpi-value">{fmt0(k.totalRevenue)}<span className="unit">{tr("omr")}</span></div>
          <div className="kpi-trend"><Delta v={k.delta} /><span className="vs">{compareText}</span></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tr("kpiBuildings")}</div>
          <div className="kpi-value">{k.buildingCount}<span className="unit">{tr("kpiActive")}</span></div>
          <div className="kpi-sub">{tr("kpiUnitsTotal", { count: totalUnits })}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tr("kpiTop")}</div>
          <div className="kpi-value small">{k.topPerformer ?? "—"}</div>
          <div className="kpi-trend"><span className="mono" style={{ color: "var(--gray-900)", fontWeight: 600 }}>{fmt0(k.topPerformerRevenue)} {tr("omr")}</span><span className="vs">{tr("kpiPctOfTotal", { pct: k.topPerformerPct.toFixed(1) })}</span></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tr("kpiAdr")}</div>
          <div className="kpi-value">{k.adr != null ? k.adr.toFixed(2) : "—"}<span className="unit">{tr("omr")}</span></div>
          <div className="kpi-sub">{tr("kpiAvgPerBuilding")} <strong>{fmt0(k.avgPerBuilding)}</strong></div>
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
                <th style={{ width: "32%" }}>{tr("colName")}</th>
                <th className="num sorted-desc">{tr("colRevenue")}<span className="col-group">{rangeText}</span></th>
                <th className="num">{tr("colYtd")}</th>
                <th className="num">{tr("colOccupancy")}</th>
                <th className="num">{tr("colRate")}<span className="col-group">{tr("perNight")}</span></th>
                <th className="num">{tr("colVs")}</th>
              </tr>
            </thead>
            <tbody>
              {data.buildings.length === 0 && (
                <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "var(--gray-500)" }}>{tr("empty")}</td></tr>
              )}
              {data.buildings.map((b) => (
                <BuildingRows key={b.id} b={b} open={expanded.has(b.id)} expanded={expanded} toggle={toggle} unitsLabel={(n) => tr("unitsCount", { count: n })} subtotalLabel={(name) => tr("subtotal", { name })} />
              ))}
              {data.buildings.length > 0 && (
                <tr className="is-grand">
                  <td>{tr("grandTotal", { count: k.buildingCount })}</td>
                  <td className="num">{fmt3(k.totalRevenue)}</td>
                  <td className="num">{fmt3(data.buildings.reduce((s, b) => s + b.revenueYtd, 0))}</td>
                  <td className="num">—</td>
                  <td className="num">{k.adr != null ? k.adr.toFixed(2) : "—"}</td>
                  <td className="num"><Delta v={k.delta} light /></td>
                </tr>
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

function BuildingRows({ b, open, expanded, toggle, unitsLabel, subtotalLabel }: { b: RevBuilding; open: boolean; expanded: Set<string>; toggle: (id: string) => void; unitsLabel: (n: number) => string; subtotalLabel: (name: string) => string }) {
  const tr = useTranslations("reports.revenue");
  return (
    <>
      <tr className="lvl-1">
        <td>
          <Chevron open={open} onClick={() => toggle(b.id)} />
          {b.name} <span className="mono" style={{ color: "var(--gray-500)", fontWeight: 400, marginInlineStart: 6, fontSize: 11 }}>{unitsLabel(b.unitCount)}</span>
        </td>
        <td className="num">{fmt3(b.revenue)}</td>
        <td className="num">{fmt3(b.revenueYtd)}</td>
        <td className="num"><Heat occ={b.occupancy} tone={b.tone} /></td>
        <td className="num">{b.rate != null ? b.rate.toFixed(2) : "—"}</td>
        <td className="num"><Delta v={b.delta} /></td>
      </tr>
      {open && b.units.map((u) => (
        <UnitRows key={u.id} u={u} open={expanded.has(u.id)} toggle={toggle} nightsLabel={(n) => tr("nights", { count: n })} />
      ))}
      {open && (
        <tr className="is-total">
          <td>{subtotalLabel(b.name)}</td>
          <td className="num">{fmt3(b.revenue)}</td>
          <td className="num">{fmt3(b.revenueYtd)}</td>
          <td className="num">{pct(b.occupancy)}</td>
          <td className="num">{b.rate != null ? b.rate.toFixed(2) : "—"}</td>
          <td className="num"><Delta v={b.delta} /></td>
        </tr>
      )}
    </>
  );
}

function UnitRows({ u, open, toggle, nightsLabel }: { u: RevUnit; open: boolean; toggle: (id: string) => void; nightsLabel: (n: number) => string }) {
  const hasKids = u.reservations.length > 0;
  return (
    <>
      <tr className="lvl-2">
        <td>
          {hasKids ? <Chevron open={open} onClick={() => toggle(u.id)} /> : <span className="row-leaf" />}
          {u.name}
        </td>
        <td className="num">{fmt3(u.revenue)}</td>
        <td className="num">{fmt3(u.revenueYtd)}</td>
        <td className="num"><Heat occ={u.occupancy} tone={u.tone} /></td>
        <td className="num">{u.rate != null ? u.rate.toFixed(2) : "—"}</td>
        <td className="num"><span className="dim">—</span></td>
      </tr>
      {open && hasKids && u.reservations.map((r) => (
        <tr className="lvl-3" key={r.id}>
          <td>
            <span className="row-leaf" />
            {r.ref ? <a className="r-link" href={`/dashboard/reservations/${r.id}`}>{r.ref}</a> : <span className="mono" style={{ color: "var(--gray-500)" }}>—</span>}
            {" · "}{r.guest}
            <span className="mono" style={{ color: "var(--gray-500)", fontSize: "10.5px", marginInlineStart: 6 }}>{nightsLabel(r.nights)}</span>
          </td>
          <td className="num">{fmt3(r.revenue)}</td>
          <td className="num dim">—</td>
          <td className="num dim">—</td>
          <td className="num dim">—</td>
          <td className="num dim">—</td>
        </tr>
      ))}
    </>
  );
}
