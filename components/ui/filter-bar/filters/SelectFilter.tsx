"use client";

import { useState, useRef, useEffect } from "react";
import { CheckIcon } from "@heroicons/react/24/outline";
import { FilterTrigger, FilterPopoverPanel } from "./FilterTrigger";
import type { SelectFilterDef } from "../types";

export function SelectFilter({ def }: { def: SelectFilterDef }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const allValue = def.allValue ?? "all";
  const selected = def.options.find((o) => o.value === def.value);
  const isActive = def.value !== allValue;
  const display = selected?.label ?? def.options[0]?.label ?? "All";

  // Click-outside dismiss
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

  function pick(value: string) {
    def.onChange(value);
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
        ariaProps={{ "aria-haspopup": "listbox" } as React.HTMLAttributes<HTMLButtonElement>}
      />
      {open && (
        <FilterPopoverPanel>
          {def.helpText && (
            <p className="text-xs text-fg-tertiary mb-2">{def.helpText}</p>
          )}
          <ul role="listbox" className="max-h-72 overflow-y-auto -mx-1">
            {def.options.map((opt) => {
              const active = opt.value === def.value;
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={opt.disabled}
                    onClick={() => pick(opt.value)}
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-start ${
                      active
                        ? "bg-brand-50 text-brand-700"
                        : "text-fg hover:bg-subtle"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <span className="inline-flex items-center gap-2">
                      {opt.icon && <span className="text-fg-tertiary">{opt.icon}</span>}
                      <span>
                        {opt.label}
                        {opt.description && (
                          <span className="block text-xs text-fg-tertiary mt-0.5">
                            {opt.description}
                          </span>
                        )}
                      </span>
                    </span>
                    {active && <CheckIcon className="h-4 w-4 text-brand-600 flex-shrink-0" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </FilterPopoverPanel>
      )}
    </div>
  );
}
