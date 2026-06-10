"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { DATE_PRESETS } from "../reports-config";
import type { OccReport, OccBuilding, OccUnit } from "@/lib/reports/occupancy-by-building";

interface Props {
  data: OccReport;
  properties: { id: string; name: string }[];
  preset: string;
  rangeText: string;
  fromDate: string;
  toDate: string;
  selectedPropertyId: string;
}

const fmt0 = (n: number) => Math.round(n).toLocaleString("en-US");
const pct0 = (n: number) => `${Math.round(n * 100)}%`;        // n is 0..1
const Skel = ({ w, h = 16 }: { w: number; h?: number }) => <span className="skel" style={{ width: w, height: h, verticalAlign: "middle" }} />;

/** Status → badge color (matches the app's status palette: green=in-house, orange=upcoming, gray=done). */
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

export default function OccupancyByBuilding({ data, properties, preset, rangeText, fromDate, toDate, selectedPropertyId }: Props) {
  const router = useRouter();
  const t = useTranslations("reports");
  const tf = useTranslations("reports.filters");
  const to = useTranslations("reports.occupancy");
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
      .map((b) => ({ ...b, units: [...b.units].sort((a, c) => dir * (a.occupancy - c.occupancy)) }))
      .sort((a, c) => dir * (a.occupancy - c.occupancy));
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
    startTransition(() => router.push(`/dashboard/reports/occupancy-by-building${qs ? `?${qs}` : ""}`));
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
    const rows = [["Building", "Unit", "Reservation", "Guest", "Status", "From", "To", "Nights"]];
    for (const b of sortedBuildings) for (const u of b.units) for (const s of u.stays) {
      rows.push([b.name, u.name, s.reservationRef ?? "", s.guest, s.status, s.from.slice(0, 10), s.to.slice(0, 10), String(s.nights)]);
    }
    rows.push([]);
    rows.push(["", "", "", "", "", "Occupied / Available", `${k.occupiedNights} / ${k.availableNights}`, pct0(k.occupancy)]);
    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `occupancy-by-building-${fromDate}_${toDate}.csv`;
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
        <span className="current">{t("items.occupancy-by-building")}</span>
      </div>

      <div className="rhead">
        <div className="title-block">
          <h1>{t("items.occupancy-by-building")}</h1>
          <p className="sub">{to("subtitle")}<span className="tag">{rangeText}</span></p>
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
          <div className="kpi-label"><span className="pulse" />{to("kpiOccupancy")}</div>
          <div className="kpi-value">{pending ? <Skel w={90} h={22} /> : pct0(k.occupancy)}</div>
          <div className="kpi-sub">{rangeText}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{to("kpiOccupied")}</div>
          <div className="kpi-value">{pending ? <Skel w={80} h={22} /> : <>{fmt0(k.occupiedNights)}<span className="unit">{to("nightsUnit")}</span></>}</div>
          <div className="kpi-sub">{to("ofAvailable", { count: k.availableNights })}</div>
        </div>
        <div className="kpi-card is-warning">
          <div className="kpi-label">{to("kpiVacant")}</div>
          <div className="kpi-value">{pending ? <Skel w={70} h={22} /> : <>{fmt0(k.vacantNights)}<span className="unit">{to("nightsUnit")}</span></>}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{to("kpiUnits")}</div>
          <div className="kpi-value">{pending ? <Skel w={40} h={22} /> : k.unitCount}</div>
          <div className="kpi-sub">{to("acrossBuildings", { count: k.buildingCount })}</div>
        </div>
      </div>

      {/* Report table */}
      <section className="rtable-wrap">
        <div className="rtable-toolbar">
          <div className="left">
            <span className="title">{to("tableTitle")}</span>
            <span className="meta">{to("tableMeta", { count: k.buildingCount })}</span>
          </div>
          <div className="left" style={{ gap: 8 }}>
            <div className="seg">
              <button className={level === "collapse" ? "active" : ""} onClick={() => applyLevel("collapse")}>{to("collapseAll")}</button>
              <button className={level === "l2" ? "active" : ""} onClick={() => applyLevel("l2")}>{to("level", { n: 2 })}</button>
              <button className={level === "l3" ? "active" : ""} onClick={() => applyLevel("l3")}>{to("level", { n: 3 })}</button>
              <button className={level === "expand" ? "active" : ""} onClick={() => applyLevel("expand")}>{to("expandAll")}</button>
            </div>
          </div>
        </div>

        <div className="rtable-scroll">
          <table className="rtable">
            <thead>
              <tr>
                <th>{to("colName")}</th>
                <th className={`num sortable ${sortDir === "desc" ? "sorted-desc" : "sorted-asc"}`} onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}>
                  {to("colOccupancy")}<span className="col-group">{rangeText}</span>
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
                <tr><td colSpan={2} style={{ padding: "40px", textAlign: "center", color: "var(--gray-500)" }}>{to("empty")}</td></tr>
              ) : (
                <>
                  {sortedBuildings.map((b) => (
                    <BuildingRows key={b.id} b={b} open={expanded.has(b.id)} expanded={expanded} toggle={toggle}
                      unitsLabel={(n) => to("unitsCount", { count: n })}
                      nightsLabel={(o, a) => to("nightsOf", { occupied: o, available: a })}
                      subtotalLabel={(name) => to("subtotal", { name })}
                      locale={locale} />
                  ))}
                  <tr className="is-grand">
                    <td>{to("grandTotal", { count: k.buildingCount })}</td>
                    <td className="num">{pct0(k.occupancy)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="rtable-footer">
          <span>{to("footer")}</span>
          <div className="right"><span>{to("source")}</span></div>
        </div>
      </section>
    </main>
  );
}

