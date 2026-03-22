"use client";

/**
 * Thin top progress bar that fires whenever Next.js navigates.
 * Strategy: intercept history.pushState / popstate → start animation.
 *           usePathname + useSearchParams change → navigation complete → finish.
 *
 * Must be wrapped in <Suspense> because of useSearchParams.
 */

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function ProgressBarInner() {
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  const [width,   setWidth]   = useState(0);
  const [visible, setVisible] = useState(false);

  const navigating = useRef(false);
  const interval   = useRef<ReturnType<typeof setInterval>  | null>(null);
  const hideTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (interval.current)  clearInterval(interval.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }

  function start() {
    if (navigating.current) return;
    navigating.current = true;
    clearTimers();
    setVisible(true);
    setWidth(8);
    let w = 8;
    interval.current = setInterval(() => {
      w = Math.min(w + (88 - w) * 0.12 + 0.3, 88);
      setWidth(w);
    }, 120);
  }

  function done() {
    if (!navigating.current) return;
    navigating.current = false;
    clearTimers();
    setWidth(100);
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 350);
  }

  // URL changed → navigation complete
  useEffect(() => {
    done();
  }, [pathname, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Intercept history.pushState to detect navigation start
  useEffect(() => {
    const orig = history.pushState.bind(history);
    history.pushState = (...args) => { start(); return orig(...args); };
    window.addEventListener("popstate", start);
    return () => {
      history.pushState = orig;
      window.removeEventListener("popstate", start);
      clearTimers();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible && width === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[3px]"
      style={{ opacity: visible || width > 0 ? 1 : 0, transition: "opacity 0.2s" }}
    >
      <div
        className="h-full bg-blue-500 shadow-sm"
        style={{
          width: `${width}%`,
          transition: width === 100 ? "width 0.15s ease-out" : "width 0.12s linear",
        }}
      />
    </div>
  );
}

// Public export — wraps in Suspense to satisfy the useSearchParams requirement
import { Suspense } from "react";

export default function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <ProgressBarInner />
    </Suspense>
  );
}
