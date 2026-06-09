"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/* ============================================================================
 *  Reveal — fade + slide-up the children when they enter the viewport.
 *
 *  Uses IntersectionObserver and self-disconnects after the first trigger so
 *  scrolling back up does not re-animate. Respects `prefers-reduced-motion`:
 *  in that mode the children render visible immediately with no transform.
 *
 *  Props:
 *  - delay  ms to wait after the entry before animating (used for staggers)
 *  - from   slide direction. Default "bottom" (slide-up).
 *  - amount % of the element that must be visible to fire. Default 0.12.
 * ========================================================================= */

type RevealProps = {
  children: ReactNode;
  delay?: number;
  from?: "bottom" | "left" | "right";
  amount?: number;
  className?: string;
  as?: "div" | "section" | "article" | "li";
};

const FROM_CLASS: Record<NonNullable<RevealProps["from"]>, string> = {
  bottom: "translate-y-6",
  left:   "-translate-x-6",
  right:  "translate-x-6",
};

export function Reveal({
  children,
  delay = 0,
  from = "bottom",
  amount = 0.12,
  className = "",
  as: As = "div",
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Respect reduced motion: skip the observer entirely so children just paint.
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delay > 0) {
            const id = window.setTimeout(() => setShown(true), delay);
            // Disconnect immediately so re-entries do not queue more timeouts.
            obs.disconnect();
            return () => window.clearTimeout(id);
          }
          setShown(true);
          obs.disconnect();
        }
      },
      { threshold: amount },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay, amount]);

  return (
    <As
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={[
        "transition-[opacity,transform] duration-700 ease-out will-change-[opacity,transform]",
        shown ? "opacity-100 translate-y-0 translate-x-0" : ["opacity-0", FROM_CLASS[from]].join(" "),
        className,
      ].join(" ")}
    >
      {children}
    </As>
  );
}

/* ============================================================================
 *  RevealStagger — wrap a list to fade-in children one after the other.
 *  Each child is a Reveal with an increasing delay; pass `step` to tune the
 *  spacing.
 * ========================================================================= */
export function RevealStagger({
  children,
  step = 80,
  from = "bottom",
  className = "",
}: {
  children: ReactNode;
  step?: number;
  from?: RevealProps["from"];
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.isArray(children)
        ? children.map((child, i) => (
            <Reveal key={i} delay={i * step} from={from}>
              {child}
            </Reveal>
          ))
        : <Reveal from={from}>{children}</Reveal>}
    </div>
  );
}
