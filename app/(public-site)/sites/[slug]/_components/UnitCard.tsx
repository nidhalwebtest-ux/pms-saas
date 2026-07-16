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
    <div className="flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80 transition hover:shadow-lg">
      <Link href={href} className="block">
        <div className="relative">
          <Photo src={unit.photos[0]} alt={unit.name} rounded="rounded-none" ratio="aspect-[3/2]" />
          {badge && (
            <span className="absolute top-2 start-2 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow" style={{ background: "var(--site-accent)" }}>
              {badge}
            </span>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <Link href={href}><h3 className="text-base font-bold text-slate-900 hover:underline">{unit.name}</h3></Link>
        <p className="mt-0.5 text-xs text-slate-500">{unit.buildingName}</p>
        <p className="mt-2 text-xs text-slate-500">{specs.join(" · ")}</p>

        <div className="mt-auto flex items-end justify-between pt-4">
          {priceMain ? (
            <div>
              <div className="text-lg font-extrabold text-slate-900">{priceMain}</div>
              {priceSub && <div className="text-xs text-slate-400">{priceSub}</div>}
            </div>
          ) : <span />}
          <Link
            href={href}
            className="rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            style={{ background: "var(--site-primary)" }}
          >
            {cta}
          </Link>
        </div>
      </div>
    </div>
  );
}
