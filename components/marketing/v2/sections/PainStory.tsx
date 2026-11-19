"use client";

import { useRef } from "react";
import Container from "../../ui/Container";
import { DuoIcon, type IconName } from "../icons";
import { gsap, useGSAP, EASE, prefersReducedMotion } from "../motion";
import s from "../landing.module.css";

/* Section 2 — the pain points, as one compact block that leads straight into the features.
 *
 * «أكيد تعرف هذه المشاكل…» → the 5 pain cards → «ومع زحمة الموسم… الفوضى تتضاعف».
 * No scroll pinning: the cards fade/blur in once, staggered, when the block enters the view
 * (previously the section pinned the screen for ~2.7 screens of scrolling).
 * Reduced motion / no JS: everything is static and visible (server-rendered visible). */

export type Pain = { icon: IconName; t: string };

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

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const hidden = { opacity: 0, y: 24, filter: "blur(10px)" };
      const shown = { opacity: 1, y: 0, filter: "blur(0px)" };
      gsap.set(["[data-intro]", "[data-pain]", "[data-esc]"], hidden);
      gsap
        .timeline({
          defaults: { ease: EASE.enter, duration: 0.55 },
          scrollTrigger: { trigger: root.current, start: "top 70%", once: true },
        })
        .to("[data-intro]", shown, 0)
        .to("[data-pain]", { ...shown, stagger: 0.12 }, 0.2)
        .to("[data-esc]", { ...shown, stagger: 0.2 }, 0.2 + pains.length * 0.12 + 0.15);
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
      <div className="relative pb-14 pt-20 md:pb-16 md:pt-28">
        <Container wide className="relative">
          <h2 data-intro className="mx-auto max-w-[780px] text-center text-[32px] font-bold leading-[1.25] md:text-[46px]">
            {intro}
          </h2>
          {/* 5 cards across on desktop; a vertical stack on smaller screens */}
          <ol className="mx-auto mt-10 grid max-w-[640px] list-none gap-3 p-0 md:mt-12 lg:max-w-none lg:grid-cols-5 lg:gap-5">
            {pains.map((p, i) => (
              <li
                key={i}
                data-pain
                className={`${s.glass} flex items-center gap-4 px-5 py-4 lg:flex-col lg:items-start lg:gap-5 lg:px-5 lg:py-6`}
              >
                <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-[#85B7EB]/15 text-[#85B7EB] lg:h-14 lg:w-14">
                  <DuoIcon name={p.icon} size={32} />
                </span>
                <span className="text-[17px] font-semibold leading-[1.5] lg:text-[16px] xl:text-[18px]">{p.t}</span>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-center text-[22px] leading-[1.4] md:mt-10 md:text-[30px]">
            <span data-esc className="inline-block text-white/75">{escalationA}</span>{" "}
            <span data-esc className="inline-block font-bold">{escalationB}</span>
          </p>
        </Container>
      </div>
    </section>
  );
}
