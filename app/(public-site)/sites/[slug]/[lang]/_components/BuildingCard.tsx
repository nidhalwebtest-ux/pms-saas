import Link from "next/link";
import { MapPinIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import type { SiteView } from "@/lib/public-site/render";
import type { PublicBuilding } from "@/lib/public-site/data";
import { withBase } from "@/lib/public-site/lang";
import Photo from "./Photo";

/** Server component. */
export default function BuildingCard({ v, building }: { v: SiteView; building: PublicBuilding }) {
  const { dict, lang, theme, base } = v;
  const desc = (lang === "ar" ? building.descriptionAr : building.descriptionEn) || "";
  const place = [building.city, building.governorate].filter(Boolean).join("، ");

  return (
    <Link
      href={withBase(base, `/buildings/${building.id}`)}
      className={`group flex flex-col overflow-hidden bg-white transition duration-300 ${theme.card}`}
    >
      <div className="relative">
        <Photo src={building.photos[0]} alt={building.name} rounded="rounded-none" ratio="aspect-[4/3]" />
        <span className={`absolute end-3 top-3 bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-sm ${theme.chip}`}>
          {building.unitCount} {dict.common.units}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-semibold text-slate-900 font-[family-name:var(--font-display)]">{building.name}</h3>
        {place && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
            <MapPinIcon className="h-3.5 w-3.5" /> {place}
          </p>
        )}
        {desc && <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-slate-500">{desc}</p>}
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--site-primary)" }}>
          {dict.common.viewDetails}
          <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
