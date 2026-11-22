import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteView } from "@/lib/public-site/render";
import { fill } from "@/lib/public-site/i18n";
import { pageMetadata } from "@/lib/public-site/seo";
import { getBuildings } from "@/lib/public-site/data";
import BuildingList from "../_components/BuildingList";

type Params = { slug: string; lang: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug, lang } = await params;
  const v = await getSiteView(slug, lang);
  return v ? pageMetadata(v, { title: v.dict.nav.buildings, path: "/buildings" }) : {};
}

export default async function BuildingsList({ params }: { params: Promise<Params> }) {
  const { slug, lang } = await params;
  const v = await getSiteView(slug, lang);
  if (!v) notFound();
  const { dict, theme } = v;
  const buildings = await getBuildings(v.site.organizationId);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className={theme.key === "template_2" ? "mb-12 text-center" : ""}>
        <h1 className={`font-[family-name:var(--font-display)] ${theme.pageTitle}`}>{dict.nav.buildings}</h1>
        <p className="mt-1 text-slate-500">{fill(dict.sections.stayCount, { count: buildings.reduce((n, b) => n + b.unitCount, 0) })}</p>
      </div>

      {buildings.length === 0 ? (
        <p className="mt-8 text-slate-500">{dict.building.noUnits}</p>
      ) : (
        <div className="mt-8">
          <BuildingList v={v} buildings={buildings} />
        </div>
      )}
    </main>
  );
}
