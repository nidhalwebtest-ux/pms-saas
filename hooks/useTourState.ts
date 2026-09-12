"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "binaya-demo-tour";

interface TourState {
  active: boolean;
  step: number;
  hydrated: boolean;
}

const INITIAL_STATE: TourState = { active: false, step: 0, hydrated: false };

/**
 * Module-level store + subscriber list so every useTourState() instance on
 * the page — AutoStartTour, TourOverlay, the "Show me around" button — stays
 * in sync the instant one of them changes it, not just on their own next
 * mount. A plain per-hook localStorage read (each instance reading
 * independently on mount) misses updates written by a sibling instance
 * after both have already mounted, which is exactly what happens here:
 * AutoStartTour and TourOverlay mount together in the layout, and
 * AutoStartTour's start() call landed after TourOverlay had already read
 * (and cached) the old "inactive" state.
 */
let current: TourState = INITIAL_STATE;
const listeners = new Set<() => void>();

function readFromStorage(): Omit<TourState, "hydrated"> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { active: false, step: 0 };
    const parsed = JSON.parse(raw);
    return {
      active: Boolean(parsed.active),
      step: Number.isInteger(parsed.step) ? parsed.step : 0,
    };
  } catch {
    return { active: false, step: 0 };
  }
}

function writeToStorage(state: Omit<TourState, "hydrated">): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode) — the tour just won't survive a
    // navigation in that case, which is a reasonable degrade.
  }
}

function setState(next: Omit<TourState, "hydrated">): void {
  current = { ...next, hydrated: true };
  writeToStorage(next);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  if (!current.hydrated) {
    // First subscriber hydrates the module-level store from localStorage —
    // safe to do lazily here since this only ever runs client-side, and
    // notify existing listeners in case getSnapshot was already read stale.
    current = { ...readFromStorage(), hydrated: true };
    listeners.forEach((l) => l());
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): TourState {
  return current;
}

function getServerSnapshot(): TourState {
  return INITIAL_STATE;
}

/**
 * Reads/writes the demo product tour's { active, step }, shared across every
 * component that calls this hook and persisted across real page navigations
 * (a route change remounts the layout tree, so nothing in-memory alone
 * would survive it — localStorage is the durable layer, the module-level
 * store above is what keeps same-page instances in sync).
 */
export function useTourState() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const start = useCallback(() => {
    setState({ active: true, step: 0 });
  }, []);

  const stop = useCallback(() => {
    setState({ active: false, step: 0 });
  }, []);

  const goToStep = useCallback((step: number) => {
    setState({ active: current.active, step });
  }, []);

  return { ...state, start, stop, goToStep };
}
