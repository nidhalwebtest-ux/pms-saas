"use client";

import { useEffect, useState } from "react";

/**
 * Returns `true` when the viewport is narrower than `breakpoint` (px). SSR-safe
 * — returns `false` on the server, then re-renders after mount once
 * `window.matchMedia` is available.
 */
export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    // Safari < 14 only supports addListener / removeListener on MediaQueryList.
    if (mq.addEventListener) {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, [breakpoint]);

  return isMobile;
}
