"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  addDays, addMonths, startOfMonth, endOfMonth, differenceInDays,
  format, parseISO, isToday as dfIsToday,
} from "date-fns";
import { ar as arLocale, enGB as enLocale, type Locale } from "date-fns/locale";
import {
  CalendarDaysIcon, BuildingOffice2Icon, WrenchScrewdriverIcon,
  ArrowRightOnRectangleIcon, ArrowLeftOnRectangleIcon, ChevronDownIcon,
  ArrowPathIcon, PlusIcon, ArrowLongRightIcon, CloudIcon, Squares2X2Icon,
  TagIcon, XMarkIcon,
} from "@heroicons/react/24/outline";

// ── Types (mirror /api/availability) ────────────────────────────────────────
interface SegRes {
  id: string; reservationNumber: string | null; guestName: string;
  status: string; rateAmount: number; startDate: string; endDate: string;
}
type Seg =
  | { kind: "arr"; col: number; solo: boolean; res: SegRes }
  | { kind: "body"; from: number; to: number; flatStart: boolean; res: SegRes }
  | { kind: "split"; col: number; out: SegRes; in: SegRes }
  | { kind: "maint"; from: number; to: number };
interface UnitData {
  id: string; name: string; floor: number; unitType: string;
  defaultDailyRate: number; occupancyPct: number; segments: Seg[];
}
interface CalData {
  propertyName: string; startDate: string; endDate: string; dates: string[];
  units: UnitData[];
  stats: {
    totalCells: number; bookedNights: number; bookedPct: number;
    vacant: number; vacantPct: number; checkins: number; maintenance: number;
    potentialRevenue: string;
  };
}
interface Property { id: string; name: string }

type PopTarget =
  | { kind: "vacant"; unit: UnitData; date: string }
  | { kind: "booking"; unit: UnitData; res: SegRes; isCheckin: boolean; col: number }
  | { kind: "split"; unit: UnitData; out: SegRes; in: SegRes; date: string }
  | { kind: "maint"; unit: UnitData; date: string };

const isWeekendDay = (d: Date) => d.getDay() === 5 || d.getDay() === 6;

