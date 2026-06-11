"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { DATE_PRESETS } from "../reports-config";
import type { StaffReport, StaffRow } from "@/lib/reports/receptionist-performance";

interface Props {
  data: StaffReport;
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

const ROLE_COLOR: Record<string, string> = {
  OWNER: "var(--brand-500)",
  MANAGER: "var(--brand-500)",
  STAFF: "var(--success-600)",
  ACCOUNTANT: "var(--warning-600)",
};
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "—";

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

type SortKey = "collected" | "reservations" | "checkIns" | "checkOuts" | "payments" | "totalActions";

export default function ReceptionistPerformance({ data, properties, preset, rangeText, fromDate, toDate, selectedPropertyId }: Props) {
  const router = useRouter();
  const t = useTranslations("reports");
  const tf = useTranslations("reports.filters");
  const ts = useTranslations("reports.staff");
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: "desc" | "asc" }>({ key: "collected", dir: "desc" });

  const allBuildings = tf("allBuildings");
  const selectedBuilding = properties.find((p) => p.id === selectedPropertyId)?.name ?? allBuildings;

  const sortedStaff = useMemo(() => {
    const dir = sort.dir === "desc" ? -1 : 1;
    return [...data.staff].sort((a, b) => dir * ((a[sort.key] as number) - (b[sort.key] as number)));
  }, [data.staff, sort]);
  const maxActions = useMemo(() => Math.max(1, ...data.staff.map((s) => s.totalActions)), [data.staff]);

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
    startTransition(() => router.push(`/dashboard/reports/receptionist-performance${qs ? `?${qs}` : ""}`));
  }

  function setSortKey(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  }

  function exportCsv() {
    const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [["Staff", "Role", "Reservations", "Check-ins", "Check-outs", "Payments", "Collected (OMR)"]];
    for (const s of sortedStaff) rows.push([s.name, s.role, String(s.reservations), String(s.checkIns), String(s.checkOuts), String(s.payments), s.collected.toFixed(3)]);
    rows.push([]);
    rows.push(["Total", "", String(k.reservations), String(k.checkIns), String(k.checkOuts), String(k.payments), k.collected.toFixed(3)]);
    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `receptionist-performance-${fromDate}_${toDate}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const k = data.kpis;
  const presetItems = DATE_PRESETS.map((p) => ({ key: p.key, label: t(`presets.${p.key}`) }));
  const presetLabel = t(`presets.${preset === "custom" ? "custom" : preset}` as never);
  const buildingOptions = [allBuildings, ...properties.map((p) => p.name)];

  const Th = ({ k: key, label }: { k: SortKey; label: string }) => (
    <th className={`num sortable ${sort.key === key ? (sort.dir === "desc" ? "sorted-desc" : "sorted-asc") : ""}`} onClick={() => setSortKey(key)}>
      {label}<span className="sort"><svg className="ic-xs up"><use href="#i-chev-up" /></svg><svg className="ic-xs down"><use href="#i-chev-down" /></svg></span>
    </th>
  );

  return (
    <main className="rpage">
      <div className="crumbs">
        <span>{t("breadcrumbRoot")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span>{t("groups.operational")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span className="current">{t("items.receptionist-performance")}</span>
      </div>

      <div className="rhead">
        <div className="title-block">
          <h1>{t("items.receptionist-performance")}</h1>
          <p className="sub">{ts("subtitle")}<span className="tag">{rangeText}</span></p>
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
          <div className="kpi-label"><span className="pulse" />{ts("kpiCollected")}</div>
          <div className="kpi-value">{pending ? <Skel w={90} h={22} /> : <>{fmt0(k.collected)}<span className="unit">{ts("omr")}</span></>}</div>
          <div className="kpi-sub">{ts("byStaff", { count: k.staffCount })}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{ts("kpiReservations")}</div>
          <div className="kpi-value">{pending ? <Skel w={50} h={22} /> : k.reservations}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{ts("kpiCheckIns")}</div>
          <div className="kpi-value">{pending ? <Skel w={50} h={22} /> : `${k.checkIns} / ${k.checkOuts}`}</div>
          <div className="kpi-sub">{ts("inOut")}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{ts("kpiTop")}</div>
          <div className="kpi-value kpi-value small">{pending ? <Skel w={80} h={18} /> : (k.topName ?? "—")}</div>
          <div className="kpi-sub">{fmt0(k.topCollected)} {ts("omr")}</div>
        </div>
      </div>

      {/* Report table */}
      <section className="rtable-wrap">
        <div className="rtable-toolbar">
          <div className="left">
            <span className="title">{ts("tableTitle")}</span>
            <span className="meta">{ts("tableMeta", { count: k.staffCount })}</span>
          </div>
        </div>
        <div className="rtable-scroll">
          <table className="rtable">
            <thead>
              <tr>
                <th>{ts("colName")}</th>
                <Th k="reservations" label={ts("colReservations")} />
                <Th k="checkIns" label={ts("colCheckIns")} />
                <Th k="checkOuts" label={ts("colCheckOuts")} />
                <Th k="payments" label={ts("colPayments")} />
                <Th k="collected" label={ts("colCollected")} />
              </tr>
            </thead>
            <tbody>
              {pending ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td><Skel w={160} /></td>{[0, 1, 2, 3, 4].map((j) => <td key={j} className="num"><Skel w={44} /></td>)}</tr>
                ))
              ) : data.staff.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "var(--gray-500)" }}>{ts("empty")}</td></tr>
              ) : (
                <>
                  {sortedStaff.map((s, i) => (
                    <StaffRowView key={s.id} s={s} rank={sort.key === "collected" && sort.dir === "desc" ? i + 1 : null} maxActions={maxActions} ts={ts} />
                  ))}
                  <tr className="is-grand">
                    <td>{ts("grandTotal", { count: k.staffCount })}</td>
                    <td className="num">{k.reservations}</td>
                    <td className="num">{k.checkIns}</td>
                    <td className="num">{k.checkOuts}</td>
                    <td className="num">{k.payments}</td>
                    <td className="num">{fmt3(k.collected)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="rtable-footer">
          <span>{ts("footer")}</span>
          <div className="right"><span>{ts("source")}</span></div>
        </div>
      </section>
    </main>
  );
}

function StaffRowView({ s, rank, maxActions, ts }: {
  s: StaffRow; rank: number | null; maxActions: number;
  ts: (k: string, v?: Record<string, string | number>) => string;
}) {
  const roleColor = ROLE_COLOR[s.role] ?? "var(--gray-500)";
  const actPct = Math.round((s.totalActions / maxActions) * 100);
  return (
    <tr className="lvl-1">
      <td>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {rank && <span className="mono" style={{ color: "var(--gray-400)", width: 16, textAlign: "end", fontSize: 11 }}>{rank}</span>}
          <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 600, color: roleColor }}>{initials(s.name)}</span>
          <span>
            {s.name}
            <span className="badge" style={{ marginInlineStart: 8, color: roleColor, borderColor: "color-mix(in oklch, currentColor 30%, transparent)" }}>{ts(`role_${s.role}`)}</span>
            <span className="mono" style={{ display: "block", color: "var(--gray-500)", fontSize: 10.5 }}>{ts("actions", { count: s.totalActions })} · {actPct}%</span>
          </span>
        </span>
      </td>
      <td className="num">{s.reservations || <span style={{ color: "var(--gray-300)" }}>—</span>}</td>
      <td className="num">{s.checkIns || <span style={{ color: "var(--gray-300)" }}>—</span>}</td>
      <td className="num">{s.checkOuts || <span style={{ color: "var(--gray-300)" }}>—</span>}</td>
      <td className="num">{s.payments || <span style={{ color: "var(--gray-300)" }}>—</span>}</td>
      <td className="num" style={{ fontWeight: 600, color: s.collected > 0 ? "var(--success-600)" : undefined }}>{s.collected > 0 ? fmt0(s.collected) : <span style={{ color: "var(--gray-300)" }}>—</span>}</td>
    </tr>
  );
}
