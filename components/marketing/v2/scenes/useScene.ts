"use client";

import { useEffect, useRef, type RefObject } from "react";
import { gsap, useGSAP, EASE, prefersReducedMotion } from "../motion";

/* A chapter scene = one paused GSAP timeline. It plays from the start each time its chapter becomes
 * active and rewinds (after the cross-fade has hidden it) when the chapter is left. Reduced motion:
 * the timeline jumps to its end, so the scene shows its final, fully-explained state. */
export function useScene(
  scope: RefObject<HTMLElement | null>,
  active: boolean,
  build: (tl: gsap.core.Timeline) => void,
) {
  const tl = useRef<gsap.core.Timeline | null>(null);

  useGSAP(
    () => {
      const t = gsap.timeline({ paused: true, defaults: { ease: EASE.enter } });
      build(t);
      tl.current = t;
      t.progress(prefersReducedMotion() ? 1 : 0);
      return () => { t.kill(); tl.current = null; };
    },
    { scope },
  );

  useEffect(() => {
    const t = tl.current;
    if (!t) return;
    if (prefersReducedMotion()) { t.progress(1); return; }
    if (active) { t.restart(); return; }
    const rewind = gsap.delayedCall(0.5, () => t.pause(0));
    return () => { rewind.kill(); };
  }, [active]);
}

/** Format a baisa amount for the landing page. Marketing shows money with 2 decimals
 * (40000 baisa → "40.00"); 3 keeps the app's baisa precision; 0 = a plain integer. Integer math only. */
export type Decimals = 0 | 2 | 3;
export function fmtNum(v: number, decimals: Decimals = 2): string {
  const n = Math.round(v);
  if (decimals === 0) return String(n);
  const whole = Math.floor(n / 1000);
  return decimals === 3
    ? `${whole}.${String(n % 1000).padStart(3, "0")}`
    : `${whole}.${String(Math.floor((n % 1000) / 10)).padStart(2, "0")}`;
}

/** Roll a number in `el` from → to inside a scene timeline (the video's counters). */
export function rollNumber(
  tl: gsap.core.Timeline,
  el: Element | null,
  from: number,
  to: number,
  position: number | string,
  { decimals = 2 as Decimals, duration = 0.9 } = {},
) {
  if (!el) return;
  const o = { v: from };
  tl.call(() => { o.v = from; el.textContent = fmtNum(from, decimals); }, [], typeof position === "number" ? Math.max(0, position - 0.01) : position);
  tl.to(o, { v: to, duration, ease: "power2.out", onUpdate: () => { el.textContent = fmtNum(o.v, decimals); } }, position);
}

/** Percent centre of a rect on a screen (for the cursor layer). */
export function centerPct(r: readonly number[], cssW: number, cssH: number) {
  return { cx: ((r[0] + r[2] / 2) / cssW) * 100, cy: ((r[1] + r[3] / 2) / cssH) * 100 };
}
