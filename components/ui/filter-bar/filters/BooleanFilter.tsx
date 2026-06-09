"use client";

import { useEffect, useRef, useState } from "react";
import { FilterTrigger, FilterPopoverPanel } from "./FilterTrigger";
import type { BooleanFilterDef } from "../types";

export function BooleanFilter({ def }: { def: BooleanFilterDef }) {
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

  const labels = {
    on:  def.labels?.on  ?? "Yes",
    off: def.labels?.off ?? "No",
    any: def.labels?.any ?? "Any",
  };

  const isActive = def.value !== null;
  const display =
    def.value === true ? labels.on :
    def.value === false ? labels.off :
    "All";

  function pick(v: boolean | null) {
    def.onChange(v);
    setOpen(false);
  }

  const choices: { value: boolean | null; label: string }[] = [
    { value: null,  label: labels.any },
    { value: true,  label: labels.on },
    { value: false, label: labels.off },
  ];

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
        <FilterPopoverPanel className="min-w-[160px]">
          <ul role="radiogroup" aria-label={def.label} className="space-y-0.5 -mx-1">
            {choices.map((c) => {
              const active = c.value === def.value;
              return (
                <li key={String(c.value)}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => pick(c.value)}
                    className={`w-full text-start rounded-md px-2 py-1.5 text-sm ${
                      active ? "bg-brand-50 text-brand-700" : "text-fg hover:bg-subtle"
                    }`}
                  >
                    {c.label}
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
