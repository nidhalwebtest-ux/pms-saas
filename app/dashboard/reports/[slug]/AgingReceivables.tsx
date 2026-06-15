"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { downloadXlsx } from "@/lib/reports/export-xlsx";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { DATE_PRESETS } from "../reports-config";
import type { AgingReport, AgingBuilding, AgingTenant, Buckets, AgingBucketKey } from "@/lib/reports/aging-receivables";

interface Props {
  data: AgingReport;
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

const BUCKETS: { key: AgingBucketKey; color: string }[] = [
  { key: "current", color: "var(--success-600)" },
  { key: "d1_30", color: "var(--gray-700)" },
  { key: "d31_60", color: "var(--warning-600)" },
  { key: "d61_90", color: "var(--warning-700)" },
  { key: "d90plus", color: "var(--error-600)" },
];

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

function BucketCells({ buckets, ta }: { buckets: Buckets; ta: (k: string, v?: Record<string, string | number>) => string }) {
  return (
    <>
      {BUCKETS.map(({ key, color }) => (
        <td key={key} className="num" style={buckets[key] > 0 && key !== "current" && key !== "d1_30" ? { color } : undefined}>
          {buckets[key] > 0 ? fmt0(buckets[key]) : <span style={{ color: "var(--gray-300)" }}>—</span>}
        </td>
      ))}
    </>
  );
}

export default function AgingReceivables({ data, properties, preset, rangeText, fromDate, toDate, selectedPropertyId }: Props) {
  const router = useRouter();
  const t = useTranslations("reports");
  const tf = useTranslations("reports.filters");
  const ta = useTranslations("reports.aging");
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
    startTransition(() => router.push(`/dashboard/reports/aging-receivables${qs ? `?${qs}` : ""}`));
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

  function exportXlsx() {
    const rows = [["Building", "Tenant", "Invoice", "Due", "Days overdue", "Current", "1-30", "31-60", "61-90", "90+", "Balance"]];
    for (const b of data.buildings) for (const tn of b.tenants) for (const inv of tn.invoices) {
      const col = (k: AgingBucketKey) => (inv.bucket === k ? inv.balance.toFixed(3) : "");
      rows.push([b.name, tn.name, inv.number, inv.dueDate.slice(0, 10), String(inv.daysOverdue > 0 ? inv.daysOverdue : 0),
        col("current"), col("d1_30"), col("d31_60"), col("d61_90"), col("d90plus"), inv.balance.toFixed(3)]);
    }
    rows.push([]);
    const kb = k.buckets;
    rows.push(["Total", "", "", "", "", kb.current.toFixed(3), kb.d1_30.toFixed(3), kb.d31_60.toFixed(3), kb.d61_90.toFixed(3), kb.d90plus.toFixed(3), k.totalDue.toFixed(3)]);
    void downloadXlsx(rows, `aging-receivables-${data.asOf}`);
  }

  const k = data.kpis;
  const presetItems = DATE_PRESETS.map((p) => ({ key: p.key, label: t(`presets.${p.key}`) }));
  const presetLabel = t(`presets.${preset === "custom" ? "custom" : preset}` as never);
  const buildingOptions = [allBuildings, ...properties.map((p) => p.name)];
  const dist = useMemo(() => BUCKETS.map(({ key, color }) => ({ key, color, val: k.buckets[key], pct: k.totalDue > 0 ? (k.buckets[key] / k.totalDue) * 100 : 0 })), [k]);

  return (
    <main className="rpage">
      <div className="crumbs">
        <span>{t("breadcrumbRoot")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span>{t("groups.financial")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span className="current">{t("items.aging-receivables")}</span>
      </div>

      <div className="rhead">
        <div className="title-block">
          <h1>{t("items.aging-receivables")}</h1>
          <p className="sub">{ta("subtitle")}<span className="tag">{ta("asOf", { date: asOfLabel })}</span></p>
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
            <FilterControl label={ta("asOfLabel")} span2 active icon={<svg className="ic-sm ic-cal"><use href="#i-cal" /></svg>}
              value={presetLabel} display={asOfLabel}
              options={presetItems.map((p) => p.label)}
              onChange={(lbl) => { const p = presetItems.find((x) => x.label === lbl); navigate({ preset: p?.key ?? "today" }); }} />
            <FilterControl label={tf("building")} span2 active={!!selectedPropertyId} icon={<svg className="ic-sm" style={{ color: "var(--brand-500)" }}><use href="#i-building" /></svg>}
              value={selectedBuilding}
              options={buildingOptions}
              onChange={(name) => { const prop = properties.find((p) => p.name === name); navigate({ propertyId: prop ? prop.id : null }); }} />
            <div className="fpanel-field">
              <span className="fpanel-label">{ta("asOfLabel")}</span>
              <input type="date" className="fpanel-control" value={toDate} onChange={(e) => navigate({ preset: "custom", from: e.target.value, to: e.target.value })} />
            </div>
          </div>
        </div>
      </section>

      {/* KPI cards */}
      <div className="kpi-row cols-4">
        <div className="kpi-card is-primary">
          <div className="kpi-label"><span className="pulse" />{ta("kpiTotal")}</div>
          <div className="kpi-value">{pending ? <Skel w={90} h={22} /> : <>{fmt0(k.totalDue)}<span className="unit">{ta("omr")}</span></>}</div>
          <div className="kpi-sub">{ta("invoicesOwing", { count: k.invoiceCount })}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{ta("kpiCurrent")}</div>
          <div className="kpi-value" style={{ color: "var(--success-600)" }}>{pending ? <Skel w={80} h={22} /> : <>{fmt0(k.current)}<span className="unit">{ta("omr")}</span></>}</div>
        </div>
        <div className="kpi-card is-warning">
          <div className="kpi-label">{ta("kpiOverdue")}</div>
          <div className="kpi-value" style={{ color: k.overdue > 0 ? "var(--warning-600)" : undefined }}>{pending ? <Skel w={70} h={22} /> : <>{fmt0(k.overdue)}<span className="unit">{ta("omr")}</span></>}</div>
          <div className="kpi-sub">{ta("tenantsOwing", { count: k.tenantCount })}</div>
        </div>
        <div className="kpi-card is-error">
          <div className="kpi-label">{ta("kpi90")}</div>
          <div className="kpi-value" style={{ color: k.buckets.d90plus > 0 ? "var(--error-600)" : undefined }}>{pending ? <Skel w={70} h={22} /> : <>{fmt0(k.buckets.d90plus)}<span className="unit">{ta("omr")}</span></>}</div>
        </div>
      </div>

      {/* Aging distribution bar */}
      {!pending && k.totalDue > 0 && (
        <section className="occ-chart" style={{ padding: "12px 16px" }}>
          <div className="chart-head" style={{ marginBottom: 8 }}><span className="title">{ta("distribution")}</span></div>
          <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", background: "var(--gray-100)" }}>
            {dist.filter((d) => d.pct > 0).map((d) => (
              <div key={d.key} style={{ width: `${d.pct}%`, background: d.color }} title={`${ta(`bucket_${d.key}`)} · ${fmt0(d.val)} ${ta("omr")} (${d.pct.toFixed(0)}%)`} />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
            {dist.map((d) => (
              <div key={d.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--gray-700)" }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color, display: "inline-block" }} />
                {ta(`bucket_${d.key}`)} <span className="mono" style={{ color: "var(--gray-500)" }}>{fmt0(d.val)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Report table */}
      <section className="rtable-wrap">
        <div className="rtable-toolbar">
          <div className="left">
            <span className="title">{ta("tableTitle")}</span>
            <span className="meta">{ta("tableMeta", { count: k.buildingCount })}</span>
          </div>
          <div className="left" style={{ gap: 8 }}>
            <div className="seg">
              <button className={level === "collapse" ? "active" : ""} onClick={() => applyLevel("collapse")}>{ta("collapseAll")}</button>
              <button className={level === "l2" ? "active" : ""} onClick={() => applyLevel("l2")}>{ta("level", { n: 2 })}</button>
              <button className={level === "l3" ? "active" : ""} onClick={() => applyLevel("l3")}>{ta("level", { n: 3 })}</button>
              <button className={level === "expand" ? "active" : ""} onClick={() => applyLevel("expand")}>{ta("expandAll")}</button>
            </div>
          </div>
        </div>

        <div className="rtable-scroll">
          <table className="rtable">
            <thead>
              <tr>
                <th>{ta("colName")}</th>
                {BUCKETS.map(({ key }) => <th key={key} className="num">{ta(`bucket_${key}`)}</th>)}
                <th className="num">{ta("colTotal")}</th>
              </tr>
            </thead>
            <tbody>
              {pending ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td><Skel w={160} /></td>{BUCKETS.map((_, j) => <td key={j} className="num"><Skel w={44} /></td>)}<td className="num"><Skel w={60} /></td></tr>
                ))
              ) : data.buildings.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "var(--gray-500)" }}>{ta("empty")}</td></tr>
              ) : (
                <>
                  {data.buildings.map((b) => (
                    <BuildingRows key={b.id} b={b} expanded={expanded} toggle={toggle} locale={loc} ta={ta} />
                  ))}
                  <tr className="is-grand">
                    <td>{ta("grandTotal", { count: k.buildingCount })}</td>
                    <BucketCells buckets={k.buckets} ta={ta} />
                    <td className="num">{fmt0(k.totalDue)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="rtable-footer">
          <span>{ta("footer")}</span>
          <div className="right"><span>{ta("source")}</span></div>
        </div>
      </section>
    </main>
  );
}

function BuildingRows({ b, expanded, toggle, locale, ta }: {
  b: AgingBuilding; expanded: Set<string>; toggle: (id: string) => void; locale: string;
  ta: (k: string, v?: Record<string, string | number>) => string;
}) {
  const open = expanded.has(b.id);
  return (
    <>
      <tr className="lvl-1">
        <td>
          <Chevron open={open} onClick={() => toggle(b.id)} />
          {b.name} <span className="mono" style={{ color: "var(--gray-500)", fontWeight: 400, marginInlineStart: 6, fontSize: 11 }}>{ta("tenantsCount", { count: b.tenantCount })}</span>
        </td>
        <BucketCells buckets={b.buckets} ta={ta} />
        <td className="num">{fmt0(b.total)}</td>
      </tr>
      {open && b.tenants.map((tn) => (
        <TenantRows key={tn.id} b={b} tn={tn} open={expanded.has(`${b.id}:${tn.id}`)} toggle={toggle} locale={locale} ta={ta} />
      ))}
      {open && (
        <tr className="is-total">
          <td>{ta("subtotal", { name: b.name })}</td>
          <BucketCells buckets={b.buckets} ta={ta} />
          <td className="num">{fmt0(b.total)}</td>
        </tr>
      )}
    </>
  );
}

function TenantRows({ b, tn, open, toggle, locale, ta }: {
  b: AgingBuilding; tn: AgingTenant; open: boolean; toggle: (id: string) => void; locale: string;
  ta: (k: string, v?: Record<string, string | number>) => string;
}) {
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  return (
    <>
      <tr className="lvl-2">
        <td>
          <Chevron open={open} onClick={() => toggle(`${b.id}:${tn.id}`)} />
          {tn.name} <span className="mono" style={{ color: "var(--gray-500)", fontWeight: 400, marginInlineStart: 6, fontSize: 11 }}>{ta("invoiceCount", { count: tn.invoices.length })}</span>
        </td>
        <BucketCells buckets={tn.buckets} ta={ta} />
        <td className="num">{fmt0(tn.total)}</td>
      </tr>
      {open && tn.invoices.map((inv) => {
        const over = inv.daysOverdue > 0;
        return (
          <tr className="lvl-3" key={inv.id}>
            <td>
              <span className="row-leaf" />
              <span className={`badge ${over ? "b-due" : "b-paid"}`} style={{ marginInlineEnd: 8 }}>
                <span className="dot" />{over ? ta("daysOverdue", { count: inv.daysOverdue }) : ta("current")}
              </span>
              <a className="r-link" href={`/dashboard/invoices/${inv.id}`}>{inv.number}</a>
              <span className="mono" style={{ color: "var(--gray-500)", fontSize: "10.5px", marginInlineStart: 6 }}>{ta("due", { date: fmtDate(inv.dueDate) })}</span>
            </td>
            {BUCKETS.map(({ key, color }) => (
              <td key={key} className="num" style={inv.bucket === key && key !== "current" && key !== "d1_30" ? { color } : undefined}>
                {inv.bucket === key ? fmt3(inv.balance) : <span style={{ color: "var(--gray-300)" }}>—</span>}
              </td>
            ))}
            <td className="num">{fmt3(inv.balance)}</td>
          </tr>
        );
      })}
    </>
  );
}
