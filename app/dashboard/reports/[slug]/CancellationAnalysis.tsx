"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { DATE_PRESETS } from "../reports-config";
import type { CancelReport, CancelSource } from "@/lib/reports/cancellation-analysis";

interface Props {
  data: CancelReport;
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

const SOURCE_ICON: Record<string, string> = {
  walk_in: "🚶", phone: "📞", whatsapp: "💬", website: "🌐", online: "🌐", booking_com: "🏨", airbnb: "🏠", referral: "🤝", agent: "🧑‍💼", returning: "↩️", returning_guest: "↩️", corporate_contract: "🏢", other: "•",
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

export default function CancellationAnalysis({ data, properties, preset, rangeText, fromDate, toDate, selectedPropertyId }: Props) {
  const router = useRouter();
  const t = useTranslations("reports");
  const tf = useTranslations("reports.filters");
  const tc = useTranslations("reports.cancel");
  const tRoot = useTranslations();
  const locale = useLocale();
  const loc = locale === "ar" ? "ar" : "en-GB";
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(data.sources.map((s) => s.source)));

  const allBuildings = tf("allBuildings");
  const selectedBuilding = properties.find((p) => p.id === selectedPropertyId)?.name ?? allBuildings;
  const srcLabel = (s: string) => {
    const full = `tenants.sources.${s}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (tRoot as any).has(full) ? (tRoot as any)(full) : s.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  };

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
    startTransition(() => router.push(`/dashboard/reports/cancellation-analysis${qs ? `?${qs}` : ""}`));
  }

  function toggle(id: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  const allOpen = expanded.size >= data.sources.length && data.sources.length > 0;

  function exportCsv() {
    const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [["Source", "Reservation", "Status", "Reason", "Date", "Lost value (OMR)"]];
    for (const s of data.sources) for (const it of s.items) {
      rows.push([srcLabel(s.source), it.number ?? "", it.status, it.reason ?? "", it.date.slice(0, 10), it.value.toFixed(3)]);
    }
    rows.push([]);
    rows.push(["Total", "", "", "", "", k.lostValue.toFixed(3)]);
    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `cancellation-analysis-${fromDate}_${toDate}.csv`;
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
        <span>{t("groups.operational")}</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span className="current">{t("items.cancellation-analysis")}</span>
      </div>

      <div className="rhead">
        <div className="title-block">
          <h1>{t("items.cancellation-analysis")}</h1>
          <p className="sub">{tc("subtitle")}<span className="tag">{rangeText}</span></p>
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
          <div className="kpi-label"><span className="pulse" />{tc("kpiCancellations")}</div>
          <div className="kpi-value">{pending ? <Skel w={50} h={22} /> : k.cancellations}</div>
          <div className="kpi-sub">{tc("ofBookings", { count: k.total })}</div>
        </div>
        <div className="kpi-card is-warning">
          <div className="kpi-label">{tc("kpiRate")}</div>
          <div className="kpi-value" style={{ color: k.rate > 0 ? "var(--warning-600)" : undefined }}>{pending ? <Skel w={50} h={22} /> : pct0(k.rate)}</div>
        </div>
        <div className="kpi-card is-error">
          <div className="kpi-label">{tc("kpiLost")}</div>
          <div className="kpi-value" style={{ color: k.lostValue > 0 ? "var(--error-600)" : undefined }}>{pending ? <Skel w={80} h={22} /> : <>{fmt0(k.lostValue)}<span className="unit">{tc("omr")}</span></>}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{tc("kpiNoShows")}</div>
          <div className="kpi-value">{pending ? <Skel w={40} h={22} /> : k.noShows}</div>
          <div className="kpi-sub">{tc("ofCancellations", { count: k.cancellations })}</div>
        </div>
      </div>

      {/* Report table */}
      <section className="rtable-wrap">
        <div className="rtable-toolbar">
          <div className="left">
            <span className="title">{tc("tableTitle")}</span>
            <span className="meta">{tc("tableMeta", { count: k.sourceCount })}</span>
          </div>
          <div className="left" style={{ gap: 8 }}>
            <div className="seg">
              <button className={!allOpen ? "active" : ""} onClick={() => setExpanded(new Set())}>{tc("collapseAll")}</button>
              <button className={allOpen ? "active" : ""} onClick={() => setExpanded(new Set(data.sources.map((s) => s.source)))}>{tc("expandAll")}</button>
            </div>
          </div>
        </div>

        <div className="rtable-scroll">
          <table className="rtable">
            <thead>
              <tr>
                <th>{tc("colName")}</th>
                <th className="num">{tc("colCancellations")}</th>
                <th className="num">{tc("colRate")}</th>
                <th className="num">{tc("colLost")}</th>
              </tr>
            </thead>
            <tbody>
              {pending ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td><Skel w={160} /></td>{[0, 1, 2].map((j) => <td key={j} className="num"><Skel w={48} /></td>)}</tr>
                ))
              ) : data.sources.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: "40px", textAlign: "center", color: "var(--gray-500)" }}>{tc("empty")}</td></tr>
              ) : (
                <>
                  {data.sources.map((s) => (
                    <SourceRows key={s.source} s={s} open={expanded.has(s.source)} toggle={toggle} label={srcLabel(s.source)} icon={SOURCE_ICON[s.source] ?? "•"} locale={loc} tc={tc} />
                  ))}
                  <tr className="is-grand">
                    <td>{tc("grandTotal", { count: k.sourceCount })}</td>
                    <td className="num">{k.cancellations}</td>
                    <td className="num">{pct0(k.rate)}</td>
                    <td className="num">{fmt3(k.lostValue)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="rtable-footer">
          <span>{tc("footer")}</span>
          <div className="right"><span>{tc("source")}</span></div>
        </div>
      </section>
    </main>
  );
}

function SourceRows({ s, open, toggle, label, icon, locale, tc }: {
  s: CancelSource; open: boolean; toggle: (id: string) => void; label: string; icon: string; locale: string;
  tc: (k: string, v?: Record<string, string | number>) => string;
}) {
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  return (
    <>
      <tr className="lvl-1">
        <td>
          <Chevron open={open} onClick={() => toggle(s.source)} />
          <span style={{ marginInlineEnd: 6 }}>{icon}</span>{label}
          <span className="mono" style={{ color: "var(--gray-500)", fontWeight: 400, marginInlineStart: 6, fontSize: 11 }}>{tc("ofTotal", { cancelled: s.cancellations, total: s.total })}</span>
        </td>
        <td className="num">{s.cancellations}</td>
        <td className="num" style={{ color: s.rate >= 0.5 ? "var(--error-600)" : s.rate > 0 ? "var(--warning-600)" : undefined }}>{`${Math.round(s.rate * 100)}%`}</td>
        <td className="num" style={{ color: "var(--error-600)", fontWeight: 600 }}>{fmt0(s.lostValue)}</td>
      </tr>
      {open && s.items.map((it) => {
        const isNoShow = it.status === "NO_SHOW";
        return (
          <tr className="lvl-2" key={it.id}>
            <td>
              <span className="row-leaf" />
              <span className="badge" style={{ marginInlineEnd: 8, color: isNoShow ? "var(--error-600)" : "var(--gray-600)", borderColor: "color-mix(in oklch, currentColor 30%, transparent)" }}>
                <span className="dot" style={{ background: isNoShow ? "var(--error-500)" : "var(--gray-400)" }} />{isNoShow ? tc("noShow") : tc("cancelled")}
              </span>
              {it.number
                ? <a className="r-link" href={`/dashboard/reservations/${it.id}`}>{it.number}</a>
                : <a className="r-link" href={`/dashboard/reservations/${it.id}`}>{tc("noRef")}</a>}
              {it.reason ? <> · {it.reason}</> : null}
              <span className="mono" style={{ color: "var(--gray-500)", fontSize: "10.5px", marginInlineStart: 6 }}>{fmtDate(it.date)}</span>
            </td>
            <td className="num"><span style={{ color: "var(--gray-300)" }}>—</span></td>
            <td className="num"><span style={{ color: "var(--gray-300)" }}>—</span></td>
            <td className="num" style={{ color: "var(--error-600)" }}>{it.value > 0 ? fmt3(it.value) : <span style={{ color: "var(--gray-300)" }}>—</span>}</td>
          </tr>
        );
      })}
    </>
  );
}
