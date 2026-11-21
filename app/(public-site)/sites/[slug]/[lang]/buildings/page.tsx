import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteView } from "@/lib/public-site/render";
import { getBuildings } from "@/lib/public-site/data";
import BuildingCard from "../_components/BuildingCard";

type Params = { slug: string; lang: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug, lang } = await params;
  const v = await getSiteView(slug, lang);
  return v ? { title: v.dict.nav.buildings } : {};
}

export default async function BuildingsList({ params }: { params: Promise<Params> }) {
  const { slug, lang } = await params;
  const v = await getSiteView(slug, lang);
  if (!v) notFound();
  const { dict } = v;
  const buildings = await getBuildings(v.site.organizationId);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold text-slate-900 font-[family-name:var(--font-display)] sm:text-4xl">{dict.nav.buildings}</h1>
      <p className="mt-1 text-slate-500">{buildings.length} {dict.common.allStays.toLowerCase()}</p>

      {buildings.length === 0 ? (
        <p className="mt-8 text-slate-500">{dict.building.noUnits}</p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {buildings.map((b) => <BuildingCard key={b.id} v={v} building={b} />)}
        </div>
      )}
    </main>
  );
}
