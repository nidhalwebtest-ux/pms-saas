"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/* ============================================================================
 *  useTabParam — URL-sync helper for the active tab of a Tabs surface.
 *
 *  Reads `?{paramName}=…` from the URL with a `fallback` default; writes back
 *  via `router.replace` (no history push so browser back doesn't get cluttered
 *  by tab clicks). When the value equals the fallback the param is stripped
 *  from the URL — shared links only carry meaningfully diverged state.
 *
 *  Usage:
 *    const [tab, setTab] = useTabParam("tab", "overview");
 *    <Tabs value={tab} onValueChange={setTab}> … </Tabs>
 *
 *  Notes:
 *  - Lives next to useFilterParams under the same convention.
 *  - The param name defaults to `"tab"` — pass a different name for a page
 *    that nests two tab strips (rare).
 *  - Tab switching does NOT scroll-jump because `scroll: false` is passed to
 *    router.replace.
 * ========================================================================= */

export function useTabParam(
  paramName: string,
  fallback: string,
): [string, (v: string) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const value = searchParams.get(paramName) ?? fallback;

  const setValue = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === fallback) params.delete(paramName);
      else params.set(paramName, next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, fallback, paramName, pathname, router],
  );

  return [value, setValue];
}
