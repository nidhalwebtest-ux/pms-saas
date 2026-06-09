"use client";

import { useState } from "react";

/**
 * Revenue by Building report — view scaffold matching the design.
 * Data is representative mock for now; wiring to live aggregates is the next step.
 */

const dim = { color: "var(--gray-500)", fontWeight: 400, fontSize: "11px" } as const;
const dimSm = { color: "var(--gray-500)", fontSize: "11px" } as const;

function Spark({ stroke = "var(--gray-500)", points }: { stroke?: string; points: string }) {
  return (
    <span className="spark-cell">
      <svg viewBox="0 0 90 24">
        <polyline fill="none" stroke={stroke} strokeWidth={stroke.includes("brand") ? 1.5 : 1.2} points={points} />
      </svg>
    </span>
  );
}

function UpDelta({ v }: { v: string }) {
  return (
    <span className="delta-cell up">
      <svg className="ic-xs"><use href="#i-arrow-up" /></svg>{v}
    </span>
  );
}

function Heat({ pct, tone }: { pct: string; tone: "success" | "warning" }) {
  const bg = tone === "success" ? "oklch(0.560 0.140 155 / 0.18)" : "oklch(0.745 0.150 75 / 0.20)";
  const color = tone === "success" ? "var(--success-700)" : "var(--warning-700)";
  return <span className="heat" style={{ background: bg, color }}>{pct}</span>;
}

