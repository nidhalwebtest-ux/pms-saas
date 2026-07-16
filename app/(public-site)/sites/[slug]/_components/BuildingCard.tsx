"use client";

import Link from "next/link";
import { MapPinIcon } from "@heroicons/react/24/outline";
import { useSite } from "@/lib/public-site/context";
import type { PublicBuilding } from "@/lib/public-site/data";
import Photo from "./Photo";

export default function BuildingCard({ building }: { building: PublicBuilding }) {
  const { dict, lang } = useSite();
  const desc = (lang === "ar" ? building.descriptionAr : building.descriptionEn) || "";
  const place = [building.city, building.governorate].filter(Boolean).join("، ");

  return (
    <Link href={`/buildings/${building.id}`} className="group block overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80 transition hover:shadow-lg hover:ring-slate-300">
      <Photo src={building.photos[0]} alt={building.name} rounded="rounded-none" />
      <div className="p-4">
        <h3 className="text-base font-bold text-slate-900">{building.name}</h3>
        {place && (
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500">
            <MapPinIcon className="h-3.5 w-3.5" /> {place}
          </p>
        )}
        {desc && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{desc}</p>}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">{building.unitCount} {dict.common.units}</span>
          <span className="text-sm font-semibold transition group-hover:gap-2" style={{ color: "var(--site-primary)" }}>
            {dict.common.viewDetails} →
          </span>
        </div>
      </div>
    </Link>
  );
}
