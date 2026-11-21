"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlassIcon, CalendarDaysIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { useSite } from "@/lib/public-site/context";
import { withBase } from "@/lib/public-site/lang";

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function SearchBar({
  buildingId,
  initial,
  targetPath = "/search",
  layout = "row",
}: {
  buildingId?: string;
  initial?: { startDate?: string; endDate?: string; guests?: number };
  /** Site path to navigate to on submit (no language prefix). Defaults to the results page. */
  targetPath?: string;
  /** row = one line (wide hero) · grid = 2×2 (half-width hero) · stacked = one field per row (narrow cards). */
  layout?: "row" | "grid" | "stacked";
}) {
  const { dict, dir, theme, base } = useSite();
  const router = useRouter();

  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(initial?.startDate || today);
  const [end, setEnd] = useState(initial?.endDate || addDays(today, 2));
  const [guests, setGuests] = useState(initial?.guests || 2);

  // Pages are pre-rendered and cached, so the server's "today" can be a day old.
  // Correct past dates once in the browser.
  useEffect(() => {
    const now = new Date().toISOString().slice(0, 10);
    if (start < now) {
      setStart(now);
      if (end <= now) setEnd(addDays(now, initial?.endDate ? 1 : 2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = start;
    const en = end > s ? end : addDays(s, 1);
    const params = new URLSearchParams({ startDate: s, endDate: en, guests: String(guests) });
    if (buildingId) params.set("buildingId", buildingId);
    router.push(`${withBase(base, targetPath)}?${params.toString()}`);
  };

  const cell = `flex items-center gap-3 px-4 py-3 ring-1 ring-transparent transition focus-within:bg-white focus-within:ring-[color:var(--site-primary)]/30 ${theme.searchCell}`;
  const input = "w-full bg-transparent text-sm font-medium text-slate-800 outline-none [color-scheme:light]";
  const lbl = "block text-[11px] font-semibold uppercase tracking-wide text-slate-400";

  return (
    <form
      onSubmit={submit}
      dir={dir}
      className={layout === "row" || layout === "grid" ? theme.searchBox : ""}
    >
      <div className={layout === "stacked" ? "grid gap-2" : layout === "grid" ? "grid gap-2 sm:grid-cols-2" : "grid gap-2 sm:grid-cols-[1fr_1fr_0.9fr_auto] sm:items-stretch"}>
        <label className={cell}>
          <CalendarDaysIcon className="h-5 w-5 shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1">
            <span className={lbl}>{dict.hero.checkIn}</span>
            <input type="date" value={start} min={today} onChange={(e) => { setStart(e.target.value); if (end <= e.target.value) setEnd(addDays(e.target.value, 1)); }} className={input} />
          </span>
        </label>
        <label className={cell}>
          <CalendarDaysIcon className="h-5 w-5 shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1">
            <span className={lbl}>{dict.hero.checkOut}</span>
            <input type="date" value={end} min={addDays(start, 1)} onChange={(e) => setEnd(e.target.value)} className={input} />
          </span>
        </label>
        <label className={cell}>
          <UserGroupIcon className="h-5 w-5 shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1">
            <span className={lbl}>{dict.hero.guests}</span>
            <select value={guests} onChange={(e) => setGuests(Number(e.target.value))} className={`${input} -ms-0.5`}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>{n} {n === 1 ? dict.hero.guest : dict.hero.guestsPlural}</option>
              ))}
            </select>
          </span>
        </label>
        <button
          type="submit"
          className={`mt-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 sm:mt-0 ${theme.btn}`}
          style={{ background: "var(--site-primary)" }}
        >
          <MagnifyingGlassIcon className="h-5 w-5" />
          <span className="whitespace-nowrap">{dict.hero.search}</span>
        </button>
      </div>
    </form>
  );
}
