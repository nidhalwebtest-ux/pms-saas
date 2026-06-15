"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { downloadXlsx } from "@/lib/reports/export-xlsx";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { DATE_PRESETS } from "../reports-config";
import type { BookingSourcesReport, SourceRow } from "@/lib/reports/booking-sources";

interface Props {
  data: BookingSourcesReport;
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

const DIST_COLORS = ["var(--brand-500)", "var(--warning-500)", "var(--success-500)", "var(--error-500)", "var(--gold-500)", "var(--gray-400)", "var(--brand-300)", "var(--warning-700)"];
const SOURCE_ICON: Record<string, string> = {
  walk_in: "🚶", phone: "📞", whatsapp: "💬", website: "🌐", online: "🌐", booking_com: "🏨", airbnb: "🏠", referral: "🤝", agent: "🧑‍💼", returning: "↩️", returning_guest: "↩️", corporate_contract: "🏢", other: "•",
};

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

type SortKey = "bookings" | "nights" | "value" | "avgValue";

export default function BookingSources({ data, properties, preset, rangeText, fromDate, toDate, selectedPropertyId }: Props) {
  const router = useRouter();
  const t = useTranslations("reports");
  const tf = useTranslations("reports.filters");
  const tb = useTranslations("reports.bookingSrc");
  const tRoot = useTranslations();
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: "desc" | "asc" }>({ key: "bookings", dir: "desc" });

