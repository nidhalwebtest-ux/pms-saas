import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "../../_components/Img";
import { CheckIcon, UserGroupIcon, HomeIcon } from "@heroicons/react/24/outline";
import { getSiteView } from "@/lib/public-site/render";
import { fill } from "@/lib/public-site/i18n";
import { withBase } from "@/lib/public-site/lang";
import { getUnit } from "@/lib/public-site/data";
import UnitQuote from "./UnitQuote";

type Params = { slug: string; lang: string; unitId: string };

export function generateStaticParams(): Params[] {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug, lang, unitId } = await params;
  const v = await getSiteView(slug, lang);
  if (!v) return {};
  const u = await getUnit(v.site.organizationId, unitId);
  return { title: u?.name ?? "" };
}

/** Pre-rendered + cached. The live quote for the visitor's dates loads in <UnitQuote>. */
export default async function UnitDetail({ params }: { params: Promise<Params> }) {
  const { slug, lang: langParam, unitId } = await params;
  const v = await getSiteView(slug, langParam);
  if (!v) notFound();
  const { site, lang, dict, base } = v;

  const unit = await getUnit(site.organizationId, unitId);
  if (!unit) notFound();

  const desc = (lang === "ar" ? unit.descriptionAr : unit.descriptionEn) || "";
  const amenities = lang === "ar" && unit.amenitiesAr.length ? unit.amenitiesAr : unit.amenities;
  const photos = unit.photos.slice(0, 5);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Gallery */}
      {photos.length > 0 ? (
        <div className="grid gap-2 overflow-hidden rounded-2xl sm:grid-cols-4 sm:grid-rows-2" style={{ minHeight: 260 }}>
          {photos.map((src, i) => (
            <div key={i} className={`relative ${i === 0 ? "sm:col-span-2 sm:row-span-2" : ""} aspect-[4/3] sm:aspect-auto`}>
              <Image src={src} alt={unit.name} fill sizes="(max-width:640px) 100vw, 50vw" className="object-cover" />
            </div>
          ))}
        </div>
      ) : (
        <div className="h-52 w-full rounded-2xl" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--site-primary) 16%, #fff), color-mix(in srgb, var(--site-accent) 22%, #fff))" }} />
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Left: details */}
        <div>
          <Link href={withBase(base, `/buildings/${unit.buildingId}`)} className="text-sm font-medium hover:underline" style={{ color: "var(--site-primary)" }}>
            {fill(dict.unit.inBuilding, { name: unit.buildingName })}
          </Link>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900 font-[family-name:var(--font-display)] sm:text-4xl">{unit.name}</h1>

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5"><HomeIcon className="h-5 w-5 text-slate-400" /> {unit.bedrooms} {dict.common.bedrooms} · {unit.bathrooms} {dict.common.bathrooms}</span>
            {unit.maxGuests && <span className="inline-flex items-center gap-1.5"><UserGroupIcon className="h-5 w-5 text-slate-400" /> {dict.common.sleeps} {unit.maxGuests}</span>}
            {unit.area && <span>{unit.area} m²</span>}
          </div>

          {desc && <p className="mt-5 max-w-2xl whitespace-pre-line leading-relaxed text-slate-600">{desc}</p>}

          {amenities.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-slate-700">{dict.common.amenities}</h2>
              <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {amenities.map((a) => (
                  <li key={a} className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                    <CheckIcon className="h-4 w-4" style={{ color: "var(--site-primary)" }} /> {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right: pricing / booking */}
        <aside className="lg:sticky lg:top-24 h-fit rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">{dict.unit.pricing}</h2>
          <UnitQuote unitId={unit.id} buildingId={unit.buildingId} basePrice={unit.basePrice} />
        </aside>
      </div>
    </main>
  );
}
