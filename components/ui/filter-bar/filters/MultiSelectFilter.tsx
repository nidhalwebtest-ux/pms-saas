"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon } from "@heroicons/react/24/outline";
import { FilterTrigger, FilterPopoverPanel, FilterPanelFooter } from "./FilterTrigger";
import type { MultiSelectFilterDef } from "../types";

export function MultiSelectFilter({ def }: { def: MultiSelectFilterDef }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(def.value);
  const rootRef = useRef<HTMLDivElement>(null);

  // Sync draft to live value when opening so cancelling restores cleanly.
  useEffect(() => {
    if (open) setDraft(def.value);
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

  const isActive = def.value.length > 0;
  const firstLabel =
    def.options.find((o) => o.value === def.value[0])?.label ?? "All";
  const extra = Math.max(0, def.value.length - 1);

  function toggle(v: string) {
    setDraft((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v]));
  }

  function apply() {
    def.onChange(draft);
    setOpen(false);
  }

  function clear() {
    setDraft([]);
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <FilterTrigger
        label={def.label}
        value={isActive ? firstLabel : "All"}
        active={isActive}
        countBadge={extra}
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
          <ul role="listbox" aria-multiselectable="true" className="max-h-72 overflow-y-auto -mx-1">
            {def.options.map((opt) => {
              const checked = draft.includes(opt.value);
              return (
                <li key={opt.value}>
                  <label
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer ${
                      checked ? "bg-brand-50 text-brand-700" : "text-fg hover:bg-subtle"
                    } ${opt.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={opt.disabled}
                      onChange={() => toggle(opt.value)}
                      className="rounded border-border-default text-brand-600 focus:ring-brand-500"
                    />
                    {opt.icon && <span className="text-fg-tertiary">{opt.icon}</span>}
                    <span className="flex-1">
                      {opt.label}
                      {opt.description && (
                        <span className="block text-xs text-fg-tertiary mt-0.5">
                          {opt.description}
                        </span>
                      )}
                    </span>
                    {checked && <CheckIcon className="h-4 w-4 text-brand-600 flex-shrink-0" aria-hidden="true" />}
                  </label>
                </li>
              );
            })}
          </ul>
          <FilterPanelFooter
            onClear={clear}
            onApply={apply}
            clearDisabled={draft.length === 0}
          />
        </FilterPopoverPanel>
      )}
    </div>
  );
}
