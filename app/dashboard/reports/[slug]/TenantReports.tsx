"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { DATE_PRESETS } from "../reports-config";
import type { TenantReport, TenantRow } from "@/lib/reports/tenant-reports";

interface Props {
  data: TenantReport;
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

type SortKey = "revenue" | "stays" | "nights" | "balance";

export default function TenantReports({ data, properties, preset, rangeText, fromDate, toDate, selectedPropertyId }: Props) {
  const router = useRouter();
  const t = useTranslations("reports");
  const tf = useTranslations("reports.filters");
  const tt = useTranslations("reports.tenantRpt");
  const tRoot = useTranslations();
  const locale = useLocale();
  const loc = locale === "ar" ? "ar" : "en-GB";
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: "desc" | "asc" }>({ key: "revenue", dir: "desc" });

  const allBuildings = tf("allBuildings");
  const selectedBuilding = properties.find((p) => p.id === selectedPropertyId)?.name ?? allBuildings;
  const tlabel = (ns: string, key: string, fallback: string) => {
    const full = `${ns}.${key}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (tRoot as any).has(full) ? (tRoot as any)(full) : fallback;
  };

  const sortedTenants = useMemo(() => {
    const dir = sort.dir === "desc" ? -1 : 1;
    return [...data.tenants].sort((a, b) => dir * ((a[sort.key] as number) - (b[sort.key] as number)));
  }, [data.tenants, sort]);

  function navigate(next: { preset?: string; propertyId?: string | null; from?: string; to?: string }) {
    const sp = new URLSearchParams();
    const p = next.preset ?? preset;
    if (p && p !== "month") sp.set("preset", p);
    if (p === "custom") {
      const f = next.from ?? fromDate, tto = next.to ?? toDate;
      if (f) sp.set("from", f); if (tto) sp.set("to", tto);
    }
    const pid = next.propertyId === undefined ? selectedPropertyId : next.propertyId;
    if (pid) sp.set("propertyId", pid);
    const qs = sp.toString();
    startTransition(() => router.push(`/dashboard/reports/tenant-reports${qs ? `?${qs}` : ""}`));
  }

  function setSortKey(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  }

  function exportCsv() {
    const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [["Tenant", "Classification", "Source", "Type", "New", "Stays", "Nights", "Revenue (OMR)", "Balance (OMR)"]];
    for (const x of sortedTenants) rows.push([x.name, x.classification, x.source, x.tenantType, x.isNew ? "yes" : "", String(x.stays), String(x.nights), x.revenue.toFixed(3), x.balance.toFixed(3)]);
    rows.push([]);
    rows.push(["Total", "", "", "", "", "", String(k.nights), k.revenue.toFixed(3), k.balance.toFixed(3)]);
    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `tenant-reports-${fromDate}_${toDate}.csv`;
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
        <span className="current">{t("items.tenant-reports")}</span>
      </div>

      <div className="rhead">
        <div className="title-block">
          <h1>{t("items.tenant-reports")}</h1>
          <p className="sub">{tt("subtitle")}<span className="tag">{rangeText}</span></p>
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
          <div className="kpi-label"><span className="pulse" />{tt("kpiRevenue")}</div>
          <div className="kpi-value">{pending ? <Skel w={90} h={22} /> : <>{fmt0(k.revenue)}<span className="unit">{tt("omr")}</span></>}</div>
          <div className="kpi-sub">{tt("byTenants", { count: k.tenantCount })}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tt("kpiTenants")}</div>
          <div className="kpi-value">{pending ? <Skel w={50} h={22} /> : k.tenantCount}</div>
          <div className="kpi-sub">{tt("newSub", { count: k.newCount })}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tt("kpiNights")}</div>
          <div className="kpi-value">{pending ? <Skel w={50} h={22} /> : <>{fmt0(k.nights)}<span className="unit">{tt("nightsUnit")}</span></>}</div>
        </div>
        <div className="kpi-card is-warning">
          <div className="kpi-label">{tt("kpiBalance")}</div>
          <div className="kpi-value" style={{ color: k.balance > 0 ? "var(--warning-600)" : undefined }}>{pending ? <Skel w={70} h={22} /> : <>{fmt0(k.balance)}<span className="unit">{tt("omr")}</span></>}</div>
        </div>
      </div>

      {/* Report table */}
      <section className="rtable-wrap">
        <div className="rtable-toolbar">
          <div className="left">
            <span className="title">{tt("tableTitle")}</span>
            <span className="meta">{tt("tableMeta", { count: k.tenantCount })}</span>
          </div>
        </div>
        <div className="rtable-scroll">
          <table className="rtable">
            <thead>
              <tr>
                <th>{tt("colName")}</th>
                <Th k="stays" label={tt("colStays")} />
                <Th k="nights" label={tt("colNights")} />
                <Th k="revenue" label={tt("colRevenue")} />
                <Th k="balance" label={tt("colBalance")} />
              </tr>
            </thead>
            <tbody>
              {pending ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td><Skel w={170} /></td>{[0, 1, 2, 3].map((j) => <td key={j} className="num"><Skel w={48} /></td>)}</tr>
                ))
              ) : data.tenants.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "var(--gray-500)" }}>{tt("empty")}</td></tr>
              ) : (
                <>
                  {sortedTenants.map((x) => (
                    <TenantRowView key={x.id} x={x} locale={loc} tt={tt} tlabel={tlabel} />
                  ))}
                  <tr className="is-grand">
                    <td>{tt("grandTotal", { count: k.tenantCount })}</td>
                    <td className="num">{data.tenants.reduce((s, r) => s + r.stays, 0)}</td>
                    <td className="num">{k.nights}</td>
                    <td className="num">{fmt3(k.revenue)}</td>
                    <td className="num">{fmt3(k.balance)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="rtable-footer">
          <span>{tt("footer")}</span>
          <div className="right"><span>{tt("source")}</span></div>
        </div>
      </section>
    </main>
  );
}

function TenantRowView({ x, locale, tt, tlabel }: {
  x: TenantRow; locale: string;
  tt: (k: string, v?: Record<string, string | number>) => string;
  tlabel: (ns: string, key: string, fallback: string) => string;
}) {
  const isVip = x.classification === "vip";
  const cColor = isVip ? "var(--gold-700)" : "var(--gray-500)";
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  return (
    <tr className="lvl-1">
      <td>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 26, height: 26, borderRadius: "50%", background: isVip ? "var(--gold-100)" : "var(--bg-subtle)", border: "1px solid var(--border-subtle)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 600, color: cColor }}>{initials(x.name)}</span>
          <span>
            <a className="r-link" href={`/dashboard/tenants/${x.id}`} style={{ fontFamily: "inherit", fontSize: "inherit" }}>{x.name}</a>
            {isVip && <span className="badge" style={{ marginInlineStart: 8, color: "var(--gold-700)", borderColor: "color-mix(in oklch, var(--gold-700) 35%, transparent)" }}><span className="dot" style={{ background: "var(--gold-500)" }} />{tt("vip")}</span>}
            {x.isNew && <span className="badge b-paid" style={{ marginInlineStart: 6 }}><span className="dot" />{tt("newBadge")}</span>}
            <span className="mono" style={{ display: "block", color: "var(--gray-500)", fontSize: 10.5 }}>
              {tlabel("tenants.sources", x.source, x.source)}
              {x.lastStay ? <> · {tt("lastStay", { date: fmtDate(x.lastStay) })}</> : null}
            </span>
          </span>
        </span>
      </td>
      <td className="num">{x.stays || <span style={{ color: "var(--gray-300)" }}>—</span>}</td>
      <td className="num">{x.nights || <span style={{ color: "var(--gray-300)" }}>—</span>}</td>
      <td className="num" style={{ fontWeight: 600 }}>{fmt0(x.revenue)}</td>
      <td className="num" style={{ color: x.balance > 0 ? "var(--warning-600)" : "var(--gray-300)" }}>{x.balance > 0 ? fmt0(x.balance) : "—"}</td>
    </tr>
  );
}
