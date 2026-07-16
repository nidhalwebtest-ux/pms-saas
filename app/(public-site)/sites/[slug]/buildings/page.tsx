import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCachedSite, resolveLang } from "@/lib/public-site/render";
import { getDict } from "@/lib/public-site/i18n";
import { getBuildings } from "@/lib/public-site/data";
import BuildingCard from "../_components/BuildingCard";

export const revalidate = 120;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await getCachedSite(slug);
  const lang = site ? await resolveLang(site) : "en";
  return { title: getDict(lang).nav.buildings };
}

export default async function BuildingsList({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getCachedSite(slug);
  if (!site) notFound();
  const lang = await resolveLang(site);
  const dict = getDict(lang);
  const buildings = await getBuildings(site.organizationId);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900">{dict.nav.buildings}</h1>
      <p className="mt-1 text-slate-500">{buildings.length} {dict.common.allStays.toLowerCase()}</p>

      {buildings.length === 0 ? (
        <p className="mt-8 text-slate-500">{dict.building.noUnits}</p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {buildings.map((b) => <BuildingCard key={b.id} building={b} />)}
        </div>
      )}
    </main>
  );
}
