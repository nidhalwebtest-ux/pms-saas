"use client";

import { useRef } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "./motion";

/* A number that rolls to a REAL value when it scrolls into view (the video's counters).
 * Money is integer baisa, formatted with 3 decimals; never floats. Screen readers get the final
 * value immediately (the rolling text is aria-hidden). */

const fmt = (v: number, decimals: 0 | 3) =>
  decimals === 3 ? `${Math.floor(v / 1000)}.${String(Math.round(v) % 1000).padStart(3, "0")}` : String(Math.round(v));

export function RollingNumber({
  to,
  from = 0,
  decimals = 3,
  duration = 0.9,
  className = "",
}: {
  /** target: baisa when decimals=3, a plain integer when decimals=0 */
  to: number;
  from?: number;
  decimals?: 0 | 3;
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
