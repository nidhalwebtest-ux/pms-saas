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

      // tablet & mobile: no pin, each card blurs in as it enters
      mm.add("(max-width: 1023px)", () => {
        gsap.utils.toArray<HTMLElement>([cardsSel, "[data-esc]"].join(",")).forEach((el) => {
          gsap.fromTo(
            el,
            { opacity: 0, y: 26, filter: "blur(10px)" },
            { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.55, ease: EASE.enter, scrollTrigger: { trigger: el, start: "top 88%", once: true } },
          );
        });
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} id="problems" data-screen-label="Pains" className={`${s.root} ${s.story} scroll-mt-16`}>
      <div className={s.hex} aria-hidden="true" />
      {/* soft hand-off from the light hero: a white veil that fades out over the section's own
          background, so there is no seam where the band ends */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-48 md:h-64"
        style={{ background: "linear-gradient(180deg,#ffffff 0%,rgba(234,243,252,.92) 22%,rgba(170,200,232,.55) 52%,rgba(133,183,235,.18) 78%,rgba(133,183,235,0) 100%)" }}
      />
      <div aria-hidden="true" className="h-36 md:h-48" />
      <div ref={pin} className="relative flex items-center py-16 lg:h-screen lg:py-0">
        <Chaos />
        <Container className="relative">
          <div className="mx-auto max-w-[780px]">
            <h2 data-intro className="text-center text-[34px] font-bold leading-[1.25] md:text-[52px]">
              {intro}
            </h2>
            <ol className="mt-9 grid list-none gap-3 p-0 md:mt-11 md:gap-3.5">
              {pains.map((p, i) => (
                <li key={i} data-pain className={`${s.glass} flex items-center gap-4 px-5 py-4 md:gap-5 md:px-7 md:py-[18px]`}>
                  <span className="grid h-12 w-12 flex-none place-items-center rounded-[14px] bg-[#85B7EB]/15 text-[#85B7EB] md:h-14 md:w-14">
                    <DuoIcon name={p.icon} size={30} />
                  </span>
                  <span className="text-[18px] leading-[1.45] md:text-[23px]">{p.t}</span>
                </li>
              ))}
            </ol>
            <p className="mt-8 text-center text-[24px] leading-[1.4] md:mt-10 md:text-[34px]">
              <span data-esc className="inline-block text-white/75">{escalationA}</span>{" "}
              <span data-esc className="inline-block font-bold">{escalationB}</span>
            </p>
          </div>
        </Container>
      </div>
    </section>
  );
}
