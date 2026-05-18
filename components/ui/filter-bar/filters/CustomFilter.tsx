"use client";

import { useEffect, useRef, useState } from "react";
import { FilterTrigger, FilterPopoverPanel } from "./FilterTrigger";
import type { CustomFilterDef } from "../types";

export function CustomFilter({ def }: { def: CustomFilterDef }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={rootRef} className="relative inline-flex">
      <FilterTrigger
        label={def.label}
        value={def.isActive ? def.displayValue : "All"}
        active={def.isActive}
        open={open}
        disabled={def.disabled}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <FilterPopoverPanel>
          {def.render({ close: () => setOpen(false) })}
        </FilterPopoverPanel>
      )}
    </div>
  );
}
