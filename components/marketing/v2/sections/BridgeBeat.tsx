"use client";

import { useRef } from "react";
import Container from "../../ui/Container";
import { BinayaMark } from "../BinayaMark";
import { gsap, useGSAP, EASE, prefersReducedMotion, isRtl } from "../motion";
import s from "../landing.module.css";

/* Section 3 — the video's turn (scene 5), then the reveal of what Binaya is.
 *
 * Beat 1 (centred): «الحل؟» → the Binaya mark draws itself → wordmark → tagline.
 * Beat 2 (desktop ≥1024 px): «الحل؟» fades away and the logo lockup glides to the end side
 * (left in Arabic, right in English) while a paragraph about the system appears on the other side.
 *
 * The final two-column layout is the real layout: the lockup only *starts* translated to the centre
 * (measured, re-measured on resize). Mobile: beat 1 centred, then the paragraph below. Reduced
 * motion / no JS: the final layout, fully drawn. */

export function BridgeBeat({
  question,
  tagline,
  body,
  markLabel,
}: {
  question: string;
  tagline: string;
  body: string;
  markLabel: string;
}) {
  const root = useRef<HTMLElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const lock = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const mm = gsap.matchMedia();
      const blurIn = { opacity: 0, y: 16, filter: "blur(14px)" };
      const shown = { opacity: 1, y: 0, filter: "blur(0px)" };

      const beatOne = (tl: gsap.core.Timeline) => {
        tl.to("[data-light]", { opacity: 1, scale: 1, duration: 1.4, ease: EASE.move }, 0)
          .to("[data-q]", { ...shown, duration: 0.5 }, 0.05)
          .to("[data-mark-arch]", { strokeDashoffset: 0, duration: 0.7, ease: EASE.move }, 0.55)
          .to("[data-mark-arch]", { fillOpacity: 1, strokeOpacity: 0, duration: 0.35, ease: "power2.out" }, 1.1)
          .to("[data-mark-door]", { opacity: 1, duration: 0.35, ease: "power2.out" }, 1.2)
          .to("[data-word]", { ...shown, duration: 0.55 }, 1.25)
          .to("[data-tag]", { ...shown, duration: 0.55 }, 1.6);
      };
      const prime = () => {
        gsap.set(["[data-q]", "[data-word]", "[data-tag]"], blurIn);
        gsap.set("[data-mark-arch]", { strokeDashoffset: 1, fillOpacity: 0, strokeOpacity: 1 });
        gsap.set("[data-mark-door]", { opacity: 0 });
        gsap.set("[data-light]", { opacity: 0, scale: 0.8 });
      };

      // desktop: centred logo beat, then the lockup moves aside and the paragraph appears
      mm.add("(min-width: 1024px)", () => {
        prime();
        // offset that puts the lockup in the middle of the grid (measured; recalculated on refresh)
        const toCentre = () => {
          const g = grid.current!.getBoundingClientRect();
          const l = lock.current!.getBoundingClientRect();
          return g.left + g.width / 2 - (l.left + l.width / 2);
        };
        const fromSide = isRtl() ? 40 : -40;                 // the paragraph drifts in from its own side
        gsap.set("[data-para]", { opacity: 0, x: fromSide, filter: "blur(12px)" });
        gsap.set(lock.current, { x: toCentre() });

        const tl = gsap.timeline({
          defaults: { ease: EASE.enter },
          scrollTrigger: {
            trigger: root.current,
            start: "top 55%",
            once: true,
            invalidateOnRefresh: true,
            onRefresh: (self) => { if (!self.progress) gsap.set(lock.current, { x: toCentre() }); },
          },
        });
        beatOne(tl);
        tl.to("[data-q]", { opacity: 0, y: -24, filter: "blur(12px)", duration: 0.4, ease: EASE.exit }, 2.5)
          .to(lock.current, { x: 0, duration: 1.0, ease: EASE.move }, 2.6)
          .to("[data-para]", { opacity: 1, x: 0, filter: "blur(0px)", duration: 0.7 }, 3.0);
      });

      // tablet & mobile: centred beat, then the paragraph below it
      mm.add("(max-width: 1023px)", () => {
        prime();
        gsap.set("[data-para]", blurIn);
        const tl = gsap.timeline({
          defaults: { ease: EASE.enter },
          scrollTrigger: { trigger: root.current, start: "top 60%", once: true },
        });
        beatOne(tl);
        tl.to("[data-para]", { ...shown, duration: 0.6 }, 2.2);
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} id="solution" data-screen-label="Bridge" className={`${s.root} ${s.story} scroll-mt-16`}>
      <div className={s.hex} aria-hidden="true" />
      {/* soft central light; centred by the wrapper so GSAP's scale on [data-light] can't undo it */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden">
        <div
          data-light
          className="h-[720px] w-[720px] flex-none rounded-full"
          style={{ background: "radial-gradient(circle, rgba(133,183,235,.32) 0%, rgba(24,95,165,.18) 38%, rgba(24,95,165,0) 70%)" }}
        />
      </div>
      <Container wide className="relative flex min-h-[82vh] items-center py-20 md:py-28">
        <div ref={grid} className="grid w-full items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* paragraph (start side: right in Arabic, left in English) */}
          <p
            data-para
            className="order-2 mx-auto max-w-[560px] text-center text-[19px] leading-[1.9] text-white/85 md:text-[22px] lg:order-1 lg:mx-0 lg:text-start"
          >
            {body}
          </p>
          {/* logo lockup (end side). «الحل؟» sits above it out of the flow, so fading it changes no layout. */}
          <div ref={lock} className="order-1 flex flex-col items-center text-center lg:order-2">
            <div className="relative">
              {/* centred by the wrapper, so GSAP's y/filter tween on [data-q] can't undo it */}
              <div className="absolute inset-x-0 bottom-full mb-6 flex justify-center">
                <p data-q className="whitespace-nowrap text-[44px] font-bold leading-[1.2] md:text-[72px]">{question}</p>
              </div>
              <BinayaMark size={150} label={markLabel} className="mx-auto mt-24 h-[110px] w-[110px] md:mt-32 md:h-[150px] md:w-[150px] lg:mt-0" />
            </div>
            <p
              data-word
              dir="ltr"
              className="mt-4 text-[64px] font-semibold leading-[1.15] tracking-[-0.03em] md:text-[96px] [font-family:var(--font-poppins),sans-serif]"
            >
              Binaya
            </p>
            <p data-tag className={`${s.glass} mt-7 px-7 py-3.5 text-[18px] leading-[1.5] text-white/90 md:text-[22px]`}>
              {tagline}
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
