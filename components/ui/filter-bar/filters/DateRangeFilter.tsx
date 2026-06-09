"use client";

import { useEffect, useRef, useState } from "react";
import { format, startOfMonth, endOfMonth, subDays, startOfWeek, startOfYear } from "date-fns";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { FilterTrigger, FilterPopoverPanel, FilterPanelFooter } from "./FilterTrigger";
import type { DateRangeFilterDef, DatePreset } from "../types";

const PRESET_LABELS: Record<Exclude<DatePreset, "custom">, string> = {
  today:           "Today",
  yesterday:       "Yesterday",
  "this-week":     "This week",
  "this-month":    "This month",
  "last-30":       "Last 30 days",
  "last-90":       "Last 90 days",
  "khareef-season":"Khareef (Jun 15 – Sep 15)",
  ytd:             "Year to date",
};

function computePreset(p: Exclude<DatePreset, "custom">): [Date, Date] {
  const now = new Date();
  switch (p) {
    case "today":         return [now, now];
    case "yesterday":     { const y = subDays(now, 1); return [y, y]; }
    case "this-week":     return [startOfWeek(now, { weekStartsOn: 6 }), now];
    case "this-month":    return [startOfMonth(now), endOfMonth(now)];
    case "last-30":       return [subDays(now, 29), now];
    case "last-90":       return [subDays(now, 89), now];
    case "khareef-season":{
      const y = now.getFullYear();
      return [new Date(y, 5, 15), new Date(y, 8, 15)];
    }
    case "ytd":           return [startOfYear(now), now];
  }
}

function formatRange([from, to]: [Date | null, Date | null]) {
  if (!from && !to) return "All";
  if (from && !to)  return format(from, "dd MMM");
  if (!from && to)  return format(to, "dd MMM");
  return `${format(from!, "dd MMM")} – ${format(to!, "dd MMM")}`;
}

export function DateRangeFilter({ def }: { def: DateRangeFilterDef }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>({
    from: def.value[0] ?? undefined,
    to:   def.value[1] ?? undefined,
  });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setDraft({ from: def.value[0] ?? undefined, to: def.value[1] ?? undefined });
    }
  }, [open, def.value]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isActive = def.value[0] !== null || def.value[1] !== null;

  const presetList: Exclude<DatePreset, "custom">[] =
    def.presets === "all"
      ? ["today", "yesterday", "this-week", "this-month", "last-30", "last-90", "khareef-season", "ytd"]
      : ((def.presets ?? []).filter((p): p is Exclude<DatePreset, "custom"> => p !== "custom"));

  function apply() {
    def.onChange([draft?.from ?? null, draft?.to ?? null]);
    setOpen(false);
  }
  function clear() {
    setDraft(undefined);
  }
  function pickPreset(p: Exclude<DatePreset, "custom">) {
    const [from, to] = computePreset(p);
    setDraft({ from, to });
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <FilterTrigger
        label={def.label}
        value={formatRange(def.value)}
        active={isActive}
        open={open}
        disabled={def.disabled}
        onClick={() => setOpen((o) => !o)}
        ariaProps={{ "aria-haspopup": "dialog" } as React.HTMLAttributes<HTMLButtonElement>}
      />
      {open && (
        <FilterPopoverPanel className="w-auto min-w-[300px]">
          <div className="flex gap-3">
            {presetList.length > 0 && (
              <ul className="flex-shrink-0 w-[150px] space-y-0.5 -mx-1">
                {presetList.map((p) => (
                  <li key={p}>
                    <button
                      type="button"
                      onClick={() => pickPreset(p)}
                      className="w-full text-start rounded-md px-2 py-1.5 text-xs text-fg-secondary hover:bg-subtle hover:text-fg"
                    >
                      {PRESET_LABELS[p]}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="min-w-[280px]">
              <DayPicker
                mode="range"
                selected={draft}
                onSelect={setDraft}
                numberOfMonths={1}
                weekStartsOn={6}
              />
            </div>
          </div>
          <FilterPanelFooter
            onClear={clear}
            onApply={apply}
            clearDisabled={!draft?.from && !draft?.to}
          />
        </FilterPopoverPanel>
      )}
    </div>
  );
}
