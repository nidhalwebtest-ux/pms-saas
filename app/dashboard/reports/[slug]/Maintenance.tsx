"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { downloadXlsx } from "@/lib/reports/export-xlsx";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { DATE_PRESETS } from "../reports-config";
import type { MaintReport, MaintBuilding } from "@/lib/reports/maintenance";

interface Props {
  data: MaintReport;
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

const STATUS_COLOR: Record<string, string> = {
  PENDING: "var(--warning-600)",
  APPROVED: "var(--brand-500)",
  PROCESSED: "var(--success-600)",
};

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

export default function Maintenance({ data, properties, preset, rangeText, fromDate, toDate, selectedPropertyId }: Props) {
  const router = useRouter();
  const t = useTranslations("reports");
  const tf = useTranslations("reports.filters");
  const tm = useTranslations("reports.maint");
  const locale = useLocale();
  const loc = locale === "ar" ? "ar" : "en-GB";
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(data.buildings.map((b) => b.id)));

  const allBuildings = tf("allBuildings");
  const selectedBuilding = properties.find((p) => p.id === selectedPropertyId)?.name ?? allBuildings;

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
    startTransition(() => router.push(`/dashboard/reports/maintenance${qs ? `?${qs}` : ""}`));
  }

  function toggle(id: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  const allOpen = expanded.size >= data.buildings.length && data.buildings.length > 0;

  function exportXlsx() {
    const rows = [["Building", "Expense", "Description", "Status", "Date", "Amount (OMR)", "Units down"]];
    for (const b of data.buildings) for (const it of b.items) {
      rows.push([b.name, it.number, it.description, it.status, it.date.slice(0, 10), it.amount.toFixed(3), ""]);
    }
    rows.push([]);
    rows.push(["Total", "", "", "", "", (k.spend + k.pending).toFixed(3), String(k.unitsDown)]);
    void downloadXlsx(rows, `maintenance-${fromDate}_${toDate}`);
  }

  const k = data.kpis;
  const presetItems = DATE_PRESETS.map((p) => ({ key: p.key, label: t(`presets.${p.key}`) }));
  const presetLabel = t(`presets.${preset === "custom" ? "custom" : preset}` as never);
  const buildingOptions = [allBuildings, ...properties.map((p) => p.name)];

  return (
    <main className="rpage">
      <div className="crumbs">
        <span>{t("breadcrumbRoot")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span>{t("groups.operational")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span className="current">{t("items.maintenance")}</span>
      </div>

      <div className="rhead">
        <div className="title-block">
          <h1>{t("items.maintenance")}</h1>
          <p className="sub">{tm("subtitle")}<span className="tag">{rangeText}</span></p>
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
          <div className="kpi-label"><span className="pulse" />{tm("kpiSpend")}</div>
          <div className="kpi-value">{pending ? <Skel w={90} h={22} /> : <>{fmt0(k.spend)}<span className="unit">{tm("omr")}</span></>}</div>
          <div className="kpi-sub">{tm("jobsCount", { count: k.jobs })}</div>
        </div>
        <div className="kpi-card is-warning">
          <div className="kpi-label">{tm("kpiPending")}</div>
          <div className="kpi-value" style={{ color: k.pending > 0 ? "var(--warning-600)" : undefined }}>{pending ? <Skel w={70} h={22} /> : <>{fmt0(k.pending)}<span className="unit">{tm("omr")}</span></>}</div>
        </div>
        <div className="kpi-card is-error">
          <div className="kpi-label">{tm("kpiUnitsDown")}</div>
          <div className="kpi-value" style={{ color: k.unitsDown > 0 ? "var(--error-600)" : undefined }}>{pending ? <Skel w={40} h={22} /> : k.unitsDown}</div>
          <div className="kpi-sub">{tm("currently")}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tm("kpiBuildings")}</div>
          <div className="kpi-value">{pending ? <Skel w={40} h={22} /> : k.buildingCount}</div>
        </div>
      </div>

      {/* Report table */}
      <section className="rtable-wrap">
        <div className="rtable-toolbar">
          <div className="left">
            <span className="title">{tm("tableTitle")}</span>
            <span className="meta">{tm("tableMeta", { count: k.buildingCount })}</span>
          </div>
          <div className="left" style={{ gap: 8 }}>
            <div className="seg">
              <button className={!allOpen ? "active" : ""} onClick={() => setExpanded(new Set())}>{tm("collapseAll")}</button>
              <button className={allOpen ? "active" : ""} onClick={() => setExpanded(new Set(data.buildings.map((b) => b.id)))}>{tm("expandAll")}</button>
            </div>
          </div>
        </div>

        <div className="rtable-scroll">
          <table className="rtable">
            <thead>
              <tr>
                <th>{tm("colName")}</th>
                <th className="num">{tm("colJobs")}</th>
                <th className="num">{tm("colSpend")}</th>
              </tr>
            </thead>
            <tbody>
              {pending ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td><Skel w={160} /></td><td className="num"><Skel w={36} /></td><td className="num"><Skel w={64} /></td></tr>
                ))
              ) : data.buildings.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: "40px", textAlign: "center", color: "var(--gray-500)" }}>{tm("empty")}</td></tr>
              ) : (
                <>
                  {data.buildings.map((b) => (
                    <BuildingRows key={b.id} b={b} open={expanded.has(b.id)} toggle={toggle} locale={loc} tm={tm} />
                  ))}
                  <tr className="is-grand">
                    <td>{tm("grandTotal", { count: k.buildingCount })}</td>
                    <td className="num">{k.jobs}</td>
                    <td className="num">{fmt3(k.spend + k.pending)}</td>
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

function BuildingRows({ b, open, toggle, locale, tm }: {
  b: MaintBuilding; open: boolean; toggle: (id: string) => void; locale: string;
  tm: (k: string, v?: Record<string, string | number>) => string;
}) {
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  const hasKids = b.items.length > 0;
  return (
    <>
      <tr className="lvl-1">
        <td>
          {hasKids ? <Chevron open={open} onClick={() => toggle(b.id)} /> : <span className="row-leaf" />}
          {b.name}
          {b.unitsDown > 0 && (
            <span className="badge" style={{ marginInlineStart: 8, color: "var(--error-600)", borderColor: "color-mix(in oklch, var(--error-600) 30%, transparent)" }}>
              <span className="dot" style={{ background: "var(--error-500)" }} />{tm("unitsDownBadge", { count: b.unitsDown })}
            </span>
          )}
          {b.pending > 0 && <span className="mono" style={{ color: "var(--warning-600)", fontWeight: 400, marginInlineStart: 8, fontSize: 11 }}>{tm("pendingMeta", { amount: fmt0(b.pending) })}</span>}
        </td>
        <td className="num">{b.jobs || <span style={{ color: "var(--gray-300)" }}>—</span>}</td>
        <td className="num" style={{ fontWeight: 600 }}>{fmt0(b.spend)}</td>
      </tr>
      {open && b.items.map((it) => {
        const color = STATUS_COLOR[it.status] ?? "var(--gray-500)";
        return (
          <tr className="lvl-2" key={it.id}>
            <td>
              <span className="row-leaf" />
              <span className="badge" style={{ marginInlineEnd: 8, color, borderColor: "color-mix(in oklch, currentColor 30%, transparent)" }}>
                <span className="dot" style={{ background: color }} />{tm(`status_${it.status}`)}
              </span>
              <a className="r-link" href={`/dashboard/expenses/${it.id}`}>{it.number}</a>
              {it.description ? <> · {it.description}</> : null}
              <span className="mono" style={{ color: "var(--gray-500)", fontSize: "10.5px", marginInlineStart: 6 }}>{fmtDate(it.date)}</span>
            </td>
            <td className="num"><span style={{ color: "var(--gray-300)" }}>—</span></td>
            <td className="num" style={{ color: it.status === "PENDING" ? "var(--warning-600)" : undefined }}>{fmt3(it.amount)}</td>
          </tr>
        );
      })}
    </>
  );
}
