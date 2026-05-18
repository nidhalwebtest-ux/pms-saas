"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/* ============================================================================
 *  useFilterParams — type-safe URL-sync helper for FilterBar consumers.
 *
 *  Reads + writes `?foo=bar` query params for each declared filter, applies
 *  defaults when a param is absent, and updates the URL via Next's router.
 *
 *  Per-spec serializers:
 *  - raw        a string. Passed through verbatim (the most common case).
 *  - iso-range  "[Date|null, Date|null]" serialised as "YYYY-MM-DD:YYYY-MM-DD".
 *               Either end can be empty (":2026-05-20" / "2026-05-10:").
 *  - num-range  "[number|null, number|null]" serialised as "min:max".
 *  - csv        string[] serialised as a comma-separated list ("a,b,c").
 *
 *  Usage:
 *    const [filters, setFilters] = useFilterParams({
 *      status:    { default: "all",            serialize: "raw"       },
 *      building:  { default: "all",            serialize: "raw"       },
 *      dateRange: { default: [null, null],     serialize: "iso-range" },
 *      amount:    { default: [null, null],     serialize: "num-range" },
 *      tags:      { default: [],               serialize: "csv"       },
 *    });
 *    setFilters({ building: "al-noor" });        // patches one key
 *    setFilters({ dateRange: [from, to] });      // patches a range
 *
 *  Empty / default values are dropped from the URL automatically so the
 *  query string only carries facets that meaningfully diverge from the
 *  default state. Bookmarking and link-sharing fall out of this for free.
 * ========================================================================= */

export type ParamSerializer = "raw" | "iso-range" | "num-range" | "csv";

// Map each serializer to its decoded type so the hook's return value is
// strongly typed against the consumer's schema.
type DecodedFor<S extends ParamSerializer> =
  S extends "raw"        ? string
  : S extends "iso-range"? [Date | null, Date | null]
  : S extends "num-range"? [number | null, number | null]
  : S extends "csv"      ? string[]
  : never;

export interface FilterParamSpec<S extends ParamSerializer = ParamSerializer> {
  serialize: S;
  default:   DecodedFor<S>;
}

export type FilterParamSchema = Record<string, FilterParamSpec>;

type FilterValues<S extends FilterParamSchema> = {
  [K in keyof S]: DecodedFor<S[K]["serialize"]>;
};

/* ── Serialisers ─────────────────────────────────────────────────────────── */

function isoDate(d: Date | null): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIso(s: string): Date | null {
  if (!s) return null;
  // Local-midnight parse to avoid TZ drift on stay-date boundaries.
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function encode(spec: FilterParamSpec, value: unknown): string | null {
  if (value === undefined) return null;
  switch (spec.serialize) {
    case "raw": {
      const v = value as string;
      return v && v !== (spec.default as string) ? v : null;
    }
    case "iso-range": {
      const [from, to] = value as [Date | null, Date | null];
      if (!from && !to) return null;
      return `${isoDate(from)}:${isoDate(to)}`;
    }
    case "num-range": {
      const [min, max] = value as [number | null, number | null];
      if (min === null && max === null) return null;
      return `${min ?? ""}:${max ?? ""}`;
    }
    case "csv": {
      const arr = value as string[];
      return arr.length > 0 ? arr.join(",") : null;
    }
  }
}

function decode(spec: FilterParamSpec, raw: string | null): unknown {
  if (raw === null || raw === "") return spec.default;
  switch (spec.serialize) {
    case "raw":
      return raw;
    case "iso-range": {
      const [a, b] = raw.split(":");
      return [parseIso(a), parseIso(b)];
    }
    case "num-range": {
      const [a, b] = raw.split(":");
      const min = a === "" || a === undefined ? null : Number(a);
      const max = b === "" || b === undefined ? null : Number(b);
      return [
        Number.isFinite(min as number) ? (min as number) : null,
        Number.isFinite(max as number) ? (max as number) : null,
      ];
    }
    case "csv":
      return raw.split(",").filter(Boolean);
  }
}

/* ── Hook ────────────────────────────────────────────────────────────────── */

export function useFilterParams<S extends FilterParamSchema>(
  schema: S,
): [FilterValues<S>, (patch: Partial<FilterValues<S>>) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Decode current URL into the typed shape declared by `schema`.
  const filters = useMemo(() => {
    const out = {} as FilterValues<S>;
    for (const key in schema) {
      const spec = schema[key];
      out[key] = decode(spec, searchParams.get(key)) as FilterValues<S>[typeof key];
    }
    return out;
  }, [schema, searchParams]);

  const setFilters = useCallback(
    (patch: Partial<FilterValues<S>>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const key in patch) {
        const spec = schema[key];
        const encoded = encode(spec, patch[key]);
        if (encoded === null) next.delete(key);
        else next.set(key, encoded);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [schema, searchParams, router, pathname],
  );

  return [filters, setFilters];
}
