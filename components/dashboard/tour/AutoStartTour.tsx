"use client";

import { useEffect } from "react";
import { useTourState } from "@/hooks/useTourState";

const SEEN_KEY = "binaya-demo-tour-seen";

/**
 * Starts the guided tour automatically the first time a demo visitor lands
 * on the dashboard. Fires once ever per browser (a separate localStorage
 * flag from the tour's own active/step state, since "have they seen it"
 * needs to survive even after the tour finishes or gets skipped).
 */
export function AutoStartTour() {
  const tour = useTourState();

  useEffect(() => {
    if (!tour.hydrated) return;
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      seen = false;
    }
    if (!seen && !tour.active) {
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {
        // ignore
      }
      tour.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour.hydrated]);

  return null;
}
