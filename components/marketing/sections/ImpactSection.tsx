"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Container from "../ui/Container";

/* ============================================================================
 *  Impact band — a deep-blue section with three count-up stats. The numbers
 *  animate from 0 to their target the first time the band scrolls into view.
 *  Respects prefers-reduced-motion (shows the final value immediately).
 * ========================================================================= */

type Stat = { to: number; suf: string; label: string };

export default function ImpactSection() {
  const t = useTranslations("marketing.impact");
  const stats = t.raw("stats") as Stat[];

  return (
    <section
      data-screen-label="Impact"
      className="relative overflow-hidden border-b border-gray-200 text-white"
      style={{ background: "linear-gradient(135deg,#0e3a66 0%,#185FA5 52%,#2a7bc4 100%)" }}
    >
      {/* soft glow accents */}
      <span className="pointer-events-none absolute -top-24 -end-16 h-[340px] w-[340px] rounded-full"
        style={{ background: "radial-gradient(circle,rgba(133,183,235,.35),transparent 70%)" }} />
      <span className="pointer-events-none absolute -bottom-28 -start-20 h-[320px] w-[320px] rounded-full"
        style={{ background: "radial-gradient(circle,rgba(133,183,235,.22),transparent 70%)" }} />

      <Container className="relative max-w-[1120px] py-16 md:py-24">
        <div className="mx-auto max-w-[660px] text-center">
          <div className="font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-300">
            {t("eyebrow")}
          </div>
          <h2 className="mt-3.5 text-[30px] font-bold leading-[1.12] tracking-[-0.025em] text-balance md:text-[48px]">
            {t("title")}
          </h2>
          <p className="mx-auto mt-4 max-w-[560px] text-[16px] leading-[1.6] text-[#d7e7f7] md:text-[19px]">
            {t("sub")}
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-[18px] border border-white/15 bg-white/[0.07] px-6 py-8 text-center backdrop-blur-sm"
            >
              <div className="flex items-baseline justify-center gap-0.5 font-mono font-semibold leading-none" dir="ltr">
                <CountUp to={s.to} className="text-[48px] md:text-[68px]" />
                <span className="text-[26px] text-brand-300 md:text-[38px]">{s.suf}</span>
              </div>
              <div className="mt-3 text-[15px] leading-[1.45] text-[#d7e7f7]">{s.label}</div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function CountUp({ to, className = "" }: { to: number; className?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      return;
    }
    let raf = 0;
    let start = 0;
    const dur = 1200;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        obs.disconnect();
        const step = (now: number) => {
          if (!start) start = now;
          const p = Math.min((now - start) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          setValue(Math.round(to * eased));
          if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => { obs.disconnect(); cancelAnimationFrame(raf); };
  }, [to]);

  return <span ref={ref} className={className}>{value}</span>;
}