function OccBar({ occupancy }: { occupancy: number }) {
  return (
    <span className="bar-cell">
      <span className="bar"><i style={{ width: `${Math.round(occupancy * 100)}%` }} /></span>
      <span>{pct0(occupancy)}</span>
    </span>
  );
}

function BuildingRows({ b, open, expanded, toggle, unitsLabel, nightsLabel, subtotalLabel, locale }: {
  b: OccBuilding; open: boolean; expanded: Set<string>; toggle: (id: string) => void;
  unitsLabel: (n: number) => string; nightsLabel: (o: number, a: number) => string;
  subtotalLabel: (name: string) => string; locale: string;
}) {
  return (
    <>
      <tr className="lvl-1">
        <td>
          <Chevron open={open} onClick={() => toggle(b.id)} />
          {b.name} <span className="mono" style={{ color: "var(--gray-500)", fontWeight: 400, marginInlineStart: 6, fontSize: 11 }}>{unitsLabel(b.unitCount)} · {nightsLabel(b.occupiedNights, b.availableNights)}</span>
        </td>
        <td className="num"><OccBar occupancy={b.occupancy} /></td>
      </tr>
      {open && b.units.map((u) => (
        <UnitRows key={u.id} u={u} open={expanded.has(u.id)} toggle={toggle} locale={locale} />
      ))}
      {open && (
        <tr className="is-total">
          <td>{subtotalLabel(b.name)}</td>
          <td className="num">{pct0(b.occupancy)}</td>
        </tr>
      )}
    </>
  );
}

function UnitRows({ u, open, toggle, locale }: { u: OccUnit; open: boolean; toggle: (id: string) => void; locale: string }) {
  const to = useTranslations("reports.occupancy");
  const ts = useTranslations("reports.occupancy.status");
  const hasKids = u.stays.length > 0;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale === "ar" ? "ar" : "en-GB", { day: "numeric", month: "short" });
  return (
    <>
      <tr className="lvl-2">
        <td>
          {hasKids ? <Chevron open={open} onClick={() => toggle(u.id)} /> : <span className="row-leaf" />}
          {u.name}
          <span className="mono" style={{ color: "var(--gray-500)", fontWeight: 400, marginInlineStart: 6, fontSize: 11 }}>{to("nightsOf", { occupied: u.occupiedNights, available: u.availableNights })}</span>
        </td>
        <td className="num"><OccBar occupancy={u.occupancy} /></td>
      </tr>
      {open && hasKids && u.stays.map((s) => {
        const color = STATUS_COLOR[s.status] ?? "var(--gray-500)";
        return (
          <tr className="lvl-3" key={s.id}>
            <td>
              <span className="row-leaf" />
              <span className="badge" style={{ marginInlineEnd: 8, color, borderColor: "color-mix(in oklch, currentColor 30%, transparent)" }}>
                <span className="dot" style={{ background: color }} />{ts(s.status)}
              </span>
              {s.reservationRef
                ? <a className="r-link" href={`/dashboard/reservations/${s.reservationId}`}>{s.reservationRef}</a>
                : <a className="r-link" href={`/dashboard/reservations/${s.reservationId}`}>{to("noRef")}</a>}
              {s.guest && s.guest !== "—" ? <> · {s.guest}</> : null}
              <span className="mono" style={{ color: "var(--gray-500)", fontSize: "10.5px", marginInlineStart: 6 }}>{fmtDate(s.from)} – {fmtDate(s.to)}</span>
            </td>
            <td className="num">{to("nightsN", { count: s.nights })}</td>
          </tr>
        );
      })}
    </>
  );
}
