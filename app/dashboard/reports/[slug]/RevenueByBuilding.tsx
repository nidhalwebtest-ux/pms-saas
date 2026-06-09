"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Revenue by Building — interactive view scaffold matching the design.
 * Data is representative mock; wiring to live aggregates is the next step.
 * Interactions: expandable tree, level control, date presets, filter dropdowns.
 */

// ── Mock data model ─────────────────────────────────────────────────────────
type Status = { kind: "paid" | "due" | "overdue"; label: string };
interface Reservation { id: string; ref?: string; guest: string; meta?: string; revQ1: number; revYtd: number; rate: number; status?: Status; }
interface Unit { id: string; title: string; sub?: string; revQ1: number; revYtd: number; occ?: number; tone?: "success" | "warning"; rate: number; delta?: number; spark?: string; aggregate?: boolean; reservations?: Reservation[]; }
interface Building { id: string; name: string; code: string; revQ1: number; revYtd: number; occ: number; tone: "success" | "warning"; rate: number; delta: number; spark: string; units: Unit[]; }

const DATA: Building[] = [
  {
    id: "b1", name: "Salalah Plaza", code: "SLL-001 · 12 units",
    revQ1: 62410, revYtd: 98720, occ: 94.2, tone: "success", rate: 68.4, delta: 18.2,
    spark: "0,18 10,16 20,14 30,15 40,10 50,12 60,8 70,9 80,5 90,4",
    units: [
      { id: "b1u1", title: "304 · Sea View Suite", sub: "2BR · King", revQ1: 9840, revYtd: 15260, occ: 96.0, tone: "success", rate: 114.0, delta: 22.1, spark: "0,16 10,14 20,12 30,13 40,8 50,10 60,6 70,7 80,4 90,3" },
      { id: "b1u2", title: "402 · Penthouse", sub: "3BR · Premium", revQ1: 18420, revYtd: 28340, occ: 82.5, tone: "warning", rate: 220.0, delta: 31.4, spark: "0,20 10,18 20,15 30,16 40,10 50,8 60,6 70,9 80,4 90,2" },
      { id: "b1u3", title: "+ 10 more units", revQ1: 34150, revYtd: 55120, occ: 94.0, tone: "success", rate: 58.7, delta: 16.4, aggregate: true },
    ],
  },
  {
    id: "b2", name: "Mirbat Resort", code: "MIR-002 · 14 units",
    revQ1: 53290, revYtd: 82140, occ: 88.7, tone: "success", rate: 58.9, delta: 9.4,
    spark: "0,16 10,15 20,12 30,13 40,11 50,10 60,8 70,10 80,7 90,8",
    units: [
      { id: "b2u1", title: "201 · Beach Villa", sub: "2BR", revQ1: 12200, revYtd: 18900, occ: 90.1, tone: "success", rate: 132.0, delta: 11.2, spark: "0,15 10,14 20,12 30,13 40,10 50,11 60,9 70,8 80,7 90,6" },
      { id: "b2u2", title: "+ 13 more units", revQ1: 41090, revYtd: 63240, occ: 88.5, tone: "success", rate: 54.2, delta: 8.9, aggregate: true },
    ],
  },
  {
    id: "b3", name: "Khareef Heights", code: "KHR-003 · 7 units",
    revQ1: 27160, revYtd: 39840, occ: 81.4, tone: "warning", rate: 61.3, delta: 4.1,
    spark: "0,14 10,16 20,15 30,13 40,14 50,12 60,11 70,12 80,10 90,11",
    units: [
      {
        id: "b3u1", title: "A02 · Mountain Suite", sub: "2BR", revQ1: 8940, revYtd: 12820, occ: 84.6, tone: "warning", rate: 96.0, delta: 6.8,
        spark: "0,14 10,12 20,13 30,11 40,12 50,10 60,11 70,8 80,9 90,7",
        reservations: [
          { id: "r1", ref: "BNY-04812", guest: "Reem Al-Hinai", meta: "Booking.com · 4 nights", revQ1: 384, revYtd: 384, rate: 96, status: { kind: "paid", label: "Paid" } },
          { id: "r2", ref: "BNY-04760", guest: "Priya Venkatesh", meta: "Agoda · 3 nights", revQ1: 288, revYtd: 288, rate: 96, status: { kind: "due", label: "Balance 48.00" } },
          { id: "r3", guest: "+ 21 more reservations", revQ1: 8268, revYtd: 12148, rate: 96 },
        ],
      },
      { id: "b3u2", title: "+ 6 more units", revQ1: 18220, revYtd: 27020, occ: 80.6, tone: "warning", rate: 52.4, delta: 3.6, aggregate: true },
    ],
  },
];

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

