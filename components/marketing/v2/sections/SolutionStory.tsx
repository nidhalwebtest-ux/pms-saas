"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Container from "../../ui/Container";
import { DuoIcon, type IconName } from "../icons";
import { GoldCheck } from "../GoldCheck";
import { gsap, useGSAP, ScrollTrigger, EASE, prefersReducedMotion } from "../motion";
import { useScene } from "../scenes/useScene";
import { DashboardScene } from "../scenes/DashboardScene";
import { CalendarScene } from "../scenes/CalendarScene";
import { PricingScene, PaymentsScene, InvoicesScene } from "../scenes/PhoneScenes";
import s from "../landing.module.css";

/* Section 4 — the solution story (video scenes 6–10), the core of the page.
 *
 * Desktop (≥1024 px): the device column stays on screen (CSS sticky) while the five chapters scroll
 * past; the active chapter's scene cross-fades in and plays (camera push, gold glow, counters, ✓),
 * and its returning pain card flips to the gold ✓. A tab rail jumps between chapters.
 * Mobile / tablet: each chapter is text + its own device; the scene plays when it enters the view.
 * Reduced motion: every scene shows its final state; no cross-fade movement. */

export type Chapter = { key: string; tab: string; pains: number[]; title: string; sub: string; alt: string };
export type Pain = { icon: IconName; t: string };
export type ChapterLabels = {
  railLabel: string;
  dash: { arrivals: string; departures: string; overstays: string; guests: string };
  calWarn: string; calOk: string; nightRate: string; paymentsTotal: string; cashMatched: string; dueTotal: string;
};

function useIsDesktop() {
  const [desk, setDesk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setDesk(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desk;
}

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

/** Chapter copy: tab label, the returning pain card(s) that flip to a gold ✓, headline, line. */
function ChapterText({ c, index, pains, active }: { c: Chapter; index: number; pains: Pain[]; active: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useScene(root, active, (tl) => {
    const rows = root.current!.querySelectorAll<HTMLElement>("[data-prow]");
    rows.forEach((row, j) => {
      const icon = row.querySelector("[data-pain-ic]");
      const ok = row.querySelector("[data-ok]");
      const path = row.querySelector("[data-check-path]");
      const t = 0.25 + j * 0.35;
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
      <h3 className="mt-6 text-[30px] font-bold leading-[1.25] md:text-[42px]">{c.title}</h3>
      <p className="mt-3 max-w-[520px] text-[17px] leading-[1.65] text-white/75 md:text-[19px]">{c.sub}</p>
    </div>
  );
}

export function SolutionStory({ chapters, pains, labels }: { chapters: Chapter[]; pains: Pain[]; labels: ChapterLabels }) {
  const root = useRef<HTMLElement>(null);
  const isDesktop = useIsDesktop();
  // -1 = no chapter reached yet: chapter 1's device shows idle, and its tour waits for the visitor
  const [activeIdx, setActiveIdx] = useState(-1);
  const shownIdx = Math.max(0, activeIdx);
  const [inView, setInView] = useState<boolean[]>(() => chapters.map(() => false));

  // which chapter is active (desktop: the one crossing the viewport centre; mobile: per-chapter in-view)
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px)", () => {
        gsap.utils.toArray<HTMLElement>("[data-chapter]").forEach((el, i) => {
          ScrollTrigger.create({
            trigger: el, start: "top 55%", end: "bottom 55%",
            onToggle: (self) => { if (self.isActive) setActiveIdx(i); },
            // scrolling back above the first chapter resets, so its tour replays next time
            onLeaveBack: i === 0 ? () => setActiveIdx(-1) : undefined,
          });
        });
      });
      mm.add("(max-width: 1023px)", () => {
        gsap.utils.toArray<HTMLElement>("[data-mscene]").forEach((el, i) => {
          ScrollTrigger.create({
            trigger: el, start: "top 78%", end: "bottom 22%",
            onToggle: (self) => setInView((v) => v.map((x, j) => (j === i ? self.isActive : x))),
          });
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  // desktop stage: cross-fade to the active scene
  useEffect(() => {
    if (!isDesktop || !root.current) return;
    const layers = root.current.querySelectorAll<HTMLElement>("[data-stage-scene]");
    const reduce = prefersReducedMotion();
    layers.forEach((el, i) => {
      const on = i === shownIdx;
      gsap.to(el, {
        autoAlpha: on ? 1 : 0,
        scale: on ? 1 : 0.97,
        filter: on ? "blur(0px)" : "blur(6px)",
        duration: reduce ? 0 : on ? 0.5 : 0.35,
        delay: reduce ? 0 : on ? 0.12 : 0,
        ease: on ? EASE.enter : EASE.exit,
        overwrite: "auto",
      });
    });
  }, [shownIdx, isDesktop]);

  const jump = (i: number) => {
    const el = root.current?.querySelectorAll<HTMLElement>("[data-chapter]")[i];
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.3;
    window.scrollTo({ top: y, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  return (
    <section ref={root} id="features" data-screen-label="Solution story" className={`${s.root} ${s.story}`}>
      <div className={s.hex} aria-hidden="true" />
      <Container wide className="relative">
        <div className="lg:grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
          {/* chapters (text; on mobile each is followed by its own scene) */}
          <div>
            {chapters.map((c, i) => (
              <article key={c.key} data-chapter className="flex flex-col justify-center py-14 lg:min-h-[88vh] lg:py-0">
                <ChapterText c={c} index={i} pains={pains} active={isDesktop ? activeIdx === i : inView[i]} />
                <div data-mscene className="mt-10 lg:hidden">{sceneFor(c, !isDesktop && inView[i], labels)}</div>
              </article>
            ))}
          </div>

          {/* desktop stage: stays on screen while the chapters scroll */}
          <div className="hidden lg:block">
            <div className="sticky top-[88px] flex h-[calc(100vh-112px)] flex-col">
              <nav aria-label={labels.railLabel} className="flex flex-wrap justify-center gap-2 pt-2">
                {chapters.map((c, i) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => jump(i)}
                    aria-current={shownIdx === i ? "step" : undefined}
                    className={[
                      "rounded-full border px-3.5 py-1.5 text-[14px] font-semibold transition-colors",
                      shownIdx === i ? "border-[#85B7EB] bg-[#85B7EB]/20 text-white" : "border-white/20 text-white/60 hover:text-white",
                    ].join(" ")}
                  >
                    {c.tab}
                  </button>
                ))}
              </nav>
              <div className="relative flex-1">
                {chapters.map((c, i) => (
                  <div
                    key={c.key}
                    data-stage-scene
                    aria-hidden={shownIdx !== i}
                    className="absolute inset-0 flex items-center justify-center px-2"
                    style={i === 0 ? undefined : { opacity: 0, visibility: "hidden" }}
                  >
                    <div className="w-full max-w-[680px]">{sceneFor(c, isDesktop && activeIdx === i, labels)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
