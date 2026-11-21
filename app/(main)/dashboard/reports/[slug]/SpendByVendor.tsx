"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { downloadXlsx } from "@/lib/reports/export-xlsx";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { DATE_PRESETS } from "../reports-config";
import type { SpendByVendorReport, VendorSpendRow } from "@/lib/reports/spend-by-vendor";

interface Props {
  data: SpendByVendorReport;
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

type SortKey = "totalSpend" | "expenseCount" | "percentOfTotal";

export default function SpendByVendor({ data, properties, preset, rangeText, fromDate, toDate, selectedPropertyId }: Props) {
  const router = useRouter();
  const t = useTranslations("reports");
  const tf = useTranslations("reports.filters");
  const tv = useTranslations("reports.spendByVendor");
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: "desc" | "asc" }>({ key: "totalSpend", dir: "desc" });

  const allBuildings = tf("allBuildings");
  const selectedBuilding = properties.find((p) => p.id === selectedPropertyId)?.name ?? allBuildings;

  const sortedVendors = useMemo(() => {
    const dir = sort.dir === "desc" ? -1 : 1;
    return [...data.vendors].sort((a, b) => dir * (a[sort.key] - b[sort.key]));
  }, [data.vendors, sort]);

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
    startTransition(() => router.push(`/dashboard/reports/spend-by-vendor${qs ? `?${qs}` : ""}`));
  }

  function exportXlsx() {
    const rows = [[tv("colVendor"), tv("colCategory"), tv("colExpenseCount"), tv("colTotalSpend"), tv("colPercent")]];
    for (const v of sortedVendors) {
      rows.push([v.vendorName, v.categoryName ?? "", String(v.expenseCount), v.totalSpend.toFixed(3), `${v.percentOfTotal}%`]);
    }
    rows.push([]);
    rows.push([tv("grandTotal"), "", String(k.expenseCount), k.totalSpend.toFixed(3), "100%"]);
    void downloadXlsx(rows, `spend-by-vendor-${fromDate}_${toDate}`);
  }

  const k = data.kpis;
  const presetItems = DATE_PRESETS.map((p) => ({ key: p.key, label: t(`presets.${p.key}`) }));
  const presetLabel = t(`presets.${preset === "custom" ? "custom" : preset}` as never);
  const buildingOptions = [allBuildings, ...properties.map((p) => p.name)];

  const Th = ({ k: key, label }: { k: SortKey; label: string }) => (
    <th className={`num sortable ${sort.key === key ? (sort.dir === "desc" ? "sorted-desc" : "sorted-asc") : ""}`} onClick={() => setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }))}>
      {label}<span className="sort"><svg className="ic-xs up"><use href="#i-chev-up" /></svg><svg className="ic-xs down"><use href="#i-chev-down" /></svg></span>
    </th>
  );

  return (
    <main className="rpage">
      <div className="crumbs">
        <span>{t("breadcrumbRoot")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span>{t("groups.financial")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span className="current">{t("items.spend-by-vendor")}</span>
      </div>

      <div className="rhead">
        <div className="title-block">
          <h1>{t("items.spend-by-vendor")}</h1>
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
      <div className="kpi-row cols-3">
        <div className="kpi-card is-primary">
          <div className="kpi-label"><span className="pulse" />{tv("kpiTotalSpend")}</div>
          <div className="kpi-value">{pending ? <Skel w={90} h={22} /> : <>{fmt0(k.totalSpend)}<span className="unit">{tv("omr")}</span></>}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tv("kpiVendorCount")}</div>
          <div className="kpi-value">{pending ? <Skel w={50} h={22} /> : k.vendorCount}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tv("kpiExpenseCount")}</div>
          <div className="kpi-value">{pending ? <Skel w={50} h={22} /> : k.expenseCount}</div>
        </div>
      </div>

      {/* Report table */}
      <section className="rtable-wrap">
        <div className="rtable-toolbar">
          <div className="left">
            <span className="title">{tv("tableTitle")}</span>
            <span className="meta">{tv("tableMeta", { count: k.vendorCount })}</span>
          </div>
        </div>

        <div className="rtable-scroll">
          <table className="rtable">
            <thead>
              <tr>
                <th>{tv("colVendor")}</th>
                <th>{tv("colCategory")}</th>
                <Th k="expenseCount" label={tv("colExpenseCount")} />
                <Th k="totalSpend" label={tv("colTotalSpend")} />
                <Th k="percentOfTotal" label={tv("colPercent")} />
              </tr>
            </thead>
            <tbody>
              {pending ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td><Skel w={160} /></td><td><Skel w={100} /></td>{[0, 1, 2].map((j) => <td key={j} className="num"><Skel w={56} /></td>)}</tr>
                ))
              ) : data.vendors.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "var(--gray-500)" }}>{tv("empty")}</td></tr>
              ) : (
                <>
                  {sortedVendors.map((v: VendorSpendRow) => (
                    <tr key={v.vendorId} className="lvl-1">
                      <td>{v.vendorName}</td>
                      <td>{v.categoryName ?? "—"}</td>
                      <td className="num">{v.expenseCount}</td>
                      <td className="num">{fmt3(v.totalSpend)}</td>
                      <td className="num">{v.percentOfTotal}%</td>
                    </tr>
                  ))}
                  <tr className="is-grand">
                    <td>{tv("grandTotal")}</td>
                    <td />
                    <td className="num">{k.expenseCount}</td>
                    <td className="num">{fmt0(k.totalSpend)}</td>
                    <td className="num">100%</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="rtable-footer">
          <span>{tv("footer")}</span>
        </div>
      </section>
    </main>
  );
}
