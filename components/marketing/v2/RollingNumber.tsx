"use client";

import { useRef } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "./motion";
import { fmtNum as fmt, type Decimals } from "./scenes/useScene";

/* A number that rolls to a REAL value when it scrolls into view (the video's counters).
 * Money is integer baisa, shown with 2 decimals on the landing page; never floats. Screen readers
 * get the final value immediately (the rolling text is aria-hidden). */

export function RollingNumber({
  to,
  from = 0,
  decimals = 2,
  duration = 0.9,
  className = "",
}: {
  /** target: baisa when decimals is 2 or 3, a plain integer when decimals=0 */
  to: number;
  from?: number;
  decimals?: Decimals;
  duration?: number;
  className?: string;
}) {
  const el = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const node = el.current;
      if (!node || prefersReducedMotion()) return;
      const o = { v: from };
      node.textContent = fmt(from, decimals);
      const tween = gsap.to(o, {
        v: to,
        duration,
        ease: "power2.out",
        paused: true,
        onUpdate: () => { node.textContent = fmt(Math.round(o.v), decimals); },
      });
      const io = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) { tween.play(); io.disconnect(); }
      }, { threshold: 0.6 });
      io.observe(node);
      return () => io.disconnect();
    },
    { dependencies: [to, from, decimals] },
  );

  return (
    <span className={className} dir="ltr">
      <span ref={el} aria-hidden="true">{fmt(to, decimals)}</span>
      <span className="sr-only">{fmt(to, decimals)}</span>
    </span>
  );
}
