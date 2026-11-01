"use client";

import { useRef, type ReactNode } from "react";
import s from "./landing.module.css";
import { gsap, useGSAP, prefersReducedMotion } from "./motion";

/* Dark navy "story" section (the video's look): gradient + hexagon corners, and the content is
 * revealed by the video's RTL wipe (mirrored to LTR in English) the first time it scrolls into
 * view. Server-rendered fully visible, so nothing is hidden without JavaScript. */

export function StorySection({
  id,
  label,
  children,
  className = "",
}: {
  id?: string;
  /** data-screen-label, for QA screenshots */
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLElement>(null);
  const wipe = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = wipe.current;
      if (!el || prefersReducedMotion()) return;
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.8) return;          // already on screen at load: never hide it
      gsap.set(el, { "--w": 0 });
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        gsap.to(el, { "--w": 110, duration: 0.8, ease: "power2.inOut" });
      }, { threshold: 0.18 });
      io.observe(el);
      return () => io.disconnect();
    },
    { scope: root },
  );

  return (
    <section ref={root} id={id} data-screen-label={label} className={`${s.root} ${s.story} ${className}`}>
      <div className={s.hex} aria-hidden="true" />
      <div ref={wipe} className={s.wipe}>
        {children}
      </div>
    </section>
  );
}
