import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { MapPinIcon, CheckIcon } from "@heroicons/react/24/outline";
import { getCachedSite, resolveLang } from "@/lib/public-site/render";
import { getDict } from "@/lib/public-site/i18n";
import { getBuilding, getUnits } from "@/lib/public-site/data";
import { formatMoney } from "@/lib/public-site/format";
import UnitCard from "../../_components/UnitCard";
import SearchBar from "../../_components/SearchBar";

export const revalidate = 120;

type Params = { slug: string; buildingId: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug, buildingId } = await params;
  const site = await getCachedSite(slug);
  if (!site) return {};
  const b = await getBuilding(site.organizationId, buildingId);
  return { title: b?.name ?? "" };
}

export default async function BuildingDetail({ params }: { params: Promise<Params> }) {
  const { slug, buildingId } = await params;
  const site = await getCachedSite(slug);
  if (!site) notFound();
  const lang = await resolveLang(site);
  const dict = getDict(lang);

  const building = await getBuilding(site.organizationId, buildingId);
  if (!building) notFound();
  const units = await getUnits(site.organizationId, buildingId);

  const desc = (lang === "ar" ? building.descriptionAr : building.descriptionEn) || "";
  const place = [building.city, building.governorate].filter(Boolean).join("، ");
  const photos = building.photos.slice(0, 5);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Gallery */}
      {photos.length > 0 ? (
        <div className="grid gap-2 overflow-hidden rounded-2xl sm:grid-cols-4 sm:grid-rows-2" style={{ minHeight: 280 }}>
          {photos.map((src, i) => (
            <div key={i} className={`relative ${i === 0 ? "sm:col-span-2 sm:row-span-2" : ""} aspect-[4/3] sm:aspect-auto`}>
              <Image src={src} alt={building.name} fill sizes="(max-width:640px) 100vw, 50vw" className="object-cover" />
            </div>
          ))}
        </div>
      ) : (
        <div className="h-52 w-full rounded-2xl" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--site-primary) 16%, #fff), color-mix(in srgb, var(--site-accent) 22%, #fff))" }} />
      )}

      <div className="mt-6">
        <h1 className="text-3xl font-bold text-slate-900">{building.name}</h1>
        {place && <p className="mt-1 inline-flex items-center gap-1 text-slate-500"><MapPinIcon className="h-4 w-4" /> {place}</p>}
        {desc && <p className="mt-4 max-w-3xl whitespace-pre-line leading-relaxed text-slate-600">{desc}</p>}

        {building.amenities.length > 0 && (
          <div className="mt-5">
            <h2 className="text-sm font-semibold text-slate-700">{dict.common.amenities}</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {building.amenities.map((a) => (
                <li key={a} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                  <CheckIcon className="h-4 w-4" style={{ color: "var(--site-primary)" }} /> {a}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Availability search scoped to this building */}
      <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
        <SearchBar buildingId={building.id} />
      </div>

      {/* Units */}
      <section className="mt-10">
        <h2 className="mb-5 text-2xl font-bold text-slate-900">{dict.building.unitsHere}</h2>
        {units.length === 0 ? (
          <p className="text-slate-500">{dict.building.noUnits}</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {units.map((u) => (
              <UnitCard
                key={u.id}
                unit={u}
                href={`/units/${u.id}`}
                cta={dict.common.viewDetails}
                priceMain={site.showPrices ? formatMoney(u.basePrice, site.currency, lang) : null}
                priceSub={site.showPrices ? `${dict.common.from} · ${dict.common.perNight}` : null}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
