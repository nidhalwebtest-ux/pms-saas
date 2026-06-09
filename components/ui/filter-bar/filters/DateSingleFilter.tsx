"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { FilterTrigger, FilterPopoverPanel, FilterPanelFooter } from "./FilterTrigger";
import type { DateSingleFilterDef } from "../types";

export function DateSingleFilter({ def }: { def: DateSingleFilterDef }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date | undefined>(def.value ?? undefined);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setDraft(def.value ?? undefined);
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

  const isActive = def.value !== null;
  const display = def.value ? format(def.value, "dd MMM yyyy") : "All";

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
        <FilterPopoverPanel className="w-auto">
          <DayPicker
            mode="single"
            selected={draft}
            onSelect={setDraft}
            weekStartsOn={6}
          />
          <FilterPanelFooter
            onClear={() => setDraft(undefined)}
            onApply={() => {
              def.onChange(draft ?? null);
              setOpen(false);
            }}
            clearDisabled={!draft}
          />
        </FilterPopoverPanel>
      )}
    </div>
  );
}
