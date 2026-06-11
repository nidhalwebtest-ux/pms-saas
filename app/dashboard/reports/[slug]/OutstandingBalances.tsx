"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { DATE_PRESETS } from "../reports-config";
import type { OsReport, OsBuilding, OsTenant } from "@/lib/reports/outstanding-balances";

interface Props {
  data: OsReport;
  properties: { id: string; name: string }[];
  preset: string;
  rangeText: string;
  fromDate: string;
  toDate: string;
  selectedPropertyId: string;
}

const fmt0 = (n: number) => Math.round(n).toLocaleString("en-US");
const fmt3 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const pct0 = (n: number) => `${Math.round(n * 100)}%`;
const Skel = ({ w, h = 16 }: { w: number; h?: number }) => <span className="skel" style={{ width: w, height: h, verticalAlign: "middle" }} />;

const STATUS_COLOR: Record<string, string> = {
  PENDING: "var(--warning-600)",
  DUE: "var(--warning-600)",
  ISSUED: "var(--warning-600)",
  PARTIALLY_PAID: "var(--brand-500)",
  PARTIAL: "var(--brand-500)",
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

function AmountCells({ inv, paid, credited, bal, fmt }: { inv: number; paid: number; credited: number; bal: number; fmt: (n: number) => string }) {
  return (
    <>
      <td className="num dim">{fmt(inv)}</td>
      <td className="num" style={{ color: paid > 0 ? "var(--success-600)" : "var(--gray-400)" }}>{paid > 0 ? fmt(paid) : "—"}</td>
      <td className="num" style={{ color: credited > 0 ? "var(--error-600)" : "var(--gray-300)" }}>{credited > 0 ? `−${fmt(credited)}` : "—"}</td>
      <td className="num" style={{ fontWeight: 600 }}>{fmt(bal)}</td>
    </>
  );
}

export default function OutstandingBalances({ data, properties, preset, rangeText, fromDate, toDate, selectedPropertyId }: Props) {
  const router = useRouter();
  const t = useTranslations("reports");
  const tf = useTranslations("reports.filters");
  const to = useTranslations("reports.outstanding");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [level, setLevel] = useState<"collapse" | "l2" | "l3" | "expand">("l2");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(data.buildings.map((b) => b.id)));

  const allBuildings = tf("allBuildings");
  const selectedBuilding = properties.find((p) => p.id === selectedPropertyId)?.name ?? allBuildings;
  const loc = locale === "ar" ? "ar" : "en-GB";
  const asOfLabel = new Date(data.asOf + "T00:00:00Z").toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric" });

  function navigate(next: { preset?: string; propertyId?: string | null; from?: string; to?: string }) {
    const sp = new URLSearchParams();
    const p = next.preset ?? preset;
    if (p && p !== "today") sp.set("preset", p);
    if (p === "custom") {
      const f = next.from ?? fromDate, tt = next.to ?? toDate;
      if (f) sp.set("from", f); if (tt) sp.set("to", tt);
    }
    const pid = next.propertyId === undefined ? selectedPropertyId : next.propertyId;
    if (pid) sp.set("propertyId", pid);
    const qs = sp.toString();
    startTransition(() => router.push(`/dashboard/reports/outstanding-balances${qs ? `?${qs}` : ""}`));
  }

  function applyLevel(l: typeof level) {
    setLevel(l);
    if (l === "collapse") setExpanded(new Set());
    else if (l === "l2") setExpanded(new Set(data.buildings.map((b) => b.id)));
    else setExpanded(new Set([...data.buildings.map((b) => b.id), ...data.buildings.flatMap((b) => b.tenants.map((tt) => `${b.id}:${tt.id}`))]));
  }
  function toggle(id: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function exportCsv() {
    const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [["Building", "Tenant", "Invoice", "Status", "Due", "Days overdue", "Invoiced", "Paid", "Credited", "Balance"]];
    for (const b of data.buildings) for (const tn of b.tenants) for (const inv of tn.invoices) {
      rows.push([b.name, tn.name, inv.number, inv.status, inv.dueDate.slice(0, 10), String(inv.daysOverdue > 0 ? inv.daysOverdue : 0),
        inv.invoiced.toFixed(3), inv.paid.toFixed(3), inv.credited.toFixed(3), inv.balance.toFixed(3)]);
    }
    rows.push([]);
    rows.push(["Total", "", "", "", "", "", k.invoiced.toFixed(3), k.paid.toFixed(3), k.credited.toFixed(3), k.balance.toFixed(3)]);
    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `outstanding-balances-${data.asOf}.csv`;
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
        <span>{t("groups.financial")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span className="current">{t("items.outstanding-balances")}</span>
      </div>

      <div className="rhead">
        <div className="title-block">
          <h1>{t("items.outstanding-balances")}</h1>
          <p className="sub">{to("subtitle")}<span className="tag">{to("asOf", { date: asOfLabel })}</span></p>
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
            <button className="link muted" onClick={() => navigate({ preset: "today", propertyId: null })}>{tf("reset")}</button>
          </div>
        </div>
        <div className="date-presets">
          {presetItems.map((p) => (
            <button key={p.key} className={`preset${preset === p.key ? " is-active" : ""}${p.key === "khareef" ? " is-khareef" : ""}`} onClick={() => navigate({ preset: p.key })}>{p.label}</button>
          ))}
        </div>
        <div className="fpanel-body">
          <div className="fpanel-grid cols-4">
            <FilterControl label={to("asOfLabel")} span2 active icon={<svg className="ic-sm ic-cal"><use href="#i-cal" /></svg>}
              value={presetLabel} display={asOfLabel}
              options={presetItems.map((p) => p.label)}
              onChange={(lbl) => { const p = presetItems.find((x) => x.label === lbl); navigate({ preset: p?.key ?? "today" }); }} />
            <FilterControl label={tf("building")} span2 active={!!selectedPropertyId} icon={<svg className="ic-sm" style={{ color: "var(--brand-500)" }}><use href="#i-building" /></svg>}
              value={selectedBuilding}
              options={buildingOptions}
              onChange={(name) => { const prop = properties.find((p) => p.name === name); navigate({ propertyId: prop ? prop.id : null }); }} />
            <div className="fpanel-field">
              <span className="fpanel-label">{to("asOfLabel")}</span>
              <input type="date" className="fpanel-control" value={toDate} onChange={(e) => navigate({ preset: "custom", from: e.target.value, to: e.target.value })} />
            </div>
          </div>
        </div>
      </section>

      {/* KPI cards */}
      <div className="kpi-row cols-4">
        <div className="kpi-card is-primary">
          <div className="kpi-label"><span className="pulse" />{to("kpiBalance")}</div>
          <div className="kpi-value">{pending ? <Skel w={90} h={22} /> : <>{fmt0(k.balance)}<span className="unit">{to("omr")}</span></>}</div>
          <div className="kpi-sub">{to("overdueOf", { amount: fmt0(k.overdueBalance) })}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{to("kpiInvoiced")}</div>
          <div className="kpi-value">{pending ? <Skel w={80} h={22} /> : <>{fmt0(k.invoiced)}<span className="unit">{to("omr")}</span></>}</div>
          <div className="kpi-sub">{to("openInvoices", { count: k.invoiceCount })}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{to("kpiPaid")}</div>
          <div className="kpi-value" style={{ color: "var(--success-600)" }}>{pending ? <Skel w={70} h={22} /> : <>{fmt0(k.paid)}<span className="unit">{to("omr")}</span></>}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{to("kpiCollection")}</div>
          <div className="kpi-value">{pending ? <Skel w={50} h={22} /> : pct0(k.collectionRate)}</div>
          <div className="kpi-sub">{to("debtors", { count: k.tenantCount })}</div>
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
                <th className="num">{to("colInvoiced")}</th>
                <th className="num">{to("colPaid")}</th>
                <th className="num">{to("colCredited")}</th>
                <th className="num">{to("colBalance")}</th>
              </tr>
            </thead>
            <tbody>
              {pending ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td><Skel w={160} /></td>{[0, 1, 2, 3].map((j) => <td key={j} className="num"><Skel w={56} /></td>)}</tr>
                ))
              ) : data.buildings.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "var(--gray-500)" }}>{to("empty")}</td></tr>
              ) : (
                <>
                  {data.buildings.map((b) => (
                    <BuildingRows key={b.id} b={b} expanded={expanded} toggle={toggle} locale={loc} to={to} />
                  ))}
                  <tr className="is-grand">
                    <td>{to("grandTotal", { count: k.buildingCount })}</td>
                    <AmountCells inv={k.invoiced} paid={k.paid} credited={k.credited} bal={k.balance} fmt={fmt0} />
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

function BuildingRows({ b, expanded, toggle, locale, to }: {
  b: OsBuilding; expanded: Set<string>; toggle: (id: string) => void; locale: string;
  to: (k: string, v?: Record<string, string | number>) => string;
}) {
  const open = expanded.has(b.id);
  return (
    <>
      <tr className="lvl-1">
        <td>
          <Chevron open={open} onClick={() => toggle(b.id)} />
          {b.name} <span className="mono" style={{ color: "var(--gray-500)", fontWeight: 400, marginInlineStart: 6, fontSize: 11 }}>{to("tenantsCount", { count: b.tenantCount })}</span>
        </td>
        <AmountCells inv={b.invoiced} paid={b.paid} credited={b.credited} bal={b.balance} fmt={fmt0} />
      </tr>
      {open && b.tenants.map((tn) => (
        <TenantRows key={tn.id} b={b} tn={tn} open={expanded.has(`${b.id}:${tn.id}`)} toggle={toggle} locale={locale} to={to} />
      ))}
      {open && (
        <tr className="is-total">
          <td>{to("subtotal", { name: b.name })}</td>
          <AmountCells inv={b.invoiced} paid={b.paid} credited={b.credited} bal={b.balance} fmt={fmt0} />
        </tr>
      )}
    </>
  );
}

function TenantRows({ b, tn, open, toggle, locale, to }: {
  b: OsBuilding; tn: OsTenant; open: boolean; toggle: (id: string) => void; locale: string;
  to: (k: string, v?: Record<string, string | number>) => string;
}) {
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  return (
    <>
      <tr className="lvl-2">
        <td>
          <Chevron open={open} onClick={() => toggle(`${b.id}:${tn.id}`)} />
          {tn.name} <span className="mono" style={{ color: "var(--gray-500)", fontWeight: 400, marginInlineStart: 6, fontSize: 11 }}>{to("invoiceCount", { count: tn.invoices.length })}</span>
        </td>
        <AmountCells inv={tn.invoiced} paid={tn.paid} credited={tn.credited} bal={tn.balance} fmt={fmt0} />
      </tr>
      {open && tn.invoices.map((inv) => {
        const over = inv.daysOverdue > 0;
        const color = STATUS_COLOR[inv.status] ?? "var(--gray-500)";
        return (
          <tr className="lvl-3" key={inv.id}>
            <td>
              <span className="row-leaf" />
              <span className="badge" style={{ marginInlineEnd: 8, color: over ? "var(--error-600)" : color, borderColor: "color-mix(in oklch, currentColor 30%, transparent)" }}>
                <span className="dot" style={{ background: over ? "var(--error-600)" : color }} />
                {over ? to("daysOverdue", { count: inv.daysOverdue }) : to(`status_${inv.status}`)}
              </span>
              <a className="r-link" href={`/dashboard/invoices/${inv.id}`}>{inv.number}</a>
              <span className="mono" style={{ color: "var(--gray-500)", fontSize: "10.5px", marginInlineStart: 6 }}>{to("due", { date: fmtDate(inv.dueDate) })}</span>
            </td>
            <AmountCells inv={inv.invoiced} paid={inv.paid} credited={inv.credited} bal={inv.balance} fmt={fmt3} />
          </tr>
        );
      })}
    </>
  );
}
