"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui";
import { useTourState } from "@/hooks/useTourState";
import { TOUR_STEPS } from "./steps";

const PAD = 8; // spotlight padding around the target element
const POLL_MS = 150;
const POLL_TIMEOUT_MS = 3000; // after this, show a "still loading" hint — polling itself never stops

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * Auto-starting, restartable guided tour for demo-org visitors. Spotlights
 * one real UI element at a time with a tooltip, matching the
 * getBoundingClientRect-based positioning already used by the availability
 * calendar's own tooltips (AvailabilityCalendarView) rather than pulling in
 * a new dependency for something this small.
 *
 * State survives real page navigations via localStorage (useTourState) —
 * a route change remounts this component fresh, so on mount it resumes at
 * the persisted step and waits for that step's target to exist before
 * drawing the spotlight (the target may be on a page that's still loading,
 * or behind a still-closed modal the visitor has to open themselves).
 */
export function TourOverlay() {
  const t = useTranslations("dashboard.tour");
  const router = useRouter();
  const pathname = usePathname();
  const tour = useTourState();
  const [rect, setRect] = useState<Rect | null>(null);
  const [notFound, setNotFound] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const step = TOUR_STEPS[tour.step];
  const isLastStep = tour.step === TOUR_STEPS.length - 1;

  // Locate the target element for the current step. Keeps polling
  // indefinitely rather than giving up — the target may just be behind a
  // slow data fetch (the Today tabs render only once dashboard data has
  // loaded) or waiting on the visitor's own action (the calendar steps
  // need them to click the FAB first). A "still loading" hint appears
  // after a few seconds so the wait doesn't look broken, but polling never
  // actually stops until the element is found or the tour moves on.
  useEffect(() => {
    setRect(null);
    setNotFound(false);
    if (pollRef.current) clearInterval(pollRef.current);
    if (!tour.hydrated || !tour.active || !step) return;
    if (step.route && step.route !== pathname) return; // still navigating

    const startedAt = Date.now();
    function tick() {
      const el = document.querySelector(step!.selector);
      if (el) {
        setRect(rectOf(el));
        setNotFound(false);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        return;
      }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) setNotFound(true);
    }
    tick();
    pollRef.current = setInterval(tick, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour.hydrated, tour.active, tour.step, pathname]);

  // Keep the spotlight glued to its target across scroll/resize.
  useEffect(() => {
    if (!rect) return;
    function reposition() {
      const el = document.querySelector(step!.selector);
      if (el) setRect(rectOf(el));
    }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect, tour.step]);

  if (!tour.hydrated || !tour.active || !step) return null;

  // Navigating happens only here, as a direct result of the visitor
  // clicking Next — never as a reactive effect. An effect watching
  // pathname/step would also fire on a fresh page load (e.g. the visitor
  // typing a URL, or a hard navigation into Vendors mid-tour), forcibly
  // yanking them back to whatever route the current step wants — which is
  // exactly the bug this replaced.
  function next() {
    if (isLastStep) {
      tour.stop();
      return;
    }
    const nextStep = TOUR_STEPS[tour.step + 1];
    tour.goToStep(tour.step + 1);
    if (nextStep.route && nextStep.route !== pathname) {
      // The availability calendar is a modal rendered by a layout-level
      // component, not a route, so it stays mounted across a client-side
      // navigation unless explicitly closed first.
      const closeCalendarBtn = document.querySelector<HTMLButtonElement>('[data-tour="close-calendar"]');
      closeCalendarBtn?.click();
      router.push(nextStep.route);
    }
  }

  const tooltipStyle = rect ? tooltipPosition(rect, step.placement) : null;

  return (
    // pointer-events-none on the container so the spotlight cutout (the
    // gap the 4 backdrop panels below deliberately don't cover) lets clicks
    // through to the real target underneath — e.g. step 2 asks the visitor
    // to click the actual calendar FAB, which only works if nothing here is
    // silently eating that click. Each interactive piece (backdrop panels,
    // tooltip) re-enables pointer-events on itself explicitly.
    <div className="fixed inset-0 z-[100] pointer-events-none" role="dialog" aria-modal="true" aria-label={t("ariaLabel")}>
      {/* Dimmed backdrop with a cutout around the target, drawn via 4 panels
          rather than a CSS mask so it degrades gracefully everywhere. */}
      {rect && (() => {
        // Clamp the padded spotlight bounds to the viewport — a target
        // flush against an edge (e.g. the RTL calendar's unit rail, which
        // sits right at the right edge) would otherwise push the "+PAD"
        // margin off-screen, leaving that side's dimming panel (and part of
        // the ring) drawn past x=viewport width, invisible.
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const top = Math.max(0, rect.top - PAD);
        const left = Math.max(0, rect.left - PAD);
        const right = Math.min(vw, rect.left + rect.width + PAD);
        const bottom = Math.min(vh, rect.top + rect.height + PAD);
        return (
          <>
            <div className="fixed pointer-events-auto bg-black/50 transition-all" style={{ top: 0, left: 0, right: 0, height: top }} />
            <div className="fixed pointer-events-auto bg-black/50 transition-all" style={{ top, left: 0, width: left, height: bottom - top }} />
            <div className="fixed pointer-events-auto bg-black/50 transition-all" style={{ top, left: right, right: 0, height: bottom - top }} />
            <div className="fixed pointer-events-auto bg-black/50 transition-all" style={{ top: bottom, left: 0, right: 0, bottom: 0 }} />
            <div
              className="fixed rounded-lg ring-2 ring-brand-400 transition-all pointer-events-none"
              style={{ top, left, width: right - left, height: bottom - top }}
            />
          </>
        );
      })()}
      {!rect && <div className="fixed inset-0 pointer-events-auto bg-black/50" />}

      <div
        className="fixed pointer-events-auto w-[300px] rounded-xl bg-surface p-4 shadow-2xl"
        style={tooltipStyle ?? { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold text-fg">{t(step.titleKey)}</p>
          <button
            type="button"
            onClick={() => tour.stop()}
            aria-label={t("skip")}
            className="flex-shrink-0 -m-1 p-1 rounded text-fg-tertiary hover:bg-black/[0.04] hover:text-fg-secondary"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-sm text-fg-secondary">
          {notFound ? t("waiting") : t(step.bodyKey)}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-fg-tertiary ltr-numbers">
            {t("progress", { current: tour.step + 1, total: TOUR_STEPS.length })}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => tour.stop()}>
              {t("skip")}
            </Button>
            {rect && (
              <Button variant="primary" size="sm" onClick={next}>
                {isLastStep ? t("finish") : t("next")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function tooltipPosition(
  rect: Rect,
  placement: "top" | "bottom" | "left" | "right",
): React.CSSProperties {
  const gap = 14;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = rect.top;
  let left = rect.left;

  if (placement === "bottom") {
    top = rect.top + rect.height + gap;
    left = rect.left;
  } else if (placement === "top") {
    top = rect.top - gap;
    left = rect.left;
  } else if (placement === "right") {
    top = rect.top;
    left = rect.left + rect.width + gap;
  } else {
    top = rect.top;
    left = rect.left - gap;
  }

  // Clamp inside the viewport (same defensive pattern as the calendar's
  // own tooltip positioning in AvailabilityCalendarView).
  const tooltipWidth = 300;
  const tooltipHeightEstimate = 140;
  left = Math.min(Math.max(8, left), vw - tooltipWidth - 8);
  if (placement === "top") {
    top = Math.max(8, top - tooltipHeightEstimate);
  } else {
    top = Math.min(Math.max(8, top), vh - tooltipHeightEstimate - 8);
  }

  return { top, left };
}
