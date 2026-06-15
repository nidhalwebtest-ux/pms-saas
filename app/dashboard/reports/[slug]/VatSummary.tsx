"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { downloadXlsx } from "@/lib/reports/export-xlsx";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { DATE_PRESETS } from "../reports-config";
import type { VatReport } from "@/lib/reports/vat-summary";

interface Props {
  data: VatReport;
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

export default function VatSummary({ data, properties, preset, rangeText, fromDate, toDate, selectedPropertyId }: Props) {
  const router = useRouter();
  const t = useTranslations("reports");
  const tf = useTranslations("reports.filters");
  const tv = useTranslations("reports.vat");
  const locale = useLocale();
  const loc = locale === "ar" ? "ar" : "en-GB";
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(true);

  const allBuildings = tf("allBuildings");
  const selectedBuilding = properties.find((p) => p.id === selectedPropertyId)?.name ?? allBuildings;
  const monthLabel = (iso: string) => new Date(iso).toLocaleDateString(loc, { month: "long", year: "numeric" });

  function navigate(next: { preset?: string; propertyId?: string | null; from?: string; to?: string }) {
    const sp = new URLSearchParams();
    const p = next.preset ?? preset;
    if (p && p !== "year") sp.set("preset", p);
    if (p === "custom") {
      const f = next.from ?? fromDate, tt = next.to ?? toDate;
      if (f) sp.set("from", f); if (tt) sp.set("to", tt);
    }
    const pid = next.propertyId === undefined ? selectedPropertyId : next.propertyId;
    if (pid) sp.set("propertyId", pid);
    const qs = sp.toString();
    startTransition(() => router.push(`/dashboard/reports/vat-summary${qs ? `?${qs}` : ""}`));
  }

  function exportXlsx() {
    const rows = [["Period", "Invoices", "Taxable sales", "Output VAT", "Gross"]];
    for (const b of data.buckets) rows.push([b.start.slice(0, 7), String(b.invoiceCount), b.taxableSales.toFixed(3), b.vat.toFixed(3), b.gross.toFixed(3)]);
    rows.push([]);
    rows.push(["Total", String(k.invoiceCount), k.taxableSales.toFixed(3), k.vat.toFixed(3), k.gross.toFixed(3)]);
    void downloadXlsx(rows, `vat-summary-${fromDate}_${toDate}`);
  }

  const k = data.kpis;
  const presetItems = DATE_PRESETS.map((p) => ({ key: p.key, label: t(`presets.${p.key}`) }));
  const presetLabel = t(`presets.${preset === "custom" ? "custom" : preset}` as never);
  const buildingOptions = [allBuildings, ...properties.map((p) => p.name)];

  return (
    <main className="rpage">
      <div className="crumbs">
        <span>{t("breadcrumbRoot")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span>{t("groups.tax")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span className="current">{t("items.vat-summary")}</span>
      </div>

      <div className="rhead">
        <div className="title-block">
          <h1>{t("items.vat-summary")}</h1>
          <p className="sub">{tv("subtitle")}<span className="tag">{rangeText}</span></p>
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
            <button className="link muted" onClick={() => navigate({ preset: "year", propertyId: null })}>{tf("reset")}</button>
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
              onChange={(lbl) => { const p = presetItems.find((x) => x.label === lbl); navigate({ preset: p?.key ?? "year" }); }} />
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
          <div className="kpi-label"><span className="pulse" />{tv("kpiVat")}</div>
          <div className="kpi-value">{pending ? <Skel w={90} h={22} /> : <>{fmt0(k.vat)}<span className="unit">{tv("omr")}</span></>}</div>
          <div className="kpi-sub">{tv("outputVat")}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tv("kpiTaxable")}</div>
          <div className="kpi-value">{pending ? <Skel w={80} h={22} /> : <>{fmt0(k.taxableSales)}<span className="unit">{tv("omr")}</span></>}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tv("kpiGross")}</div>
          <div className="kpi-value">{pending ? <Skel w={80} h={22} /> : <>{fmt0(k.gross)}<span className="unit">{tv("omr")}</span></>}</div>
          <div className="kpi-sub">{tv("invoicesCount", { count: k.invoiceCount })}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tv("kpiRate")}</div>
          <div className="kpi-value">{pending ? <Skel w={50} h={22} /> : `${(k.effectiveRate * 100).toFixed(1)}%`}</div>
          <div className="kpi-sub">{tv("effective")}</div>
        </div>
      </div>

      {/* VAT register table */}
      <section className="rtable-wrap">
        <div className="rtable-toolbar">
          <div className="left">
            <span className="title">{tv("tableTitle")}</span>
            <span className="meta">{tv("tableMeta", { count: data.buckets.length })}</span>
          </div>
        </div>
        <div className="rtable-scroll">
          <table className="rtable">
            <thead>
              <tr>
                <th>{tv("colPeriod")}</th>
                <th className="num">{tv("colInvoices")}</th>
                <th className="num">{tv("colTaxable")}</th>
                <th className="num">{tv("colVat")}</th>
                <th className="num">{tv("colGross")}</th>
              </tr>
            </thead>
            <tbody>
              {pending ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td><Skel w={120} /></td>{[0, 1, 2, 3].map((j) => <td key={j} className="num"><Skel w={56} /></td>)}</tr>
                ))
              ) : data.buckets.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "var(--gray-500)" }}>{tv("empty")}</td></tr>
              ) : (
                <>
                  {data.buckets.map((b) => (
                    <tr key={b.key}>
                      <td>{monthLabel(b.start)}</td>
                      <td className="num dim">{b.invoiceCount || <span style={{ color: "var(--gray-300)" }}>—</span>}</td>
                      <td className="num">{fmt3(b.taxableSales)}</td>
                      <td className="num" style={{ fontWeight: 600, color: b.vat > 0 ? "var(--brand-600)" : "var(--gray-400)" }}>{b.vat > 0 ? fmt3(b.vat) : "—"}</td>
                      <td className="num dim">{fmt3(b.gross)}</td>
                    </tr>
                  ))}
                  <tr className="is-grand">
                    <td>{tv("grandTotal")}</td>
                    <td className="num">{k.invoiceCount}</td>
                    <td className="num">{fmt3(k.taxableSales)}</td>
                    <td className="num">{fmt3(k.vat)}</td>
                    <td className="num">{fmt3(k.gross)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="rtable-footer">
          <span>{tv("footer")}</span>
          <div className="right"><span>{tv("source")}</span></div>
        </div>
      </section>
    </main>
  );
}
