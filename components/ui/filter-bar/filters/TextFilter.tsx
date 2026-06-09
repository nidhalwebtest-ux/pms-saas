"use client";

import { useEffect, useRef, useState } from "react";
import { FilterTrigger, FilterPopoverPanel, FilterPanelFooter } from "./FilterTrigger";
import type { TextFilterDef } from "../types";

export function TextFilter({ def }: { def: TextFilterDef }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(def.value);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDraft(def.value);
      requestAnimationFrame(() => inputRef.current?.focus());
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

  const isActive = def.value.trim() !== "";
  const display = isActive
    ? def.value.length > 12 ? `${def.value.slice(0, 12)}…` : def.value
    : "All";

  function apply() {
    def.onChange(draft.trim());
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
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") apply(); }}
            placeholder={def.placeholder}
            className="w-full h-9 rounded-md border border-border-default bg-surface px-2.5 text-sm focus:outline-none focus:border-brand-400 focus:shadow-focus"
          />
          <FilterPanelFooter
            onClear={() => setDraft("")}
            onApply={apply}
            clearDisabled={draft === ""}
          />
        </FilterPopoverPanel>
      )}
    </div>
  );
}
