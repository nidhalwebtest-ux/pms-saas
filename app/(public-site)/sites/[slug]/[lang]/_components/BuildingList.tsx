import Link from "next/link";
import { MapPinIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import type { SiteView } from "@/lib/public-site/render";
import type { PublicBuilding } from "@/lib/public-site/data";
import { withBase } from "@/lib/public-site/lang";
import Img from "./Img";
import Photo from "./Photo";
import BuildingCard from "./BuildingCard";

const placeOf = (b: PublicBuilding) => [b.city, b.governorate].filter(Boolean).join("، ");
const descOf = (v: SiteView, b: PublicBuilding) => (v.lang === "ar" ? b.descriptionAr : b.descriptionEn) || "";

/**
 * The buildings list — a different presentation per template:
 *   Coastal → photo cards in a grid · Classic → editorial rows, alternating sides · Modern → bento tiles.
 * Server component.
 */
export default function BuildingList({ v, buildings }: { v: SiteView; buildings: PublicBuilding[] }) {
  if (v.theme.key === "template_2") return <ClassicRows v={v} buildings={buildings} />;
  if (v.theme.key === "template_3") return <ModernTiles v={v} buildings={buildings} />;
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {buildings.map((b) => <BuildingCard key={b.id} v={v} building={b} />)}
    </div>
  );
}

/** Classic: big framed photo + centred-left text, sides alternate. */
function ClassicRows({ v, buildings }: { v: SiteView; buildings: PublicBuilding[] }) {
  const { dict, base } = v;
  return (
    <div className="space-y-14 sm:space-y-20">
      {buildings.map((b, i) => {
        const place = placeOf(b);
        const desc = descOf(v, b);
        const href = withBase(base, `/buildings/${b.id}`);
        return (
          <article key={b.id} className="grid items-center gap-6 md:grid-cols-12 md:gap-12">
            <Link href={href} className={`group block md:col-span-7 ${i % 2 === 1 ? "md:order-2" : ""}`}>
              <div className="bg-white p-2 ring-1 ring-stone-300">
                <Photo src={b.photos[0]} alt={b.name} rounded="rounded-none" ratio="aspect-[4/3]" sizes="(max-width: 768px) 100vw, 58vw" />
              </div>
            </Link>
            <div className={`md:col-span-5 ${i % 2 === 1 ? "md:order-1" : ""}`}>
              {place && (
                <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.28em]" style={{ color: "var(--site-accent)" }}>
                  <MapPinIcon className="h-3.5 w-3.5" /> {place}
                </p>
              )}
              <h3 className="mt-3 text-3xl font-normal leading-tight text-stone-900 font-[family-name:var(--font-display)] sm:text-4xl">{b.name}</h3>
              <div className="my-5 h-px w-14" style={{ background: "var(--site-accent)" }} />
              {desc && <p className="line-clamp-4 leading-relaxed text-stone-600">{desc}</p>}
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-stone-400">{b.unitCount} {dict.common.units}</p>
              <Link
                href={href}
                className="mt-6 inline-flex items-center gap-2 border-b border-[color:var(--site-primary)] pb-1 text-[12px] font-semibold uppercase tracking-[0.2em] text-[color:var(--site-primary)] transition hover:gap-3"
              >
                {dict.common.viewDetails}
                <ArrowRightIcon className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

/** Modern: bento grid of full-bleed photo tiles; the first one is featured when there are 3+. */
function ModernTiles({ v, buildings }: { v: SiteView; buildings: PublicBuilding[] }) {
  const { dict, base, theme } = v;
  const n = buildings.length;
  const feature = n >= 3;
  // Keep the 3-column grid free of holes: the featured tile + 2 side tiles fill the first two rows,
  // then every 3 tiles fill a row; if the last row is short, the last tile stretches to close it.
  const rem = feature ? (n - 3) % 3 : n % 3;
  const lastSpan = rem === 1 ? "lg:col-span-3" : rem === 2 ? "lg:col-span-2" : "";
  return (
    <div className="grid auto-rows-[260px] gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {buildings.map((b, i) => {
        const big = feature && i === 0;
        const place = placeOf(b);
        return (
          <Link
            key={b.id}
            href={withBase(base, `/buildings/${b.id}`)}
            className={`group relative isolate overflow-hidden bg-slate-200 ${theme.card} ${big ? "sm:col-span-2 sm:row-span-2" : i === n - 1 ? lastSpan : ""}`}
          >
            {b.photos[0] ? (
              <Img src={b.photos[0]} alt={b.name} fill sizes={big ? "(max-width: 640px) 100vw, 66vw" : "(max-width: 640px) 100vw, 33vw"} className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]" />
            ) : (
              <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, var(--site-primary), color-mix(in srgb, var(--site-accent) 55%, var(--site-primary)))" }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
            <span className={`absolute end-3 top-3 bg-white/90 px-2.5 py-1 text-xs font-bold text-slate-900 ${theme.chip}`}>{b.unitCount} {dict.common.units}</span>
            <div className="absolute inset-x-0 bottom-0 p-5">
              <h3 className={`font-bold leading-tight tracking-tight text-white font-[family-name:var(--font-display)] ${big ? "text-3xl sm:text-4xl" : "text-xl"}`}>{b.name}</h3>
              <div className="mt-1 flex items-center justify-between gap-2 text-sm text-white/75">
                <span className="inline-flex items-center gap-1 truncate">{place && <><MapPinIcon className="h-3.5 w-3.5" /> {place}</>}</span>
                <ArrowRightIcon className="h-5 w-5 shrink-0 transition group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
