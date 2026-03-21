"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const TIMEOUT_MS  = 60 * 60 * 1000; // 60 minutes
const STORAGE_KEY = "omrent_last_activity";

/**
 * Mounts invisibly in the dashboard layout.
 * Watches for any user interaction and resets a 60-minute inactivity timer.
 * When the timer fires (or on mount if already expired), signs the user out
 * and redirects to /login?error=session_expired.
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
    // Check if user was already inactive (e.g. left tab open overnight)
    const last = Number(localStorage.getItem(STORAGE_KEY) ?? 0);
    if (last && Date.now() - last > TIMEOUT_MS) {
      signOut();
      return;
    }

    // Start timer with remaining time if session was saved, else full timeout
    const remaining = last ? TIMEOUT_MS - (Date.now() - last) : TIMEOUT_MS;
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