  const allBuildings = tf("allBuildings");
  const selectedBuilding = properties.find((p) => p.id === selectedPropertyId)?.name ?? allBuildings;
  const srcLabel = (s: string) => {
    const full = `tenants.sources.${s}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (tRoot as any).has(full) ? (tRoot as any)(full) : s.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  };

  const sortedSources = useMemo(() => {
    const dir = sort.dir === "desc" ? -1 : 1;
    return [...data.sources].sort((a, b) => dir * ((a[sort.key] as number) - (b[sort.key] as number)));
  }, [data.sources, sort]);

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
    startTransition(() => router.push(`/dashboard/reports/booking-sources${qs ? `?${qs}` : ""}`));
  }

  function setSortKey(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  }

  function exportXlsx() {
    const rows = [["Source", "Bookings", "Share %", "Nights", "Booked value (OMR)", "Avg value"]];
    for (const s of sortedSources) rows.push([srcLabel(s.source), String(s.bookings), String(Math.round(s.share * 100)), String(s.nights), s.value.toFixed(3), s.avgValue.toFixed(3)]);
    rows.push([]);
    rows.push(["Total", String(k.bookings), "100", String(k.nights), k.value.toFixed(3), k.avgValue.toFixed(3)]);
    void downloadXlsx(rows, `booking-sources-${fromDate}_${toDate}`);
  }

  const k = data.kpis;
  const presetItems = DATE_PRESETS.map((p) => ({ key: p.key, label: t(`presets.${p.key}`) }));
  const presetLabel = t(`presets.${preset === "custom" ? "custom" : preset}` as never);
  const buildingOptions = [allBuildings, ...properties.map((p) => p.name)];
  const dist = useMemo(() => data.sources.map((s, i) => ({ source: s.source, label: srcLabel(s.source), color: DIST_COLORS[i % DIST_COLORS.length], pct: s.share * 100, bookings: s.bookings })), [data.sources]);

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
        <span className="current">{t("items.booking-sources")}</span>
      </div>

      <div className="rhead">
        <div className="title-block">
          <h1>{t("items.booking-sources")}</h1>
          <p className="sub">{tb("subtitle")}<span className="tag">{rangeText}</span></p>
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
          <div className="kpi-label"><span className="pulse" />{tb("kpiBookings")}</div>
          <div className="kpi-value">{pending ? <Skel w={60} h={22} /> : k.bookings}</div>
          <div className="kpi-sub">{tb("viaSources", { count: k.sourceCount })}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tb("kpiValue")}</div>
          <div className="kpi-value">{pending ? <Skel w={80} h={22} /> : <>{fmt0(k.value)}<span className="unit">{tb("omr")}</span></>}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tb("kpiAvg")}</div>
          <div className="kpi-value">{pending ? <Skel w={70} h={22} /> : <>{fmt0(k.avgValue)}<span className="unit">{tb("omr")}</span></>}</div>
          <div className="kpi-sub">{tb("perBooking")}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tb("kpiTop")}</div>
          <div className="kpi-value kpi-value small">{pending ? <Skel w={80} h={18} /> : (k.topSource ? `${SOURCE_ICON[k.topSource] ?? ""} ${srcLabel(k.topSource)}` : "—")}</div>
          <div className="kpi-sub">{tb("bookingsN", { count: k.topBookings })}</div>
        </div>
      </div>

      {/* Distribution */}
      {!pending && k.bookings > 0 && (
        <section className="occ-chart" style={{ padding: "12px 16px" }}>
          <div className="chart-head" style={{ marginBottom: 8 }}><span className="title">{tb("distribution")}</span></div>
          <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", background: "var(--gray-100)" }}>
            {dist.filter((d) => d.pct > 0).map((d) => (
              <div key={d.source} style={{ width: `${d.pct}%`, background: d.color }} title={`${d.label} · ${d.bookings} (${d.pct.toFixed(0)}%)`} />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
            {dist.map((d) => (
              <div key={d.source} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--gray-700)" }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color, display: "inline-block" }} />
                {SOURCE_ICON[d.source] ? `${SOURCE_ICON[d.source]} ` : ""}{d.label} <span className="mono" style={{ color: "var(--gray-500)" }}>{d.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Report table */}
      <section className="rtable-wrap">
        <div className="rtable-toolbar">
          <div className="left">
            <span className="title">{tb("tableTitle")}</span>
            <span className="meta">{tb("tableMeta", { count: k.sourceCount })}</span>
          </div>
        </div>
        <div className="rtable-scroll">
          <table className="rtable">
            <thead>
              <tr>
                <th>{tb("colName")}</th>
                <Th k="bookings" label={tb("colBookings")} />
                <Th k="nights" label={tb("colNights")} />
                <Th k="value" label={tb("colValue")} />
                <Th k="avgValue" label={tb("colAvg")} />
              </tr>
            </thead>
            <tbody>
              {pending ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td><Skel w={150} /></td>{[0, 1, 2, 3].map((j) => <td key={j} className="num"><Skel w={48} /></td>)}</tr>
                ))
              ) : data.sources.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "var(--gray-500)" }}>{tb("empty")}</td></tr>
              ) : (
                <>
                  {sortedSources.map((s) => (
                    <tr key={s.source} className="lvl-1">
                      <td>
                        <span style={{ marginInlineEnd: 6 }}>{SOURCE_ICON[s.source] ?? "•"}</span>{srcLabel(s.source)}
                        <span className="mono" style={{ color: "var(--gray-500)", fontWeight: 400, marginInlineStart: 6, fontSize: 11 }}>{Math.round(s.share * 100)}%</span>
                      </td>
                      <td className="num">
                        <span className="bar-cell"><span className="bar"><i style={{ width: `${s.share * 100}%` }} /></span><span>{s.bookings}</span></span>
                      </td>
                      <td className="num dim">{s.nights}</td>
                      <td className="num" style={{ fontWeight: 600 }}>{fmt0(s.value)}</td>
                      <td className="num dim">{fmt0(s.avgValue)}</td>
                    </tr>
                  ))}
                  <tr className="is-grand">
                    <td>{tb("grandTotal", { count: k.sourceCount })}</td>
                    <td className="num">{k.bookings}</td>
                    <td className="num">{k.nights}</td>
                    <td className="num">{fmt3(k.value)}</td>
                    <td className="num">{fmt0(k.avgValue)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="rtable-footer">
          <span>{tb("footer")}</span>
          <div className="right"><span>{tb("source")}</span></div>
        </div>
      </section>
    </main>
  );
}
