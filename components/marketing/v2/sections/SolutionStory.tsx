"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Container from "../../ui/Container";
import { DuoIcon, type IconName } from "../icons";
import { GoldCheck } from "../GoldCheck";
import { gsap, useGSAP, ScrollTrigger, EASE, prefersReducedMotion } from "../motion";
import { useScene } from "../scenes/useScene";
import { DashboardScene } from "../scenes/DashboardScene";
import { CalendarScene } from "../scenes/CalendarScene";
import { PricingScene, PaymentsScene, InvoicesScene } from "../scenes/PhoneScenes";
import s from "../landing.module.css";

/* Section 3 — the solution, as clickable tabs (Dashboard · Calendar · Seasonal prices · Payments ·
 * Invoices). Previously a pinned scroll story ~4.4 screens tall; now about one screen.
 *
 * The first tab's scene plays when the section enters the view; clicking a tab cross-fades to its
 * scene and plays it (camera push, gold glow, counters, ✓), and that chapter's returning pain
 * card(s) flip to the gold ✓ — tying back to the pain block above.
 * Accessible tabs: role=tablist/tab/tabpanel, ←/→/Home/End keys (mirrored in RTL).
 * Reduced motion: every scene shows its final state; no cross-fade movement. */

export type Chapter = { key: string; tab: string; pains: number[]; title: string; sub: string; alt: string };
export type Pain = { icon: IconName; t: string };
export type ChapterLabels = {
  railLabel: string;
  dash: { arrivals: string; departures: string; overstays: string; guests: string };
  calWarn: string; calOk: string; nightRate: string; paymentsTotal: string; cashMatched: string; dueTotal: string;
};

function sceneFor(c: Chapter, active: boolean, L: ChapterLabels): ReactNode {
  switch (c.key) {
    case "dashboard":
      return <DashboardScene active={active} alt={c.alt} labels={[L.dash.arrivals, L.dash.departures, L.dash.overstays, L.dash.guests]} />;
    case "calendar":
      return <CalendarScene active={active} alt={c.alt} warn={L.calWarn} ok={L.calOk} />;
    case "pricing":
      return <PricingScene active={active} alt={c.alt} label={L.nightRate} />;
    case "payments":
      return <PaymentsScene active={active} alt={c.alt} totalLabel={L.paymentsTotal} matched={L.cashMatched} />;
    case "invoices":
      return <InvoicesScene active={active} alt={c.alt} dueLabel={L.dueTotal} />;
    default:
      return null;
  }
}

/** Chapter copy: number + tab label, the returning pain card(s) that flip to a gold ✓, headline, line. */
function ChapterText({ c, index, pains, active }: { c: Chapter; index: number; pains: Pain[]; active: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useScene(root, active, (tl) => {
    tl.fromTo(root.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.35 }, 0);
    const rows = root.current!.querySelectorAll<HTMLElement>("[data-prow]");
    rows.forEach((row, j) => {
      const icon = row.querySelector("[data-pain-ic]");
      const ok = row.querySelector("[data-ok]");
      const path = row.querySelector("[data-check-path]");
      const t = 0.35 + j * 0.35;
      tl.fromTo(icon, { opacity: 1, scale: 1 }, { opacity: 0, scale: 0.6, duration: 0.22, ease: EASE.exit }, t);
      tl.fromTo(ok, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.35 }, t + 0.1);
      tl.fromTo(path, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.28, ease: "power2.out" }, t + 0.18);
      tl.fromTo(row.querySelector("[data-ptext]"), { opacity: 1 }, { opacity: 0.62, duration: 0.3 }, t + 0.2);
    });
  });
  return (
    <div ref={root}>
      <p className="text-[15px] font-semibold text-[#85B7EB] md:text-[16px]">
        <span dir="ltr" className="font-mono">{String(index + 1).padStart(2, "0")}</span> · {c.tab}
      </p>
      {c.pains.length > 0 && (
        <ul className="mt-5 grid list-none gap-2.5 p-0">
          {c.pains.map((pi) => (
            <li key={pi} data-prow className={`${s.glass} flex items-center gap-3.5 rounded-2xl px-4 py-3`}>
              <span className="relative grid h-10 w-10 flex-none place-items-center rounded-xl bg-[#85B7EB]/15 text-[#85B7EB]">
                <span data-pain-ic className="absolute inset-0 grid place-items-center"><DuoIcon name={pains[pi].icon} size={24} /></span>
                <span data-ok className="absolute inset-0 grid place-items-center opacity-0"><GoldCheck size={28} drawn={false} /></span>
              </span>
              <span data-ptext className="text-[16px] leading-[1.45] md:text-[17px]">{pains[pi].t}</span>
            </li>
          ))}
        </ul>
      )}
      <h3 className="mt-6 text-[28px] font-bold leading-[1.25] md:text-[38px]">{c.title}</h3>
      <p className="mt-3 max-w-[520px] text-[17px] leading-[1.65] text-white/75 md:text-[19px]">{c.sub}</p>
    </div>
  );
}

