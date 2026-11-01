"use client";

import { useRef } from "react";
import Container from "../../ui/Container";
import { DuoIcon, type IconName } from "../icons";
import { gsap, useGSAP, EASE, prefersReducedMotion } from "../motion";
import s from "../landing.module.css";

/* Section 2 — the video's pain beat (scenes 2–4):
 *   «أكيد تعرف هذه المشاكل…» → the 5 pain cards stack in → «ومع زحمة الموسم… الفوضى تتضاعف».
 *
 * Desktop (≥1024 px): the section pins for a short scroll and each card arrives as you scroll
 * (scrubbed), with a faint "chaos" layer of chat bubbles / notebooks / spreadsheets drifting
 * behind; then the stack compresses and the escalation line lands.
 * Tablet / mobile: no pinning — cards blur-in one by one as they enter the viewport.
 * Reduced motion: everything is static and visible. Server-rendered visible (no JS = readable). */

export type Pain = { icon: IconName; t: string };

// faint background "chaos": [kind, x%, y%, size px, opacity]
const CHAOS: Array<[string, number, number, number, number]> = [
  ["bubble", 4, 14, 190, 0.12], ["notebook", 88, 10, 72, 0.14], ["bubble", 78, 74, 210, 0.1],
  ["fileXls", 6, 70, 78, 0.14], ["chatsCircle", 90, 46, 74, 0.12], ["bubble", 2, 42, 150, 0.08],
  ["notebook", 14, 88, 60, 0.1], ["fileXls", 72, 30, 58, 0.08], ["bubble", 40, 90, 200, 0.07],
];

function Chaos() {
  return (
    <div data-chaos className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {CHAOS.map(([kind, x, y, size, o], i) => (
        <div key={i} data-chaos-item className="absolute" style={{ insetInlineStart: `${x}%`, top: `${y}%`, opacity: o }}>
          {kind === "bubble" ? (
            <div className="flex flex-col gap-2.5 rounded-[22px] rounded-es-md bg-white/90 px-5 py-4" style={{ width: size }}>
              <i className="block h-2.5 w-[80%] rounded-full bg-[#0B1F3A]/30" />
              <i className="block h-2.5 w-[55%] rounded-full bg-[#0B1F3A]/30" />
            </div>
          ) : (
            <DuoIcon name={kind as IconName} size={size} className="text-[#85B7EB]" />
          )}
        </div>
      ))}
    </div>
  );
}

export function PainStory({
  intro,
  pains,
  escalationA,
  escalationB,
}: {
  intro: string;
  pains: Pain[];
  escalationA: string;
  escalationB: string;
}) {
  const root = useRef<HTMLElement>(null);
  const pin = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const mm = gsap.matchMedia();
      const cardsSel = "[data-pain]";

      // desktop: pinned, scrubbed stack
      mm.add("(min-width: 1024px)", () => {
        gsap.set(cardsSel, { opacity: 0, y: 34, filter: "blur(12px)" });
        gsap.set("[data-esc]", { opacity: 0, y: 18, filter: "blur(10px)" });
        const tl = gsap.timeline({
          defaults: { ease: EASE.enter },
          scrollTrigger: {
            trigger: pin.current,
            start: "top top",
            end: "+=1500",
            scrub: 0.6,
            pin: true,
            anticipatePin: 1,
          },
        });
        tl.from("[data-intro]", { opacity: 0.35, y: 16, duration: 0.6 }, 0);
        // the horizontal cards arrive one by one in reading order (right → left in Arabic)
        gsap.utils.toArray<HTMLElement>(cardsSel).forEach((card, i) => {
          tl.to(card, { opacity: 1, y: 0, filter: "blur(0px)", duration: 1 }, 0.4 + i * 0.85);
        });
        // chaos drifts up and thickens while the cards pile in
        gsap.utils.toArray<HTMLElement>("[data-chaos-item]").forEach((el, i) => {
          tl.fromTo(el, { y: 0 }, { y: -60 - (i % 3) * 40, ease: "none", duration: 6 }, 0);
        });
        tl.fromTo("[data-chaos]", { opacity: 0.45 }, { opacity: 1, ease: "none", duration: 5 }, 0);
        // escalation: the stack compresses, the line lands
        tl.to(cardsSel, { scale: 0.97, opacity: 0.82, filter: "blur(1.5px)", duration: 0.8, ease: EASE.move }, 5);
        tl.to("[data-esc]", { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, stagger: 0.35 }, 5.1);
        tl.to({}, { duration: 0.8 }); // short hold before the pin releases
      });

      // tablet & mobile: no pin; the swipeable row of cards staggers in when it enters, then the line
      mm.add("(max-width: 1023px)", () => {
        gsap.fromTo(
          cardsSel,
          { opacity: 0, y: 26, filter: "blur(10px)" },
          { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.55, stagger: 0.12, ease: EASE.enter, scrollTrigger: { trigger: "[data-pain-row]", start: "top 85%", once: true } },
        );
        gsap.fromTo(
          "[data-esc]",
          { opacity: 0, y: 18, filter: "blur(8px)" },
          { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.55, stagger: 0.25, ease: EASE.enter, scrollTrigger: { trigger: "[data-esc]", start: "top 90%", once: true } },
        );
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    // The dark story starts as a rounded navy "sheet" that slightly overlaps the hero's bottom padding:
    // a clean, deliberate edge with a soft lift shadow, instead of a light→dark colour blend.
    <section
      ref={root}
      id="problems"
      data-screen-label="Pains"
      className={`${s.root} ${s.story} ${s.sheet} relative z-[1] -mt-4 scroll-mt-16 rounded-t-[32px] md:-mt-14 md:rounded-t-[56px]`}
    >
      <div className={s.hex} aria-hidden="true" />
      <div ref={pin} className="relative flex items-center pb-16 pt-20 lg:h-screen lg:py-0">
        <Chaos />
        <Container wide className="relative">
          <h2 data-intro className="mx-auto max-w-[780px] text-center text-[34px] font-bold leading-[1.25] md:text-[52px]">
            {intro}
          </h2>
          {/* horizontal cards: 5 across on desktop, a swipeable row on smaller screens */}
          <ol
            data-pain-row
            className="-mx-5 mt-10 flex list-none snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 sm:-mx-8 sm:px-8 md:mt-12 lg:mx-0 lg:grid lg:grid-cols-5 lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0"
          >
            {pains.map((p, i) => (
              <li
                key={i}
                data-pain
                className={`${s.glass} flex w-[72vw] max-w-[280px] flex-none snap-start flex-col gap-5 p-6 lg:w-auto lg:max-w-none lg:px-5 lg:py-6`}
              >
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#85B7EB]/15 text-[#85B7EB]">
                  <DuoIcon name={p.icon} size={32} />
                </span>
                <span className="text-[19px] font-semibold leading-[1.5] lg:text-[18px] xl:text-[19px]">{p.t}</span>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-center text-[24px] leading-[1.4] md:mt-12 md:text-[34px]">
            <span data-esc className="inline-block text-white/75">{escalationA}</span>{" "}
            <span data-esc className="inline-block font-bold">{escalationB}</span>
          </p>
        </Container>
      </div>
    </section>
  );
}
