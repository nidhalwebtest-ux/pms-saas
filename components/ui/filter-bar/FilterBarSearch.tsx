"use client";

import { useEffect, useRef, useState } from "react";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { SearchProp } from "./types";

/* ============================================================================
 *  Search input. Internally debounced — the parent gets a single onChange
 *  per debounce window (default 300 ms). Enter flushes immediately.
 * ========================================================================= */

export interface FilterBarSearchProps {
  search: SearchProp;
  /** Class hook on the wrapper. */
  className?: string;
}

export function FilterBarSearch({ search, className = "" }: FilterBarSearchProps) {
  const { value, onChange, placeholder, debounceMs = 300, shortcut = false } = search;
  const [local, setLocal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external -> internal (URL navigation, reset, etc).
  useEffect(() => {
    setLocal(value);
  }, [value]);

  function commit(next: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (debounceMs <= 0) {
      onChange(next);
      return;
    }
    timerRef.current = setTimeout(() => onChange(next), debounceMs);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setLocal(next);
    commit(next);
  }

  function flush() {
    if (timerRef.current) clearTimeout(timerRef.current);
    onChange(local);
  }

  function clear() {
    setLocal("");
    if (timerRef.current) clearTimeout(timerRef.current);
    onChange("");
    inputRef.current?.focus();
  }

  // ⌘K shortcut focuses the input.
  useEffect(() => {
    if (!shortcut) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        flush();
      }}
      className={`relative flex-1 min-w-0 max-w-[520px] ${className}`}
    >
      <MagnifyingGlassIcon
        className="absolute inset-inline-start-[11px] top-1/2 -translate-y-1/2 h-4 w-4 text-fg-tertiary pointer-events-none"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        value={local}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label={placeholder ?? "Search"}
        className={
          "w-full h-9 rounded-lg bg-subtle border border-border-default ps-9 pe-3 text-[13px] " +
          "placeholder:text-fg-tertiary " +
          "hover:bg-surface hover:border-border-strong " +
          "focus:bg-surface focus:border-brand-400 focus:outline-none focus:shadow-focus " +
          (shortcut ? "pe-12" : local ? "pe-9" : "pe-3")
        }
      />
      {local && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="absolute inset-inline-end-2 top-1/2 -translate-y-1/2 p-1 rounded text-fg-tertiary hover:bg-subtle hover:text-fg-secondary"
        >
          <XMarkIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      {shortcut && !local && (
        <kbd
          aria-hidden="true"
          className="absolute inset-inline-end-2 top-1/2 -translate-y-1/2 font-mono text-[10.5px] text-fg-tertiary bg-subtle border border-border-subtle rounded px-1.5 py-px hidden md:inline-block"
        >
          ⌘K
        </kbd>
      )}
    </form>
  );
}