export default function AvailabilityCalendarView({
  properties, defaultPropertyId,
}: { properties: Property[]; defaultPropertyId?: string }) {
  const router = useRouter();
  const locale = useLocale();
  const isRtl = locale === "ar";
  const dfLocale: Locale = isRtl ? arLocale : enLocale;
  const t = useTranslations("availabilityCalendar");
  const tUnitTypes = useTranslations("reservations.detail.unitTypes");
  const unitTypeLabel = (x: string) => (tUnitTypes.has(x) ? tUnitTypes(x) : x);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [propertyId, setPropertyId] = useState(defaultPropertyId || properties[0]?.id || "");
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 14), "yyyy-MM-dd"));
  const [preset, setPreset] = useState<string>("14");
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [showNames, setShowNames] = useState(false);

  const [data, setData] = useState<CalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spin, setSpin] = useState(false);

  const [pop, setPop] = useState<{ target: PopTarget; x: number; y: number; flip: boolean } | null>(null);
  const [sheet, setSheet] = useState<PopTarget | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const m = window.matchMedia("(max-width: 640px)");
    const on = () => setIsMobile(m.matches);
    on(); m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  const fmtOMR = useCallback((n: number) => {
    const s = Number(n).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    return isRtl ? `${s} ر.ع.` : `OMR ${s}`;
  }, [isRtl]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!propertyId || !startDate || !endDate) return;
    setLoading(true); setError(null); setPop(null); setSheet(null);
    try {
      const qs = new URLSearchParams({ propertyId, startDate, endDate });
      const r = await fetch(`/api/availability?${qs}`);
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error ?? t("loadFailed")); }
      setData(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadFailed"));
    } finally { setLoading(false); }
  }, [propertyId, startDate, endDate, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Presets ────────────────────────────────────────────────────────────────
  function applyDays(d: number, key: string) {
    setPreset(key); setStartDate(format(new Date(), "yyyy-MM-dd")); setEndDate(format(addDays(new Date(), d), "yyyy-MM-dd"));
  }
  function applyMonth(off: number, key: string) {
    const m = addMonths(new Date(), off);
    setPreset(key); setStartDate(format(startOfMonth(m), "yyyy-MM-dd")); setEndDate(format(endOfMonth(m), "yyyy-MM-dd"));
  }
  function applyKhareef() {
    const y = new Date().getFullYear();
    setPreset("khareef"); setStartDate(`${y}-07-01`); setEndDate(`${y}-09-15`);
  }
  function refresh() { setSpin(true); setTimeout(() => setSpin(false), 600); fetchData(); }

  // ── Day metadata ───────────────────────────────────────────────────────────
  const days = useMemo(() => {
    if (!data) return [];
    return data.dates.map((ds, i) => {
      const d = parseISO(ds);
      const prev = i > 0 ? parseISO(data.dates[i - 1]) : null;
      return {
        ds, d, dayNum: format(d, "d", { locale: dfLocale }),
        wd: format(d, "EEE", { locale: dfLocale }),
        mo: format(d, "MMM", { locale: dfLocale }),
        weekend: isWeekendDay(d), today: dfIsToday(d),
        firstOfMonth: i === 0 || (prev && prev.getMonth() !== d.getMonth()),
      };
    });
  }, [data, dfLocale]);
  const todayCol = useMemo(() => days.findIndex((x) => x.today), [days]);
  const rangeNights = startDate && endDate ? differenceInDays(parseISO(endDate), parseISO(startDate)) : 0;

  // ── Interaction ────────────────────────────────────────────────────────────
  function onEnter(e: React.MouseEvent, target: PopTarget) {
    if (isMobile) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const flip = r.top < 180;
    setPop({ target, x: r.left + r.width / 2, y: flip ? r.bottom + 8 : r.top - 8, flip });
  }
  function onLeave() { if (!isMobile) setPop(null); }
  function activate(target: PopTarget) {
    if (isMobile) { setSheet(target); return; }
    navigate(target);
  }
  function navigate(target: PopTarget) {
    if (target.kind === "booking") router.push(`/dashboard/reservations/${target.res.id}`);
    else if (target.kind === "split") router.push(`/dashboard/reservations/${target.in.id}`);
    else if (target.kind === "vacant") router.push(`/dashboard/reservations/new?unitId=${target.unit.id}&startDate=${target.date}`);
  }

  const stats = data?.stats;

  return (
    <div className="bcal" dir={isRtl ? "rtl" : "ltr"}>
      {/* ── Header ── */}
      <div className="bcal-head">
        <div className="b-ico"><BuildingOffice2Icon /></div>
        <div>
          <div className="b-name">{data?.propertyName ?? properties.find((p) => p.id === propertyId)?.name ?? t("title")}</div>
          <div className="b-meta">
            <span className="ltr-numbers">{startDate && endDate ? `${format(parseISO(startDate), "d MMM", { locale: dfLocale })} – ${format(parseISO(endDate), "d MMM yyyy", { locale: dfLocale })}` : ""}</span>
            <span className="dot" /><span className="ltr-numbers">{t("nights", { n: rangeNights })}</span>
            {data && <><span className="dot" /><span className="ltr-numbers">{t("units", { n: data.units.length })}</span></>}
          </div>
        </div>
        <div className="b-spacer" />
        <div className="live"><i />{t("live")}</div>
      </div>

      {/* ── Summary ── */}
      {stats && (
        <div className="bcal-summary">
          <Stat dot="dot-confirmed" val={stats.bookedNights} pct={stats.bookedPct} lbl={t("stats.booked")} />
          <Stat dot="dot-vacant" val={stats.vacant} pct={stats.vacantPct} lbl={t("stats.vacant")} />
          <Stat dot="dot-checkin" val={stats.checkins} lbl={t("stats.checkins")} />
          <Stat dot="dot-maint" val={stats.maintenance} lbl={t("stats.maintenance")} />
          <div className="stat-rev">
            <div className="r-lbl">{t("stats.potential")}</div>
            <div className="r-val">
              {!isRtl && <span className="cur">OMR</span>}
              <span>{Number(stats.potentialRevenue).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
              {isRtl && <span className="cur">ر.ع.</span>}
            </div>
          </div>
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="bcal-filter">
        <div className="fzone">
          <span className="fz-lbl">{t("filter.range")}</span>
          <div className="sc" role="radiogroup">
            <button type="button" className={preset === "7" ? "on" : ""} onClick={() => applyDays(7, "7")}>{t("filter.d7")}</button>
            <button type="button" className={preset === "14" ? "on" : ""} onClick={() => applyDays(14, "14")}>{t("filter.d14")}</button>
            <button type="button" className={preset === "30" ? "on" : ""} onClick={() => applyDays(30, "30")}>{t("filter.d30")}</button>
            <button type="button" className={preset === "month" ? "on" : ""} onClick={() => applyMonth(0, "month")}>{t("filter.thisMonth")}</button>
            <button type="button" className={preset === "next" ? "on" : ""} onClick={() => applyMonth(1, "next")}>{t("filter.nextMonth")}</button>
          </div>
          <button type="button" className={`khareef ${preset === "khareef" ? "on" : ""}`} onClick={applyKhareef}>
            <span className="kico"><CloudIcon /></span>
            <span>{t("filter.khareef")}</span>
            <span className="ktag">{t("filter.season")}</span>
          </button>
        </div>

        <div className="fzone">
          <span className="fz-lbl">{t("filter.custom")}</span>
          <div className="daterange">
            <label className="dfield">
              <CalendarDaysIcon />
              <div><div className="dlbl">{t("filter.from")}</div><div className="dval ltr-numbers">{format(parseISO(startDate), "d MMM", { locale: dfLocale })}</div></div>
              <input type="date" value={startDate} max={endDate} onChange={(e) => { setPreset(""); setStartDate(e.target.value); }} />
            </label>
            <span className="arrow"><ArrowLongRightIcon /></span>
            <label className="dfield">
              <CalendarDaysIcon />
              <div><div className="dlbl">{t("filter.to")}</div><div className="dval ltr-numbers">{format(parseISO(endDate), "d MMM", { locale: dfLocale })}</div></div>
              <input type="date" value={endDate} min={startDate} onChange={(e) => { setPreset(""); setEndDate(e.target.value); }} />
            </label>
          </div>
        </div>

        <div className="fzone" style={{ marginInlineStart: "auto" }}>
          <button type="button" className={`btn-ghost ${showNames ? "on" : ""}`} title={t("filter.names")} onClick={() => setShowNames((v) => !v)}><TagIcon /></button>
          <button type="button" className={`btn-ghost ${density === "compact" ? "on" : ""}`} title={t("filter.density")} onClick={() => setDensity((d) => (d === "compact" ? "comfortable" : "compact"))}><Squares2X2Icon /></button>
          {properties.length > 1 && (
            <div className="selector">
              <span className="savatar"><BuildingOffice2Icon /></span>
              <span className="sname">{properties.find((p) => p.id === propertyId)?.name ?? ""}</span>
              <span className="schev"><ChevronDownIcon /></span>
              <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <button type="button" className={`btn-refresh ${spin ? "spin" : ""}`} title={t("filter.refresh")} onClick={refresh}><ArrowPathIcon /></button>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="bcal-legend">
        <Legend sw="sw-vacant" lbl={t("legend.vacant")} />
        <Legend sw="sw-confirmed" lbl={t("legend.booked")} />
        <Legend sw="sw-checkin" lbl={t("legend.checkin")} />
        <Legend sw="sw-split" lbl={t("legend.turnover")} sub={t("legend.turnoverSub")} />
        <Legend sw="sw-maint" lbl={t("legend.maintenance")} />
      </div>

      {/* ── Grid / states ── */}
      <div className="bcal-scroll">
        {loading && <SkeletonGrid days={rangeNights || 14} />}
        {!loading && error && (
          <div className="bcal-empty"><div className="ill"><CalendarDaysIcon /></div><h2>{t("errorTitle")}</h2><p>{error}</p></div>
        )}
        {!loading && !error && data && data.units.length === 0 && (
          <div className="bcal-empty"><div className="ill"><BuildingOffice2Icon /></div><h2>{t("emptyTitle")}</h2><p>{t("emptyBody")}</p></div>
        )}
        {!loading && !error && data && data.units.length > 0 && (
          <div className={`bcal-grid ${density === "compact" ? "compact" : ""}`} style={{ ["--days" as string]: data.units.length ? data.dates.length : 0 }}>
            {/* corner */}
            <div className="hc-corner" style={{ gridRow: 1, gridColumn: 1 }}>
              <span className="ttl">{t("unitColumn")}</span>
              <span className="cnt ltr-numbers">{data.units.length}</span>
            </div>
            {/* day headers */}
            {days.map((d, c) => (
              <div key={d.ds} className={`hc ${d.weekend ? "weekend" : ""} ${d.today ? "today" : ""}`} style={{ gridRow: 1, gridColumn: c + 2 }}>
                {d.firstOfMonth && <span className="mchip">{d.mo}</span>}
                <span className="wd">{d.wd}</span>
                <span className="dn">{d.dayNum}</span>
              </div>
            ))}
            {/* today line */}
            {todayCol >= 0 && <div className="today-line" style={{ gridRow: `2 / ${data.units.length + 2}`, gridColumn: todayCol + 2 }} />}

            {/* rows */}
            {data.units.map((u, ui) => (
              <Row key={u.id} u={u} ui={ui} days={days} density={density} showNames={showNames}
                   unitTypeLabel={unitTypeLabel} t={t}
                   onEnter={onEnter} onLeave={onLeave} activate={activate} />
            ))}
          </div>
        )}
      </div>

      {/* ── Desktop popover ── */}
      {pop && !isMobile && (
        <div className="bcal-pop" dir={isRtl ? "rtl" : "ltr"}
          style={{
            left: Math.max(10, Math.min(pop.x - 134, (typeof window !== "undefined" ? window.innerWidth : 1200) - 278)),
            top: pop.flip ? pop.y : undefined,
            bottom: pop.flip ? undefined : (typeof window !== "undefined" ? window.innerHeight : 800) - pop.y,
          }}>
          <PopBody target={pop.target} t={t} dfLocale={dfLocale} isRtl={isRtl} fmtOMR={fmtOMR} unitTypeLabel={unitTypeLabel} todayCol={todayCol} days={days} />
        </div>
      )}

      {/* ── Mobile bottom sheet ── */}
      {sheet && isMobile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60 }} onClick={() => setSheet(null)}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.35)" }} />
          <div className="bcal" dir={isRtl ? "rtl" : "ltr"} onClick={(e) => e.stopPropagation()}
            style={{ position: "absolute", insetInline: 0, bottom: 0, borderRadius: "18px 18px 0 0", height: "auto", boxShadow: "0 -8px 30px rgba(0,0,0,.25)" }}>
            <div style={{ width: 38, height: 4, borderRadius: 99, background: "var(--gray-300)", margin: "8px auto 4px" }} />
            <div className="bcal-pop" style={{ position: "static", width: "auto", border: 0, boxShadow: "none", pointerEvents: "auto" }}>
              <PopBody target={sheet} t={t} dfLocale={dfLocale} isRtl={isRtl} fmtOMR={fmtOMR} unitTypeLabel={unitTypeLabel} todayCol={todayCol} days={days} />
            </div>
            {(sheet.kind === "booking" || sheet.kind === "split" || sheet.kind === "vacant") && (
              <div style={{ padding: "4px 14px 16px" }}>
                <button type="button" onClick={() => { navigate(sheet); setSheet(null); }}
                  style={{ width: "100%", height: 42, borderRadius: 10, border: 0, background: "var(--brand-500)", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                  {sheet.kind === "vacant" ? t("pop.createCta") : t("pop.openCta")}
                </button>
              </div>
            )}
            <button type="button" onClick={() => setSheet(null)} style={{ position: "absolute", top: 10, insetInlineEnd: 12, border: 0, background: "transparent", color: "var(--gray-400)", cursor: "pointer" }}><XMarkIcon style={{ width: 20, height: 20 }} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────────
type DayMeta = { ds: string; weekend: boolean };
function Row({
  u, ui, days, density, showNames, unitTypeLabel, t, onEnter, onLeave, activate,
}: {
  u: UnitData; ui: number; days: { ds: string; weekend: boolean }[];
  density: string; showNames: boolean; unitTypeLabel: (x: string) => string;
  t: ReturnType<typeof useTranslations>;
  onEnter: (e: React.MouseEvent, target: PopTarget) => void;
  onLeave: () => void; activate: (target: PopTarget) => void;
}) {
  const occupied = new Set<number>();
  u.segments.forEach((s) => {
    if (s.kind === "arr" || s.kind === "split") occupied.add(s.col);
    else if (s.kind === "body" || s.kind === "maint") for (let c = s.from; c <= s.to; c++) occupied.add(c);
  });

  return (
    <>
      {/* rail */}
      <div className={`rc ${density === "compact" ? "compact" : ""}`} style={{ gridRow: ui + 2, gridColumn: 1 }}>
        <div className="u-main">
          <div className="u-no">{u.name}</div>
          <div className="u-sub">{unitTypeLabel(u.unitType)}{u.floor > 0 ? ` · ${t("floor", { n: u.floor })}` : ""}</div>
        </div>
        {density !== "compact" && (
          <div className="u-occ">
            <span className="occ-pct ltr-numbers">{u.occupancyPct}%</span>
            <span className="occ-bar"><i style={{ width: `${u.occupancyPct}%` }} /></span>
          </div>
        )}
      </div>

      {/* background cells (vacant + grid) */}
      {days.map((d, c) => {
        if (occupied.has(c)) return <div key={d.ds} className={`bc ${d.weekend ? "weekend" : ""}`} style={{ gridRow: ui + 2, gridColumn: c + 2, cursor: "default" }} />;
        return (
          <div key={d.ds} className={`bc ${d.weekend ? "weekend" : ""}`} style={{ gridRow: ui + 2, gridColumn: c + 2 }}
            onMouseEnter={(e) => onEnter(e, { kind: "vacant", unit: u, date: d.ds })}
            onMouseLeave={onLeave}
            onClick={() => activate({ kind: "vacant", unit: u, date: d.ds })}>
            <span className="vac-plus"><PlusIcon /></span>
          </div>
        );
      })}

      {/* segments */}
      {u.segments.map((s, si) => {
        if (s.kind === "arr") {
          return (
            <div key={si} className={`seg seg-arr ${s.solo ? "solo" : ""}`} style={{ gridRow: ui + 2, gridColumn: `${s.col + 2} / ${s.col + 3}` }}
              onMouseEnter={(e) => onEnter(e, { kind: "booking", unit: u, res: s.res, isCheckin: true, col: s.col })}
              onMouseLeave={onLeave}
              onClick={() => activate({ kind: "booking", unit: u, res: s.res, isCheckin: true, col: s.col })}>
              <span className="chev"><ArrowRightOnRectangleIcon /></span>
            </div>
          );
        }
        if (s.kind === "body") {
          return (
            <div key={si} className={`seg seg-body ${s.flatStart ? "" : "solo"} ${showNames ? "named" : ""}`} style={{ gridRow: ui + 2, gridColumn: `${s.from + 2} / ${s.to + 3}` }}
              onMouseEnter={(e) => onEnter(e, { kind: "booking", unit: u, res: s.res, isCheckin: false, col: s.from })}
              onMouseLeave={onLeave}
              onClick={() => activate({ kind: "booking", unit: u, res: s.res, isCheckin: false, col: s.from })}>
              <span className="lbl">{s.res.guestName}</span>
            </div>
          );
        }
        if (s.kind === "split") {
          return (
            <div key={si} className="seg-split" style={{ gridRow: ui + 2, gridColumn: `${s.col + 2} / ${s.col + 3}` }}
              onMouseEnter={(e) => onEnter(e, { kind: "split", unit: u, out: s.out, in: s.in, date: days[s.col]?.ds ?? "" })}
              onMouseLeave={onLeave}
              onClick={() => activate({ kind: "split", unit: u, out: s.out, in: s.in, date: days[s.col]?.ds ?? "" })}>
              <span className="tri-in" /><span className="divider" />
              <span className="out-i"><ArrowLeftOnRectangleIcon /></span>
              <span className="in-i"><ArrowRightOnRectangleIcon /></span>
            </div>
          );
        }
        // maint
        return (
          <div key={si} className="seg seg-maint" style={{ gridRow: ui + 2, gridColumn: `${s.from + 2} / ${s.to + 3}` }}
            onMouseEnter={(e) => onEnter(e, { kind: "maint", unit: u, date: days[s.from]?.ds ?? "" })}
            onMouseLeave={onLeave}
            onClick={() => activate({ kind: "maint", unit: u, date: days[s.from]?.ds ?? "" })}>
            <span className="mico"><WrenchScrewdriverIcon /></span>
            <span className="lbl">{t("maintenance")}</span>
          </div>
        );
      })}
    </>
  );
}

// ── Popover body ─────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
function PopBody({
  target, t, dfLocale, isRtl, fmtOMR, unitTypeLabel, todayCol, days,
}: {
  target: PopTarget; t: ReturnType<typeof useTranslations>; dfLocale: Locale;
  isRtl: boolean; fmtOMR: (n: number) => string; unitTypeLabel: (x: string) => string;
  todayCol: number; days: { ds: string }[];
}) {
  const fmt = (iso: string, withYear = false) => format(parseISO(iso), withYear ? "d MMM yyyy" : "d MMM", { locale: dfLocale });
  const unitLine = (u: UnitData) => `${u.name} · ${unitTypeLabel(u.unitType)}`;
  const statusBadge = (status: string, isCheckin: boolean, isToday: boolean) => {
    if (isCheckin) return <span className="badge checkin"><span className="bd" />{isToday ? t("pop.arrivingToday") : t("pop.checkinBadge")}</span>;
    if (status === "PENDING") return <span className="badge confirmed"><span className="bd" />{t("pop.pending")}</span>;
    return <span className="badge confirmed"><span className="bd" />{t("pop.confirmed")}</span>;
  };

  if (target.kind === "vacant") {
    return (
      <>
        <div className="pop-head">
          <div className="pop-av" style={{ background: "var(--gray-100)", color: "var(--gray-500)" }}><CalendarDaysIcon /></div>
          <div className="pop-id"><div className="pop-name">{t("pop.vacantTitle")}</div><div className="pop-ref">{unitLine(target.unit)}</div></div>
          <span className="badge vacant"><span className="bd" />{t("legend.vacant")}</span>
        </div>
        <div className="pop-dates" style={{ borderBottom: 0 }}>
          <div className="leg"><div className="k">{t("pop.date")}</div><div className="v ltr-numbers">{fmt(target.date)}</div></div>
          <div className="leg" style={{ textAlign: "end" }}><div className="k">{t("pop.potentialNight")}</div><div className="v ltr-numbers" style={{ color: "var(--brand-600)" }}>{fmtOMR(target.unit.defaultDailyRate)}</div></div>
        </div>
      </>
    );
  }
  if (target.kind === "maint") {
    return (
      <>
        <div className="pop-head">
          <div className="pop-av" style={{ background: "var(--warning-50)", color: "var(--warning-700)" }}><WrenchScrewdriverIcon /></div>
          <div className="pop-id"><div className="pop-name">{t("maintenance")}</div><div className="pop-ref">{unitLine(target.unit)}</div></div>
          <span className="badge maint"><span className="bd" />{t("pop.blocked")}</span>
        </div>
        <div className="pop-foot" style={{ borderTop: "1px solid var(--gray-100)" }}>
          <div className="meta">{t("pop.closedForBookings")}</div>
        </div>
      </>
    );
  }
  if (target.kind === "split") {
    return (
      <>
        <div className="pop-head" style={{ paddingBottom: 9 }}>
          <div className="pop-av" style={{ background: "linear-gradient(135deg,var(--st-confirmed) 50%,var(--st-checkin) 50%)", color: "#fff" }}>⇄</div>
          <div className="pop-id"><div className="pop-name">{t("pop.turnoverTitle")}</div><div className="pop-ref">{unitLine(target.unit)}</div></div>
        </div>
        <div className="pop-dates col">
          <div className="turn-row">
            <span className="ti" style={{ background: "var(--st-confirmed)", color: "#fff" }}><ArrowLeftOnRectangleIcon /></span>
            <div style={{ flex: 1, minWidth: 0 }}><div className="k">{t("pop.checkout")}</div><div className="v">{target.out.guestName}</div></div>
            <span className="badge confirmed"><span className="bd" />{target.out.reservationNumber}</span>
          </div>
          <div className="turn-row">
            <span className="ti" style={{ background: "var(--st-checkin)", color: "var(--st-checkin-ink)" }}><ArrowRightOnRectangleIcon /></span>
            <div style={{ flex: 1, minWidth: 0 }}><div className="k">{t("pop.checkin")}</div><div className="v">{target.in.guestName}</div></div>
            <span className="badge checkin"><span className="bd" />{target.in.reservationNumber}</span>
          </div>
        </div>
        <div className="pop-foot"><div className="meta">{t("pop.housekeeping")} · 11:00 → 15:00</div></div>
      </>
    );
  }
  // booking
  const r = target.res;
  const nights = Math.max(1, differenceInDays(parseISO(r.endDate), parseISO(r.startDate)));
  const total = r.rateAmount * nights;
  const isArrToday = target.isCheckin && target.col === todayCol;
  return (
    <>
      <div className="pop-head">
        <div className="pop-av">{initials(r.guestName)}</div>
        <div className="pop-id"><div className="pop-name">{r.guestName}</div><div className="pop-ref">{r.reservationNumber} · {unitLine(target.unit)}</div></div>
        {statusBadge(r.status, target.isCheckin, isArrToday)}
      </div>
      <div className="pop-dates">
        <div className="leg"><div className="k">{t("pop.checkin")}</div><div className="v ltr-numbers">{fmt(r.startDate)}</div></div>
        <div className="nights"><span className="nn ltr-numbers">{nights}</span><span className="nl">{t("pop.nights")}</span></div>
        <div className="arr"><ArrowLongRightIcon /></div>
        <div className="leg" style={{ textAlign: "end" }}><div className="k">{t("pop.checkout")}</div><div className="v ltr-numbers">{fmt(r.endDate, true)}</div></div>
      </div>
      <div className="pop-foot">
        <div className="meta">{t("pop.clickToOpen")}</div>
        <div className="rate"><div className="rv ltr-numbers">{fmtOMR(total)}</div><div className="rl ltr-numbers">{fmtOMR(r.rateAmount)} × {nights}</div></div>
      </div>
    </>
  );
}

// ── Small bits ───────────────────────────────────────────────────────────────
function Stat({ dot, val, pct, lbl }: { dot: string; val: number; pct?: number; lbl: string }) {
  return (
    <div className="stat">
      <div className="s-top"><span className={`s-dot ${dot}`} /><span className="s-val ltr-numbers">{val}</span>{pct != null && <span className="s-pct ltr-numbers">{pct}%</span>}</div>
      <div className="s-lbl">{lbl}</div>
    </div>
  );
}
function Legend({ sw, lbl, sub }: { sw: string; lbl: string; sub?: string }) {
  return <div className="lg"><span className={`sw ${sw}`} /><span>{lbl}</span>{sub && <span className="lgsub">{sub}</span>}</div>;
}
function SkeletonGrid({ days }: { days: number }) {
  const runs = [[[2, 6], [9, 13]], [[0, 4], [6, 11]], [[3, 9]], [[0, 6], [10, 13]], [[0, 12]], [[2, 7]], [[0, 3], [7, 11]], [[5, 13]]];
  return (
    <div className="bcal-grid" style={{ ["--days" as string]: days }}>
      <div className="hc-corner" style={{ gridRow: 1, gridColumn: 1 }}><span className="skeleton" style={{ width: 54, height: 11 }} /></div>
      {Array.from({ length: days }).map((_, c) => (
        <div key={c} className="hc" style={{ gridRow: 1, gridColumn: c + 2 }}>
          <span className="skeleton" style={{ width: 18, height: 8, marginBottom: 5 }} />
          <span className="skeleton" style={{ width: 22, height: 13 }} />
        </div>
      ))}
      {Array.from({ length: 8 }).map((_, ui) => (
        <Frag key={ui}>
          <div className="rc" style={{ gridRow: ui + 2, gridColumn: 1 }}>
            <div className="u-main"><span className="skeleton" style={{ display: "block", width: 46, height: 12, marginBottom: 6 }} /><span className="skeleton" style={{ display: "block", width: 78, height: 9 }} /></div>
          </div>
          {Array.from({ length: days }).map((_, c) => <div key={c} className="bc" style={{ gridRow: ui + 2, gridColumn: c + 2 }} />)}
          {(runs[ui] || []).map(([a, b], i) => (b < days ? <div key={i} className="skeleton sk-cell" style={{ gridRow: ui + 2, gridColumn: `${a + 2} / ${b + 3}` }} /> : null))}
        </Frag>
      ))}
    </div>
  );
}
function Frag({ children }: { children: React.ReactNode }) { return <>{children}</>; }