export default function RevenueByBuilding() {
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [level, setLevel] = useState<"collapse" | "l2" | "l3" | "expand">("l2");

  return (
    <main className="rpage">
      {/* Breadcrumb */}
      <div className="crumbs">
        <span>Reports</span>
        <svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span>Revenue</span>
        <svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span className="current">Revenue by Building</span>
      </div>

      {/* Page header */}
      <div className="rhead">
        <div className="title-block">
          <h1>Revenue by Building</h1>
          <p className="sub">
            Gross revenue across all properties for the selected period.
            <span className="tag">Q1 2026 · vs Q1 2025</span>
          </p>
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
            <button className="link muted">Reset</button>
            <button className="link">Save current</button>
            <button className="btn btn-primary btn-sm" style={{ height: 28 }}>Apply</button>
          </div>
        </div>
        <div className="date-presets">
          <button className="preset">Today</button>
          <button className="preset">This week</button>
          <button className="preset">This month</button>
          <button className="preset is-active">This quarter</button>
          <button className="preset">This year</button>
          <button className="preset">Last month</button>
          <button className="preset is-khareef">Khareef season</button>
          <button className="preset">Custom…</button>
        </div>
        <div className="fpanel-body">
          <div className="fpanel-grid">
            <div className="fpanel-field span-2">
              <span className="fpanel-label">Date range</span>
              <button className="fpanel-control is-active">
                <svg className="ic-sm ic-cal"><use href="#i-cal" /></svg>
                <span>1 Mar — 31 May 2026</span>
                <svg className="ic-xs chev"><use href="#i-chev-down" /></svg>
              </button>
            </div>
            <div className="fpanel-field">
              <span className="fpanel-label">Compare with</span>
              <button className="fpanel-control is-active"><span>Q1 2025</span><svg className="ic-xs chev"><use href="#i-chev-down" /></svg></button>
            </div>
            <div className="fpanel-field">
              <span className="fpanel-label">Granularity</span>
              <button className="fpanel-control"><span>Monthly</span><svg className="ic-xs chev"><use href="#i-chev-down" /></svg></button>
            </div>
            <div className="fpanel-field">
              <span className="fpanel-label">Currency</span>
              <button className="fpanel-control"><span>OMR — 3 decimals</span><svg className="ic-xs chev"><use href="#i-chev-down" /></svg></button>
            </div>
            <div className="fpanel-field span-2">
              <span className="fpanel-label">Buildings</span>
              <button className="fpanel-control is-active">
                <svg className="ic-sm" style={{ color: "var(--brand-500)" }}><use href="#i-building" /></svg>
                <span>All buildings</span>
                <svg className="ic-xs chev"><use href="#i-chev-down" /></svg>
              </button>
            </div>
            <div className="fpanel-field">
              <span className="fpanel-label">Unit type</span>
              <button className="fpanel-control"><span>All types</span><svg className="ic-xs chev"><use href="#i-chev-down" /></svg></button>
            </div>
            <div className="fpanel-field">
              <span className="fpanel-label">Status</span>
              <button className="fpanel-control is-active"><span>Confirmed + checked-in</span><svg className="ic-xs chev"><use href="#i-chev-down" /></svg></button>
            </div>
          </div>
        </div>
      </section>

      {/* KPI cards */}
      <div className="kpi-row">
        <div className="kpi-card is-primary">
          <div className="kpi-label"><span className="pulse" />Total revenue</div>
          <div className="kpi-value">142,860<span className="unit">OMR</span></div>
          <div className="kpi-trend"><UpDelta v="12.4%" /><span className="vs">vs Q1 2025</span></div>
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
          <div className="kpi-trend"><UpDelta v="8.1%" /><span className="vs">vs Q1 2025</span></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">ADR · all units</div>
          <div className="kpi-value">64.20<span className="unit">OMR</span></div>
          <div className="kpi-trend"><UpDelta v="2.1%" /><span className="vs">vs last quarter</span></div>
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
              <button className={level === "collapse" ? "active" : ""} onClick={() => setLevel("collapse")}>Collapse all</button>
              <button className={level === "l2" ? "active" : ""} onClick={() => setLevel("l2")}>Level 2</button>
              <button className={level === "l3" ? "active" : ""} onClick={() => setLevel("l3")}>Level 3</button>
              <button className={level === "expand" ? "active" : ""} onClick={() => setLevel("expand")}>Expand all</button>
            </div>
            <button className="btn btn-ghost btn-sm"><svg className="ic-sm"><use href="#i-filter" /></svg>Columns</button>
          </div>
        </div>

        <div className="rtable-scroll">
          <table className="rtable">
            <thead>
              <tr>
                <th style={{ width: "30%" }}>Building / Unit / Reservation</th>
                <th className="num sorted-desc">Revenue Q1<span className="col-group">1 Mar – 31 May 2026</span></th>
                <th className="num">Revenue YTD<span className="col-group">1 Jan – 31 May</span></th>
                <th className="num">Occupancy</th>
                <th className="num">Avg rate<span className="col-group">OMR / night</span></th>
                <th className="num">vs Q1 2025</th>
                <th className="num" style={{ width: 110 }}>Trend<span className="col-group">12 wk</span></th>
              </tr>
            </thead>
            <tbody>
              {/* Salalah Plaza (open) */}
              <tr className="lvl-1 is-selected">
                <td><span className="row-chev is-open" role="button"><svg className="ic-xs"><use href="#i-chev-right" /></svg></span>Salalah Plaza <span className="mono" style={{ ...dim, marginLeft: 6 }}>SLL-001 · 12 units</span></td>
                <td className="num">62,410.000</td>
                <td className="num">98,720.000</td>
                <td className="num"><Heat pct="94.2%" tone="success" /></td>
                <td className="num">68.40</td>
                <td className="num"><UpDelta v="18.2%" /></td>
                <td className="num"><Spark stroke="var(--brand-500)" points="0,18 10,16 20,14 30,15 40,10 50,12 60,8 70,9 80,5 90,4" /></td>
              </tr>
              <tr className="lvl-2">
                <td><span className="row-chev"><svg className="ic-xs"><use href="#i-chev-right" /></svg></span>304 · Sea View Suite <span className="mono" style={dimSm}>2BR · King</span></td>
                <td className="num">9,840.000</td>
                <td className="num">15,260.000</td>
                <td className="num"><Heat pct="96.0%" tone="success" /></td>
                <td className="num">114.00</td>
                <td className="num"><UpDelta v="22.1%" /></td>
                <td className="num"><Spark points="0,16 10,14 20,12 30,13 40,8 50,10 60,6 70,7 80,4 90,3" /></td>
              </tr>
              <tr className="lvl-2">
                <td><span className="row-chev"><svg className="ic-xs"><use href="#i-chev-right" /></svg></span>402 · Penthouse <span className="mono" style={dimSm}>3BR · Premium</span></td>
                <td className="num">18,420.000</td>
                <td className="num">28,340.000</td>
                <td className="num"><Heat pct="82.5%" tone="warning" /></td>
                <td className="num">220.00</td>
                <td className="num"><UpDelta v="31.4%" /></td>
                <td className="num"><Spark points="0,20 10,18 20,15 30,16 40,10 50,8 60,6 70,9 80,4 90,2" /></td>
              </tr>
              <tr className="lvl-2">
                <td><span className="row-chev"><svg className="ic-xs"><use href="#i-chev-right" /></svg></span>+ 10 more units</td>
                <td className="num">34,150.000</td>
                <td className="num">55,120.000</td>
                <td className="num"><Heat pct="94.0%" tone="success" /></td>
                <td className="num">58.70</td>
                <td className="num"><UpDelta v="16.4%" /></td>
                <td className="num"><Spark points="0,16 10,15 20,13 30,14 40,11 50,9 60,10 70,7 80,6 90,5" /></td>
              </tr>
              <tr className="is-total">
                <td style={{ paddingLeft: 38 }}>Salalah Plaza · subtotal</td>
                <td className="num">62,410.000</td>
                <td className="num">98,720.000</td>
                <td className="num">94.2%</td>
                <td className="num">68.40</td>
                <td className="num"><UpDelta v="18.2%" /></td>
                <td className="num">—</td>
              </tr>

              {/* Mirbat Resort (collapsed) */}
              <tr className="lvl-1">
                <td><span className="row-chev" role="button"><svg className="ic-xs"><use href="#i-chev-right" /></svg></span>Mirbat Resort <span className="mono" style={{ ...dim, marginLeft: 6 }}>MIR-002 · 14 units</span></td>
                <td className="num">53,290.000</td>
                <td className="num">82,140.000</td>
                <td className="num"><Heat pct="88.7%" tone="success" /></td>
                <td className="num">58.90</td>
                <td className="num"><UpDelta v="9.4%" /></td>
                <td className="num"><Spark stroke="var(--brand-500)" points="0,16 10,15 20,12 30,13 40,11 50,10 60,8 70,10 80,7 90,8" /></td>
              </tr>

              {/* Khareef Heights (open, A02 expanded with reservations) */}
              <tr className="lvl-1">
                <td><span className="row-chev is-open" role="button"><svg className="ic-xs"><use href="#i-chev-right" /></svg></span>Khareef Heights <span className="mono" style={{ ...dim, marginLeft: 6 }}>KHR-003 · 7 units</span></td>
                <td className="num">27,160.000</td>
                <td className="num">39,840.000</td>
                <td className="num"><Heat pct="81.4%" tone="warning" /></td>
                <td className="num">61.30</td>
                <td className="num"><UpDelta v="4.1%" /></td>
                <td className="num"><Spark stroke="var(--brand-500)" points="0,14 10,16 20,15 30,13 40,14 50,12 60,11 70,12 80,10 90,11" /></td>
              </tr>
              <tr className="lvl-2">
                <td><span className="row-chev is-open" role="button"><svg className="ic-xs"><use href="#i-chev-right" /></svg></span>A02 · Mountain Suite <span className="mono" style={dimSm}>2BR</span></td>
                <td className="num">8,940.000</td>
                <td className="num">12,820.000</td>
                <td className="num"><Heat pct="84.6%" tone="warning" /></td>
                <td className="num">96.00</td>
                <td className="num"><UpDelta v="6.8%" /></td>
                <td className="num"><Spark points="0,14 10,12 20,13 30,11 40,12 50,10 60,11 70,8 80,9 90,7" /></td>
              </tr>
              <tr className="lvl-3">
                <td><span className="row-leaf" /><a className="r-link">BNY-04812</a> · Reem Al-Hinai <span className="mono" style={{ color: "var(--gray-500)", fontSize: "10.5px" }}>Booking.com · 4 nights</span></td>
                <td className="num">384.000</td>
                <td className="num">384.000</td>
                <td className="num dim">—</td>
                <td className="num">96.00</td>
                <td className="num"><span className="badge b-paid"><span className="dot" />Paid</span></td>
                <td className="num dim">—</td>
              </tr>
              <tr className="lvl-3">
                <td><span className="row-leaf" /><a className="r-link">BNY-04760</a> · Priya Venkatesh <span className="mono" style={{ color: "var(--gray-500)", fontSize: "10.5px" }}>Agoda · 3 nights</span></td>
                <td className="num">288.000</td>
                <td className="num">288.000</td>
                <td className="num dim">—</td>
                <td className="num">96.00</td>
                <td className="num"><span className="badge b-due"><span className="dot" />Balance 48.00</span></td>
                <td className="num dim">—</td>
              </tr>
              <tr className="lvl-3">
                <td><span className="row-leaf" /><span className="mono" style={{ color: "var(--gray-500)" }}>+ 21 more reservations</span></td>
                <td className="num">8,268.000</td>
                <td className="num">12,148.000</td>
                <td className="num dim">—</td>
                <td className="num">96.00</td>
                <td className="num dim">—</td>
                <td className="num dim">—</td>
              </tr>
              <tr className="lvl-2">
                <td><span className="row-chev" role="button"><svg className="ic-xs"><use href="#i-chev-right" /></svg></span>+ 6 more units</td>
                <td className="num">18,220.000</td>
                <td className="num">27,020.000</td>
                <td className="num"><Heat pct="80.6%" tone="warning" /></td>
                <td className="num">52.40</td>
                <td className="num"><UpDelta v="3.6%" /></td>
                <td className="num dim">—</td>
              </tr>
              <tr className="is-total">
                <td style={{ paddingLeft: 38 }}>Khareef Heights · subtotal</td>
                <td className="num">27,160.000</td>
                <td className="num">39,840.000</td>
                <td className="num">81.4%</td>
                <td className="num">61.30</td>
                <td className="num"><UpDelta v="4.1%" /></td>
                <td className="num">—</td>
              </tr>

              {/* Grand total */}
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
          <div className="right">
            <span>Source: PMS</span>
          </div>
        </div>
      </section>
    </main>
  );
}
