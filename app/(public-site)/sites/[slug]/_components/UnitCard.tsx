"use client";

import Link from "next/link";
import { useSite } from "@/lib/public-site/context";
import type { PublicUnit } from "@/lib/public-site/data";
import Photo from "./Photo";

export default function UnitCard({
  unit, href, cta, priceMain, priceSub, badge,
}: {
  unit: PublicUnit;
  href: string;
  cta: string;
  priceMain?: string | null;
  priceSub?: string | null;
  badge?: string | null;
}) {
  const { dict } = useSite();
  const specs = [
    `${unit.bedrooms} ${dict.common.bedrooms}`,
    `${unit.bathrooms} ${dict.common.bathrooms}`,
    unit.maxGuests ? `${dict.common.sleeps} ${unit.maxGuests}` : null,
  ].filter(Boolean);

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/[0.06]">
      <Link href={href} className="relative block">
        <Photo src={unit.photos[0]} alt={unit.name} rounded="rounded-none" ratio="aspect-[3/2]" />
        {badge && (
          <span className="absolute start-3 top-3 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm" style={{ background: "var(--site-accent)" }}>
            {badge}
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <Link href={href}>
          <h3 className="text-lg font-semibold text-slate-900 font-[family-name:var(--font-display)] transition group-hover:text-[color:var(--site-primary)]">{unit.name}</h3>
        </Link>
        <p className="mt-0.5 text-xs text-slate-500">{unit.buildingName}</p>
        <p className="mt-2 text-xs text-slate-400">{specs.join(" · ")}</p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-5">
          {priceMain ? (
            <div className="min-w-0">
              <div className="text-xl font-bold text-slate-900">{priceMain}</div>
              {priceSub && <div className="truncate text-xs text-slate-400">{priceSub}</div>}
            </div>
          ) : <span />}
          <Link
            href={href}
            className="shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            style={{ background: "var(--site-primary)" }}
          >
            {cta}
          </Link>
        </div>
      </div>
    </div>
  );
}