export function SolutionStory({
  heading,
  chapters,
  pains,
  labels,
}: {
  heading: string;
  chapters: Chapter[];
  pains: Pain[];
  labels: ChapterLabels;
}) {
  const root = useRef<HTMLElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [idx, setIdx] = useState(0);
  // nothing plays until the section first scrolls into view
  const [seen, setSeen] = useState(false);

  useGSAP(
    () => {
      ScrollTrigger.create({ trigger: root.current, start: "top 65%", once: true, onEnter: () => setSeen(true) });
    },
    { scope: root },
  );

  // cross-fade the stage to the active scene
  useEffect(() => {
    if (!root.current) return;
    const layers = root.current.querySelectorAll<HTMLElement>("[data-stage-scene]");
    const reduce = prefersReducedMotion();
    layers.forEach((el, i) => {
      const on = i === idx;
      gsap.to(el, {
        autoAlpha: on ? 1 : 0,
        scale: on ? 1 : 0.97,
        filter: on ? "blur(0px)" : "blur(6px)",
        duration: reduce ? 0 : on ? 0.5 : 0.3,
        delay: reduce ? 0 : on ? 0.1 : 0,
        ease: on ? EASE.enter : EASE.exit,
        overwrite: "auto",
      });
    });
  }, [idx]);

  const select = (i: number) => {
    setIdx(i);
    setSeen(true); // a click counts as "seen" even if the trigger hasn't fired yet
    // on phones the rail scrolls sideways: bring the chosen tab into view (never scrolls the page)
    const tab = tabRefs.current[i];
    const rail = tab?.parentElement;
    if (tab && rail && rail.scrollWidth > rail.clientWidth) {
      rail.scrollTo({ left: tab.offsetLeft - (rail.clientWidth - tab.offsetWidth) / 2, behavior: "smooth" });
    }
  };

  // ←/→ move between tabs (mirrored in RTL), Home/End jump to the ends
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const n = chapters.length;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = rtl ? idx - 1 : idx + 1;
    if (e.key === "ArrowLeft") next = rtl ? idx + 1 : idx - 1;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = n - 1;
    if (next === null) return;
    e.preventDefault();
    const wrapped = (next + n) % n;
    select(wrapped);
    tabRefs.current[wrapped]?.focus();
  };

  const active = chapters[idx];

  return (
    <section ref={root} id="solution" data-screen-label="Solution" className={`${s.root} ${s.story} scroll-mt-16`}>
      <div className={s.hex} aria-hidden="true" />
      <Container wide className="relative py-16 md:py-24">
        <h2 className="mx-auto max-w-[820px] text-center text-[28px] font-bold leading-[1.3] md:text-[40px]">{heading}</h2>

        {/* tab rail: wraps on desktop, scrolls sideways on phones */}
        <div
          role="tablist"
          aria-label={labels.railLabel}
          onKeyDown={onKey}
          className="-mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:mt-10 md:flex-wrap md:justify-center md:overflow-visible md:px-0"
        >
          {chapters.map((c, i) => (
            <button
              key={c.key}
              ref={(el) => { tabRefs.current[i] = el; }}
              type="button"
              role="tab"
              id={`solution-tab-${c.key}`}
              aria-selected={idx === i}
              aria-controls="solution-panel"
              tabIndex={idx === i ? 0 : -1}
              onClick={() => select(i)}
              data-cta={`solution-tab-${c.key}`}
              className={[
                "flex-none whitespace-nowrap rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors md:text-[15px]",
                idx === i ? "border-[#85B7EB] bg-[#85B7EB]/20 text-white" : "border-white/20 text-white/65 hover:text-white",
              ].join(" ")}
            >
              {c.tab}
            </button>
          ))}
        </div>

        <div
          id="solution-panel"
          role="tabpanel"
          aria-labelledby={`solution-tab-${active.key}`}
          className="mt-10 grid items-center gap-10 md:mt-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14"
        >
          {/* text: re-mounted per tab so its pain → ✓ animation replays */}
          <ChapterText key={active.key} c={active} index={idx} pains={pains} active={seen} />

          {/* stage: every scene sits in the same grid cell (the tallest sets the height); only the
              active one is visible and playing */}
          <div className="grid">
            {chapters.map((c, i) => (
              <div
                key={c.key}
                data-stage-scene
                aria-hidden={idx !== i}
                className="flex items-center justify-center [grid-area:1/1]"
                style={i === 0 ? undefined : { opacity: 0, visibility: "hidden" }}
              >
                <div className="w-full max-w-[680px]">{sceneFor(c, seen && idx === i, labels)}</div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
