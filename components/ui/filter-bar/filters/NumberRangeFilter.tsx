"use client";

import { useEffect, useRef, useState } from "react";
import { FilterTrigger, FilterPopoverPanel, FilterPanelFooter } from "./FilterTrigger";
import type { NumberRangeFilterDef } from "../types";

function formatValue([min, max]: [number | null, number | null], unit?: string): string {
  if (min === null && max === null) return "All";
  const u = unit ? ` ${unit}` : "";
  if (min !== null && max === null) return `≥ ${min}${u}`;
  if (min === null && max !== null) return `≤ ${max}${u}`;
  return `${min} – ${max}${u}`;
}

export function NumberRangeFilter({ def }: { def: NumberRangeFilterDef }) {
  const [open, setOpen] = useState(false);
  const [draftMin, setDraftMin] = useState<string>(def.value[0]?.toString() ?? "");
  const [draftMax, setDraftMax] = useState<string>(def.value[1]?.toString() ?? "");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setDraftMin(def.value[0]?.toString() ?? "");
      setDraftMax(def.value[1]?.toString() ?? "");
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
  const display = formatValue(def.value, def.unit);

  function apply() {
    const min = draftMin === "" ? null : Number(draftMin);
    const max = draftMax === "" ? null : Number(draftMax);
    def.onChange([
      Number.isFinite(min as number) ? (min as number) : null,
      Number.isFinite(max as number) ? (max as number) : null,
    ]);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <FilterTrigger
        label={def.label}
        value={display}
        active={isActive}
        open={open}
        disabled={def.disabled}
        onClick={() => setOpen((o) => !o)}
        ariaProps={{ "aria-haspopup": "dialog" } as React.HTMLAttributes<HTMLButtonElement>}
      />
      {open && (
        <FilterPopoverPanel>
          {def.helpText && (
            <p className="text-xs text-fg-tertiary mb-2">{def.helpText}</p>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-xs text-fg-tertiary mb-1">Min</label>
              <input
                type="number"
                value={draftMin}
                onChange={(e) => setDraftMin(e.target.value)}
                step={def.step}
                min={def.min}
                max={def.max}
                placeholder={def.unit}
                className="w-full h-8 rounded-md border border-border-default bg-surface px-2 text-sm focus:outline-none focus:border-brand-400 focus:shadow-focus ltr-numbers"
              />
            </div>
            <span className="mt-5 text-fg-tertiary">–</span>
            <div className="flex-1">
              <label className="block text-xs text-fg-tertiary mb-1">Max</label>
              <input
                type="number"
                value={draftMax}
                onChange={(e) => setDraftMax(e.target.value)}
                step={def.step}
                min={def.min}
                max={def.max}
                placeholder={def.unit}
                className="w-full h-8 rounded-md border border-border-default bg-surface px-2 text-sm focus:outline-none focus:border-brand-400 focus:shadow-focus ltr-numbers"
              />
            </div>
          </div>
          <FilterPanelFooter
            onClear={() => {
              setDraftMin("");
              setDraftMax("");
            }}
            onApply={apply}
            clearDisabled={draftMin === "" && draftMax === ""}
          />
        </FilterPopoverPanel>
      )}
    </div>
  );
}
