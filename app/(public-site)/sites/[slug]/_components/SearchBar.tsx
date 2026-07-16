"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useSite } from "@/lib/public-site/context";

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function SearchBar({
  buildingId,
  initial,
  targetPath = "/search",
}: {
  buildingId?: string;
  initial?: { startDate?: string; endDate?: string; guests?: number };
  /** Where to navigate on submit. Defaults to the availability results page. */
  targetPath?: string;
}) {
  const { dict, dir } = useSite();
  const router = useRouter();

  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(initial?.startDate || today);
  const [end, setEnd] = useState(initial?.endDate || addDays(today, 2));
  const [guests, setGuests] = useState(initial?.guests || 2);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = start;
    const en = end > s ? end : addDays(s, 1);
    const params = new URLSearchParams({ startDate: s, endDate: en, guests: String(guests) });
    if (buildingId) params.set("buildingId", buildingId);
    router.push(`${targetPath}?${params.toString()}`);
  };

  const field = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[color:var(--site-primary)] focus:ring-2 focus:ring-[color:var(--site-primary)]/20";

  return (
    <form
      onSubmit={submit}
      dir={dir}
      className="grid gap-3 rounded-2xl bg-white/95 p-3 shadow-xl shadow-black/5 ring-1 ring-black/5 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
    >
      <label className="block">
        <span className="mb-1 block px-1 text-xs font-medium text-slate-500">{dict.hero.checkIn}</span>
        <input type="date" value={start} min={today} onChange={(e) => { setStart(e.target.value); if (end <= e.target.value) setEnd(addDays(e.target.value, 1)); }} className={field} />
      </label>
      <label className="block">
        <span className="mb-1 block px-1 text-xs font-medium text-slate-500">{dict.hero.checkOut}</span>
        <input type="date" value={end} min={addDays(start, 1)} onChange={(e) => setEnd(e.target.value)} className={field} />
      </label>
      <label className="block">
        <span className="mb-1 block px-1 text-xs font-medium text-slate-500">{dict.hero.guests}</span>
        <select value={guests} onChange={(e) => setGuests(Number(e.target.value))} className={field}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <option key={n} value={n}>{n} {n === 1 ? dict.hero.guest : dict.hero.guestsPlural}</option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
        style={{ background: "var(--site-primary)" }}
      >
        <MagnifyingGlassIcon className="h-5 w-5" />
        <span className="whitespace-nowrap">{dict.hero.search}</span>
      </button>
    </form>
  );
}
