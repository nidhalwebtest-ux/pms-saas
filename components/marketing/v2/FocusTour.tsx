"use client";

import { useRef } from "react";
import type { Rect, Screen } from "@/lib/marketing/screens";
import { FocusScreen, Glow, cameraTo, CAMERA_HOME } from "./FocusScreen";
import { gsap, useGSAP, EASE, DUR, prefersReducedMotion } from "./motion";

/* Plays a camera tour over a real screenshot once it scrolls into view: for each step the camera
 * pushes to the rect and a gold glow lights the exact UI area, like the video's card tour.
 * Click / tap replays it. Reduced motion: no camera move; the first glow is shown statically. */

export type TourStep = { rect: Rect; glow?: Rect; hold?: number; maxScale?: number };

export function FocusTour({
  screen,
  alt,
  steps,
  sizes,
  loop = false,
  startDelay = 0.2,
}: {
  screen: Screen;
  alt: string;
  steps: TourStep[];
  sizes?: string;
  loop?: boolean;
  startDelay?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const cam = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);

  useGSAP(
    () => {
      const glows = gsap.utils.toArray<HTMLElement>("[data-glow]", wrap.current);
      if (prefersReducedMotion()) {
        if (glows[0]) gsap.set(glows[0], { opacity: 1 });
        return;
      }
      const t = gsap.timeline({
        paused: true,
        delay: startDelay,
        repeat: loop ? -1 : 0,
        repeatDelay: 0.6,
        defaults: { ease: EASE.move },
      });
      steps.forEach((st, i) => {
        const at = i === 0 ? 0 : ">";
        t.to(cam.current, { ...cameraTo(screen, st.rect, st.maxScale), duration: i === 0 ? DUR.move : 0.6 }, at);
        if (i > 0 && glows[i - 1]) t.to(glows[i - 1], { opacity: 0, duration: 0.2, ease: EASE.exit }, "<");
        if (glows[i]) t.to(glows[i], { opacity: 1, duration: 0.35, ease: EASE.enter }, "-=0.15");
        t.to({}, { duration: st.hold ?? 0.9 });
      });
      if (loop) {
        t.to(glows[glows.length - 1] ?? {}, { opacity: 0, duration: 0.2, ease: EASE.exit });
        t.to(cam.current, { ...CAMERA_HOME, duration: DUR.move });
      }
      tl.current = t;
      const io = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting) t.play();
          else if (loop) t.pause();
        },
        { threshold: 0.45 },
      );
      if (wrap.current) io.observe(wrap.current);
      return () => io.disconnect();
    },
    { scope: wrap, dependencies: [] },
  );

  const replay = () => {
    if (!tl.current || prefersReducedMotion()) return;
    gsap.set(gsap.utils.toArray("[data-glow]", wrap.current), { opacity: 0 });
    tl.current.restart(true);
  };

  return (
    <div ref={wrap} className="absolute inset-0 cursor-pointer" onClick={replay}>
      <FocusScreen ref={cam} screen={screen} alt={alt} sizes={sizes}>
        {steps.map((st, i) => (
          <Glow key={i} screen={screen} rect={st.glow ?? st.rect} />
        ))}
      </FocusScreen>
    </div>
  );
}
