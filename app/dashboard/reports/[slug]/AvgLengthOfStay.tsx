"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { DATE_PRESETS } from "../reports-config";
import type { LosReport, LosBuilding } from "@/lib/reports/avg-length-of-stay";

interface Props {
  data: LosReport;
  properties: { id: string; name: string }[];
  preset: string;
  rangeText: string;
  fromDate: string;
  toDate: string;
  selectedPropertyId: string;
}

const fmt1 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt0 = (n: number) => Math.round(n).toLocaleString("en-US");
const Skel = ({ w, h = 16 }: { w: number; h?: number }) => <span className="skel" style={{ width: w, height: h, verticalAlign: "middle" }} />;

const STATUS_COLOR: Record<string, string> = {
  CHECKED_IN: "var(--success-600)",
  CONFIRMED: "var(--warning-600)",
  PENDING: "var(--warning-600)",
  COMPLETED: "var(--gray-500)",
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

export default function AvgLengthOfStay({ data, properties, preset, rangeText, fromDate, toDate, selectedPropertyId }: Props) {
  const router = useRouter();
  const t = useTranslations("reports");
  const tf = useTranslations("reports.filters");
  const tl = useTranslations("reports.los");
  const ts = useTranslations("reports.occupancy.status");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(data.buildings.map((b) => b.id)));
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const allBuildings = tf("allBuildings");
  const selectedBuilding = properties.find((p) => p.id === selectedPropertyId)?.name ?? allBuildings;
  const loc = locale === "ar" ? "ar" : "en-GB";

  const sortedBuildings = useMemo(() => {
    const dir = sortDir === "desc" ? -1 : 1;
    return [...data.buildings].sort((a, c) => dir * (a.avgNights - c.avgNights));
  }, [data.buildings, sortDir]);
  const maxAvg = useMemo(() => Math.max(1, ...data.buildings.map((b) => b.avgNights)), [data.buildings]);

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
    startTransition(() => router.push(`/dashboard/reports/avg-length-of-stay${qs ? `?${qs}` : ""}`));
  }

  function toggle(id: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  const allOpen = expanded.size >= data.buildings.length && data.buildings.length > 0;

  function exportCsv() {
    const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [["Building", "Reservation", "Guest", "Status", "From", "To", "Nights"]];
    for (const b of sortedBuildings) for (const s of b.stays) {
      rows.push([b.name, s.ref ?? "", s.guest, s.status, s.from.slice(0, 10), s.to.slice(0, 10), String(s.nights)]);
    }
    rows.push([]);
    rows.push(["", "", "", "", "", "Avg nights", String(k.avgNights)]);
    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `avg-length-of-stay-${fromDate}_${toDate}.csv`;
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
        <span>{t("groups.occupancy")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span className="current">{t("items.avg-length-of-stay")}</span>
      </div>

      <div className="rhead">
        <div className="title-block">
          <h1>{t("items.avg-length-of-stay")}</h1>
          <p className="sub">{tl("subtitle")}<span className="tag">{rangeText}</span></p>
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
          <div className="kpi-label"><span className="pulse" />{tl("kpiAvg")}</div>
          <div className="kpi-value">{pending ? <Skel w={70} h={22} /> : <>{fmt1(k.avgNights)}<span className="unit">{tl("nightsUnit")}</span></>}</div>
          <div className="kpi-sub">{rangeText}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tl("kpiStays")}</div>
          <div className="kpi-value">{pending ? <Skel w={50} h={22} /> : k.stayCount}</div>
          <div className="kpi-sub">{tl("totalNights", { count: k.totalNights })}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tl("kpiLongest")}</div>
          <div className="kpi-value">{pending ? <Skel w={50} h={22} /> : <>{fmt0(k.longestNights)}<span className="unit">{tl("nightsUnit")}</span></>}</div>
          <div className="kpi-sub">{k.longestGuest ?? "—"}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tl("kpiShortest")}</div>
          <div className="kpi-value">{pending ? <Skel w={50} h={22} /> : <>{fmt0(k.shortestNights)}<span className="unit">{tl("nightsUnit")}</span></>}</div>
          <div className="kpi-sub">{k.shortestGuest ?? "—"}</div>
        </div>
      </div>

      {/* Report table */}
      <section className="rtable-wrap">
        <div className="rtable-toolbar">
          <div className="left">
            <span className="title">{tl("tableTitle")}</span>
            <span className="meta">{tl("tableMeta", { count: k.buildingCount })}</span>
          </div>
          <div className="left" style={{ gap: 8 }}>
            <div className="seg">
              <button className={!allOpen ? "active" : ""} onClick={() => setExpanded(new Set())}>{tl("collapseAll")}</button>
              <button className={allOpen ? "active" : ""} onClick={() => setExpanded(new Set(data.buildings.map((b) => b.id)))}>{tl("expandAll")}</button>
            </div>
          </div>
        </div>

        <div className="rtable-scroll">
          <table className="rtable">
            <thead>
              <tr>
                <th>{tl("colName")}</th>
                <th className={`num sortable ${sortDir === "desc" ? "sorted-desc" : "sorted-asc"}`} onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}>
                  {tl("colNights")}<span className="col-group">{rangeText}</span>
                  <span className="sort"><svg className="ic-xs up"><use href="#i-chev-up" /></svg><svg className="ic-xs down"><use href="#i-chev-down" /></svg></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pending ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td><Skel w={180} /></td><td className="num"><Skel w={80} /></td></tr>
                ))
              ) : data.buildings.length === 0 ? (
                <tr><td colSpan={2} style={{ padding: "40px", textAlign: "center", color: "var(--gray-500)" }}>{tl("empty")}</td></tr>
              ) : (
                <>
                  {sortedBuildings.map((b) => (
                    <BuildingRows key={b.id} b={b} open={expanded.has(b.id)} toggle={toggle} maxAvg={maxAvg} locale={loc} tl={tl} ts={ts} />
                  ))}
                  <tr className="is-grand">
                    <td>{tl("grandTotal", { count: k.buildingCount })}</td>
                    <td className="num">{fmt1(k.avgNights)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="rtable-footer">
          <span>{tl("footer")}</span>
          <div className="right"><span>{tl("source")}</span></div>
        </div>
      </section>
    </main>
  );
}

