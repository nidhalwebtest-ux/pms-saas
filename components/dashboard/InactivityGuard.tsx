"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const TIMEOUT_MS  = 60 * 60 * 1000; // 60 minutes
const STORAGE_KEY = "omrent_last_activity";

/**
 * Secondary inactivity guard (client-side).
 * The primary check is in middleware (cookie-based, server-enforced on every
 * navigation). This component handles long single-page sessions where the user
 * stays on one page without navigating for 60 minutes.
 */
export default function InactivityGuard() {
  const router   = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const signOut = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEY);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login?error=session_expired");
  }, [router]);

  const resetTimer = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(signOut, TIMEOUT_MS);
  }, [signOut]);

  useEffect(() => {
    const now  = Date.now();
    const last = Number(localStorage.getItem(STORAGE_KEY) ?? 0);

    // If a previous timestamp exists and the deadline has passed, sign out now
    if (last && now - last > TIMEOUT_MS) {
      signOut();
      return;
    }

    // Always stamp the mount time so the expiry check works on the next reload
    localStorage.setItem(STORAGE_KEY, String(now));

    // Start timer from remaining time (or full duration if first visit)
    const remaining = last ? TIMEOUT_MS - (now - last) : TIMEOUT_MS;
    timerRef.current = setTimeout(signOut, remaining);

    const events = [
      "mousemove", "mousedown", "keydown",
      "touchstart", "scroll", "click",
    ] as const;

    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [resetTimer, signOut]);

  return null;
}