// ── Small pieces ────────────────────────────────────────────────────────────
function Spark({ stroke = "var(--gray-500)", points }: { stroke?: string; points: string }) {
  return (
    <span className="spark-cell">
      <svg viewBox="0 0 90 24"><polyline fill="none" stroke={stroke} strokeWidth={stroke.includes("brand") ? 1.5 : 1.2} points={points} /></svg>
    </span>
  );
}
function Delta({ v }: { v: number }) {
  if (v === 0) return <span className="delta-cell flat">±0%</span>;
  const up = v > 0;
  return (
    <span className={`delta-cell ${up ? "up" : "down"}`}>
      <svg className="ic-xs"><use href={up ? "#i-arrow-up" : "#i-arrow-down"} /></svg>{Math.abs(v).toFixed(1)}%
    </span>
  );
}
function Heat({ pct, tone }: { pct: number; tone: "success" | "warning" }) {
  const bg = tone === "success" ? "oklch(0.560 0.140 155 / 0.18)" : "oklch(0.745 0.150 75 / 0.20)";
  const color = tone === "success" ? "var(--success-700)" : "var(--warning-700)";
  return <span className="heat" style={{ background: bg, color }}>{pct.toFixed(1)}%</span>;
}
function Chevron({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <span className={`row-chev${open ? " is-open" : ""}`} role="button" onClick={onClick}>
      <svg className="ic-xs"><use href="#i-chev-right" /></svg>
    </span>
  );
}