function BuildingRows({ b, open, toggle, maxAvg, locale, tl, ts }: {
  b: LosBuilding; open: boolean; toggle: (id: string) => void; maxAvg: number; locale: string;
  tl: (k: string, v?: Record<string, string | number>) => string;
  ts: (k: string) => string;
}) {
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
  const pct = Math.max(0, Math.min(1, b.avgNights / maxAvg));
  return (
    <>
      <tr className="lvl-1">
        <td>
          <Chevron open={open} onClick={() => toggle(b.id)} />
          {b.name} <span className="mono" style={{ color: "var(--gray-500)", fontWeight: 400, marginInlineStart: 6, fontSize: 11 }}>{tl("stayCount", { count: b.stayCount })}</span>
        </td>
        <td className="num">
          <span className="bar-cell"><span className="bar"><i style={{ width: `${pct * 100}%` }} /></span><span>{fmt1(b.avgNights)} {tl("nightsUnit")}</span></span>
        </td>
      </tr>
      {open && b.stays.map((s) => {
        const color = STATUS_COLOR[s.status] ?? "var(--gray-500)";
        return (
          <tr className="lvl-2" key={s.id}>
            <td>
              <span className="row-leaf" />
              <span className="badge" style={{ marginInlineEnd: 8, color, borderColor: "color-mix(in oklch, currentColor 30%, transparent)" }}>
                <span className="dot" style={{ background: color }} />{ts(s.status)}
              </span>
              <a className="r-link" href={`/dashboard/reservations/${s.id}`}>{s.ref ?? tl("noRef")}</a>
              {s.guest && s.guest !== "—" ? <> · {s.guest}</> : null}
              <span className="mono" style={{ color: "var(--gray-500)", fontSize: "10.5px", marginInlineStart: 6 }}>{fmtDate(s.from)} – {fmtDate(s.to)}</span>
            </td>
            <td className="num">{tl("nightsN", { count: s.nights })}</td>
          </tr>
        );
      })}
    </>
  );
}
