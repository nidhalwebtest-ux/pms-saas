"use client";

/* Landing v2 motion — GSAP + ScrollTrigger with the promo video's easing family.
 *
 *   entrances  power3.out   (0.45–0.6 s)
 *   exits      power2.in    (0.2–0.35 s)
 *   camera / device moves  power2.inOut (0.8–1.0 s)
 *   floats     sine.inOut
 *   no bounce, no elastic.
 *
 * Every animated component must check `prefersReducedMotion()` and render its final state
 * statically when it returns true. Only transform / opacity / filter / CSS vars are animated. */

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export const EASE = {
  enter: "power3.out",
  exit: "power2.in",
  move: "power2.inOut",
  float: "sine.inOut",
} as const;

export const DUR = {
  enter: 0.55,
  exit: 0.25,
  move: 0.9,
} as const;

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** True when the page runs right-to-left (Arabic). Wipes and slides mirror on LTR. */
export function isRtl(): boolean {
  return typeof document !== "undefined" && document.documentElement.dir === "rtl";
}

export { gsap, ScrollTrigger, useGSAP };