// ── Filter dropdown ─────────────────────────────────────────────────────────
function FilterControl({
  label, value, options, onChange, icon, active,
}: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; icon?: React.ReactNode; active?: boolean;
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
    <div className="fpanel-field">
      <span className="fpanel-label">{label}</span>
      <div className="rdrop" ref={ref}>
        <button type="button" className={`fpanel-control${active ? " is-active" : ""}`} onClick={() => setOpen((v) => !v)}>
          {icon}
          <span>{value}</span>
          <svg className="ic-xs chev"><use href="#i-chev-down" /></svg>
        </button>
        {open && (
          <div className="rdrop-menu">
            {options.map((o) => (
              <button key={o} type="button" className={`rdrop-item${o === value ? " is-selected" : ""}`} onClick={() => { onChange(o); setOpen(false); }}>
                {o}
                {o === value && <svg className="ic-xs check"><use href="#i-chev-right" /></svg>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const PRESETS: { key: string; label: string; range: string; khareef?: boolean }[] = [
  { key: "today", label: "Today", range: "9 Jun 2026" },
  { key: "week", label: "This week", range: "8 — 14 Jun 2026" },
  { key: "month", label: "This month", range: "1 — 30 Jun 2026" },
  { key: "quarter", label: "This quarter", range: "1 Mar — 31 May 2026" },
  { key: "year", label: "This year", range: "1 Jan — 31 Dec 2026" },
  { key: "lastmonth", label: "Last month", range: "1 — 31 May 2026" },
  { key: "khareef", label: "Khareef season", range: "21 Jun — 21 Sep 2026", khareef: true },
];

// ── Component ───────────────────────────────────────────────────────────────
export default function RevenueByBuilding() {
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [level, setLevel] = useState<"collapse" | "l2" | "l3" | "expand">("l2");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(DATA.map((b) => b.id)));
  const [preset, setPreset] = useState("quarter");
  const [granularity, setGranularity] = useState("Monthly");
  const [compare, setCompare] = useState("Q1 2025");
  const [unitType, setUnitType] = useState("All types");
  const [status, setStatus] = useState("Confirmed + checked-in");

  const dateRange = PRESETS.find((p) => p.key === preset)?.range ?? "Custom";

  function applyLevel(l: typeof level) {
    setLevel(l);
    if (l === "collapse") setExpanded(new Set());
    else if (l === "l2") setExpanded(new Set(DATA.map((b) => b.id)));
    else setExpanded(new Set([...DATA.map((b) => b.id), ...DATA.flatMap((b) => b.units.map((u) => u.id))]));
  }
  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <main className="rpage">
      {/* Breadcrumb */}
      <div className="crumbs">
        <span>Reports</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span>Revenue</span><svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span className="current">Revenue by Building</span>
      </div>

      {/* Header */}
      <div className="rhead">
        <div className="title-block">
          <h1>Revenue by Building</h1>
          <p className="sub">Gross revenue across all properties for the selected period.<span className="tag">{dateRange} · vs {compare}</span></p>
        </div>
        <div className="rhead-actions">
          <button className="btn btn-ghost btn-sm"><svg className="ic-sm"><use href="#i-schedule" /></svg>Schedule</button>
          <button className="btn btn-secondary btn-sm"><svg className="ic-sm"><use href="#i-save" /></svg>Save view</button>
          <button className="btn btn-primary btn-sm"><svg className="ic-sm"><use href="#i-download" /></svg>Export<svg className="ic-xs chev"><use href="#i-chev-down" /></svg></button>
        </div>
      </div>

      {/* Filter panel */}
      <section className={`fpanel${filtersOpen ? "" : " is-collapsed"}`}>
        <div className="fpanel-head">
          <button className="title" onClick={() => setFiltersOpen((v) => !v)} style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}>
            <svg className="ic-sm chev"><use href="#i-chev-down" /></svg>Filters
          </button>
          <span className="pill-summary"><strong>4</strong> active</span>
          <div className="actions">
            <button className="link muted" onClick={() => { setPreset("quarter"); setGranularity("Monthly"); setCompare("Q1 2025"); setUnitType("All types"); setStatus("Confirmed + checked-in"); }}>Reset</button>
            <button className="link">Save current</button>
            <button className="btn btn-primary btn-sm" style={{ height: 28 }}>Apply</button>
          </div>
        </div>
        <div className="date-presets">
          {PRESETS.map((p) => (
            <button key={p.key} className={`preset${preset === p.key ? " is-active" : ""}${p.khareef ? " is-khareef" : ""}`} onClick={() => setPreset(p.key)}>{p.label}</button>
          ))}
          <button className={`preset${preset === "custom" ? " is-active" : ""}`} onClick={() => setPreset("custom")}>Custom…</button>
        </div>
        <div className="fpanel-body">
          <div className="fpanel-grid">
            <div className="fpanel-field span-2">
              <span className="fpanel-label">Date range</span>
              <button className="fpanel-control is-active">
                <svg className="ic-sm ic-cal"><use href="#i-cal" /></svg><span>{dateRange}</span><svg className="ic-xs chev"><use href="#i-chev-down" /></svg>
              </button>
            </div>
            <FilterControl label="Compare with" value={compare} active options={["Q1 2025", "Previous period", "Same period last year", "None"]} onChange={setCompare} />
            <FilterControl label="Granularity" value={granularity} options={["Daily", "Weekly", "Monthly", "Quarterly"]} onChange={setGranularity} />
            <FilterControl label="Currency" value="OMR — 3 decimals" options={["OMR — 3 decimals", "OMR — 0 decimals"]} onChange={() => {}} />
            <div className="fpanel-field span-2">
              <span className="fpanel-label">Buildings</span>
              <button className="fpanel-control is-active">
                <svg className="ic-sm" style={{ color: "var(--brand-500)" }}><use href="#i-building" /></svg><span>All buildings</span><svg className="ic-xs chev"><use href="#i-chev-down" /></svg>
              </button>
            </div>
            <FilterControl label="Unit type" value={unitType} options={["All types", "Studio", "1BR", "2BR", "3BR", "Suite"]} onChange={setUnitType} />
            <FilterControl label="Status" value={status} active options={["Confirmed + checked-in", "All statuses", "Checked-in only", "Completed"]} onChange={setStatus} />
          </div>
        </div>
      </section>

      {/* KPI cards */}
      <div className="kpi-row">
        <div className="kpi-card is-primary">
          <div className="kpi-label"><span className="pulse" />Total revenue</div>
          <div className="kpi-value">142,860<span className="unit">OMR</span></div>
          <div className="kpi-trend"><Delta v={12.4} /><span className="vs">vs {compare}</span></div>
          <div className="kpi-spark">
            <svg viewBox="0 0 200 28" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
              <polyline fill="none" stroke="var(--brand-500)" strokeWidth="1.5" points="0,20 25,18 50,16 75,17 100,12 125,14 150,9 175,11 200,5" />
              <polyline fill="none" stroke="var(--gray-300)" strokeWidth="1" strokeDasharray="2,2" points="0,22 25,22 50,20 75,21 100,18 125,19 150,16 175,17 200,15" />
            </svg>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Buildings</div>
          <div className="kpi-value">3<span className="unit">active</span></div>
          <div className="kpi-sub">33 units total · <strong>89%</strong> occupied</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Top performer</div>
          <div className="kpi-value small">Salalah Plaza</div>
          <div className="kpi-trend"><span className="mono" style={{ color: "var(--gray-900)", fontWeight: 600 }}>62,410 OMR</span><span className="vs">43.7% of total</span></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Avg revenue / building</div>
          <div className="kpi-value">47,620<span className="unit">OMR</span></div>
          <div className="kpi-trend"><Delta v={8.1} /><span className="vs">vs {compare}</span></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">ADR · all units</div>
          <div className="kpi-value">64.20<span className="unit">OMR</span></div>
          <div className="kpi-trend"><Delta v={2.1} /><span className="vs">vs last quarter</span></div>
        </div>
      </div>

      {/* Report table */}
      <section className="rtable-wrap">
        <div className="rtable-toolbar">
          <div className="left">
            <span className="title">Revenue breakdown</span>
            <span className="meta">3 buildings · drill into units &amp; reservations</span>
          </div>
          <div className="left" style={{ gap: 8 }}>
            <div className="seg">
              <button className={level === "collapse" ? "active" : ""} onClick={() => applyLevel("collapse")}>Collapse all</button>
              <button className={level === "l2" ? "active" : ""} onClick={() => applyLevel("l2")}>Level 2</button>
              <button className={level === "l3" ? "active" : ""} onClick={() => applyLevel("l3")}>Level 3</button>
              <button className={level === "expand" ? "active" : ""} onClick={() => applyLevel("expand")}>Expand all</button>
            </div>
            <button className="btn btn-ghost btn-sm"><svg className="ic-sm"><use href="#i-filter" /></svg>Columns</button>
          </div>
        </div>

        <div className="rtable-scroll">
          <table className="rtable">
            <thead>
              <tr>
                <th style={{ width: "30%" }}>Building / Unit / Reservation</th>
                <th className="num sorted-desc">Revenue<span className="col-group">{dateRange}</span></th>
                <th className="num">Revenue YTD<span className="col-group">1 Jan – 31 May</span></th>
                <th className="num">Occupancy</th>
                <th className="num">Avg rate<span className="col-group">OMR / night</span></th>
                <th className="num">vs {compare}</th>
                <th className="num" style={{ width: 110 }}>Trend<span className="col-group">12 wk</span></th>
              </tr>
            </thead>
            <tbody>
              {DATA.map((b) => {
                const bOpen = expanded.has(b.id);
                return (
                  <BuildingRows
                    key={b.id} b={b} bOpen={bOpen} expanded={expanded} toggle={toggle}
                  />
                );
              })}
              <tr className="is-grand">
                <td>Grand total · 3 buildings</td>
                <td className="num">142,860.000</td>
                <td className="num">220,700.000</td>
                <td className="num">89.4%</td>
                <td className="num">64.20</td>
                <td className="num"><span className="delta-cell up" style={{ color: "oklch(0.91 0.06 155)" }}><svg className="ic-xs"><use href="#i-arrow-up" /></svg>12.4%</span></td>
                <td className="num">—</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="rtable-footer">
          <span>Representative data · live aggregates coming next</span>
          <div className="right"><span>Source: PMS</span></div>
        </div>
      </section>
    </main>
  );
}

function BuildingRows({ b, bOpen, expanded, toggle }: { b: Building; bOpen: boolean; expanded: Set<string>; toggle: (id: string) => void }) {
  return (
    <>
      <tr className="lvl-1">
        <td>
          <Chevron open={bOpen} onClick={() => toggle(b.id)} />
          {b.name} <span className="mono" style={{ color: "var(--gray-500)", fontWeight: 400, marginInlineStart: 6, fontSize: 11 }}>{b.code}</span>
        </td>
        <td className="num">{fmt(b.revQ1)}</td>
        <td className="num">{fmt(b.revYtd)}</td>
        <td className="num"><Heat pct={b.occ} tone={b.tone} /></td>
        <td className="num">{b.rate.toFixed(2)}</td>
        <td className="num"><Delta v={b.delta} /></td>
        <td className="num"><Spark stroke="var(--brand-500)" points={b.spark} /></td>
      </tr>

      {bOpen && b.units.map((u) => {
        const uOpen = expanded.has(u.id);
        const hasKids = !!u.reservations?.length;
        return (
          <FragmentUnit key={u.id} u={u} uOpen={uOpen} hasKids={hasKids} toggle={toggle} />
        );
      })}

      {bOpen && (
        <tr className="is-total">
          <td>{b.name} · subtotal</td>
          <td className="num">{fmt(b.revQ1)}</td>
          <td className="num">{fmt(b.revYtd)}</td>
          <td className="num">{b.occ.toFixed(1)}%</td>
          <td className="num">{b.rate.toFixed(2)}</td>
          <td className="num"><Delta v={b.delta} /></td>
          <td className="num">—</td>
        </tr>
      )}
    </>
  );
}

function FragmentUnit({ u, uOpen, hasKids, toggle }: { u: Unit; uOpen: boolean; hasKids: boolean; toggle: (id: string) => void }) {
  return (
    <>
      <tr className="lvl-2">
        <td>
          {u.aggregate ? <span className="row-leaf" /> : hasKids ? <Chevron open={uOpen} onClick={() => toggle(u.id)} /> : <span className="row-chev" role="button" onClick={() => toggle(u.id)}><svg className="ic-xs"><use href="#i-chev-right" /></svg></span>}
          {u.title} {u.sub && <span className="mono" style={{ color: "var(--gray-500)", fontSize: 11 }}>{u.sub}</span>}
        </td>
        <td className="num">{fmt(u.revQ1)}</td>
        <td className="num">{fmt(u.revYtd)}</td>
        <td className="num">{u.occ != null && u.tone ? <Heat pct={u.occ} tone={u.tone} /> : "—"}</td>
        <td className="num">{u.rate.toFixed(2)}</td>
        <td className="num">{u.delta != null ? <Delta v={u.delta} /> : <span className="dim">—</span>}</td>
        <td className="num">{u.spark ? <Spark points={u.spark} /> : <span className="dim">—</span>}</td>
      </tr>
      {uOpen && hasKids && u.reservations!.map((r) => (
        <tr className="lvl-3" key={r.id}>
          <td>
            <span className="row-leaf" />
            {r.ref ? <a className="r-link">{r.ref}</a> : null}
            {r.ref ? " · " : ""}
            {r.ref ? r.guest : <span className="mono" style={{ color: "var(--gray-500)" }}>{r.guest}</span>}
            {r.meta && <span className="mono" style={{ color: "var(--gray-500)", fontSize: "10.5px", marginInlineStart: 6 }}>{r.meta}</span>}
          </td>
          <td className="num">{fmt(r.revQ1)}</td>
          <td className="num">{fmt(r.revYtd)}</td>
          <td className="num dim">—</td>
          <td className="num">{r.rate.toFixed(2)}</td>
          <td className="num">{r.status ? <span className={`badge b-${r.status.kind}`}><span className="dot" />{r.status.label}</span> : <span className="dim">—</span>}</td>
          <td className="num dim">—</td>
        </tr>
      ))}
    </>
  );
}
