"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ListTree } from "lucide-react";
import type { TocItem } from "@/lib/blog/content.server";

function useActiveHeading(ids: string[]) {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-90px 0px -65% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);
  return active;
}

function Items({ items, active, onPick }: { items: TocItem[]; active: string | null; onPick?: () => void }) {
  return (
    <ol className="space-y-0.5">
      {items.map((it) => (
        <li key={it.id}>
          <a
            href={`#${it.id}`}
            onClick={onPick}
            aria-current={active === it.id ? "location" : undefined}
            className={[
              "block border-s-2 py-1.5 text-[14px] leading-snug transition-colors",
              it.level === 3 ? "ps-6" : "ps-3",
              active === it.id ? "border-brand-500 font-semibold text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900",
            ].join(" ")}
          >
            {it.text}
          </a>
        </li>
      ))}
    </ol>
  );
}

/** Sticky outline on desktop. */
export function TocSidebar({ items, label }: { items: TocItem[]; label: string }) {
  const active = useActiveHeading(items.map((i) => i.id));
  if (items.length < 2) return null;
  return (
    <nav aria-label={label} className="sticky top-24">
      <p className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-gray-500">
        <ListTree className="h-4 w-4" /> {label}
      </p>
      <div className="max-h-[calc(100vh-180px)] overflow-y-auto pe-2">
        <Items items={items} active={active} />
      </div>
    </nav>
  );
}

/** Collapsible outline above the article on phones/tablets. */
export function TocInline({ items, label }: { items: TocItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const active = useActiveHeading(items.map((i) => i.id));
  if (items.length < 2) return null;
  return (
    <nav aria-label={label} className="rounded-2xl border border-gray-200 bg-gray-50/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-[15px] font-semibold text-gray-900"
      >
        <span className="inline-flex items-center gap-2"><ListTree className="h-4 w-4 text-brand-600" /> {label}</span>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4">
          <Items items={items} active={active} onPick={() => setOpen(false)} />
        </div>
      )}
    </nav>
  );
}
