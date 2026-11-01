"use client";

import { useRef } from "react";
import Container from "../../ui/Container";
import { BinayaMark } from "../BinayaMark";
import { gsap, useGSAP, EASE, prefersReducedMotion } from "../motion";
import s from "../landing.module.css";

/* Section 3 — the video's turn (scene 5): «الحل؟» → the Binaya mark draws itself → wordmark →
 * tagline. The background is the clean navy-blue gradient with a soft central light (clarity after
 * the chaos layer above). Plays once when the section is well in view. Reduced motion / no JS:
 * everything is shown, fully drawn. */

export function BridgeBeat({ question, tagline, markLabel }: { question: string; tagline: string; markLabel: string }) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const blurIn = { opacity: 0, y: 16, filter: "blur(14px)" };
      gsap.set(["[data-q]", "[data-word]", "[data-tag]"], blurIn);
      gsap.set("[data-mark-arch]", { strokeDashoffset: 1, fillOpacity: 0 });
      gsap.set("[data-mark-door]", { opacity: 0 });
      gsap.set("[data-light]", { opacity: 0, scale: 0.8 });

      const tl = gsap.timeline({
        defaults: { ease: EASE.enter },
        scrollTrigger: { trigger: root.current, start: "top 55%", once: true },
      });
      tl.to("[data-light]", { opacity: 1, scale: 1, duration: 1.4, ease: EASE.move }, 0)
        .to("[data-q]", { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.5 }, 0.05)
        .to("[data-mark-arch]", { strokeDashoffset: 0, duration: 0.7, ease: EASE.move }, 0.55)
        .to("[data-mark-arch]", { fillOpacity: 1, strokeOpacity: 0, duration: 0.35, ease: "power2.out" }, 1.1)
        .to("[data-mark-door]", { opacity: 1, duration: 0.35, ease: "power2.out" }, 1.2)
        .to("[data-word]", { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.55 }, 1.25)
        .to("[data-tag]", { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.55 }, 1.6);
    },
    { scope: root },
  );

  return (
    <section ref={root} id="solution" data-screen-label="Bridge" className={`${s.root} ${s.story} scroll-mt-16`}>
      <div className={s.hex} aria-hidden="true" />
      {/* soft central light: clarity after the chaos */}
      {/* centred by the wrapper, so GSAP's scale on [data-light] can't undo the centring */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden">
        <div
          data-light
          className="h-[720px] w-[720px] flex-none rounded-full"
          style={{ background: "radial-gradient(circle, rgba(133,183,235,.32) 0%, rgba(24,95,165,.18) 38%, rgba(24,95,165,0) 70%)" }}
        />
      </div>
      <Container className="relative flex min-h-[78vh] flex-col items-center justify-center py-20 text-center md:py-28">
        <p data-q className="text-[44px] font-bold leading-[1.2] md:text-[72px]">{question}</p>
        <BinayaMark size={150} label={markLabel} className="mt-8 h-[110px] w-[110px] md:h-[150px] md:w-[150px]" />
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
      </Container>
    </section>
  );
}
