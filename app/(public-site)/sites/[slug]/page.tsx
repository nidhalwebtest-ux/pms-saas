import { notFound } from "next/navigation";
import { getSiteBySlug, getBuildings } from "@/lib/public-site/data";

/**
 * Phase-2 placeholder home — proves subdomain resolution, the data layer, and
 * brand theming end-to-end. Phase 4 replaces this with the real Template 1
 * (Coastal) home page. Kept intentionally minimal.
 */

export const revalidate = 60; // ISR; tag-based revalidation added with the wizard

export default async function SiteHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) notFound();

  const ar = site.defaultLanguage === "ar";
  const name = (ar ? site.siteNameAr : site.siteNameEn) || site.orgName;
  const tagline = ar ? site.taglineAr : site.taglineEn;
  const buildings = await getBuildings(site.organizationId);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <header className="border-b pb-8" style={{ borderColor: "color-mix(in srgb, var(--site-primary) 20%, transparent)" }}>
        <div className="flex items-center gap-4">
          {site.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={site.logoUrl} alt={name} className="h-12 w-12 rounded-lg object-contain" />
          ) : (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-lg text-lg font-bold text-white"
              style={{ background: "var(--site-primary)" }}
            >
              {name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--site-primary)" }}>{name}</h1>
            {tagline && <p className="text-slate-500">{tagline}</p>}
          </div>
        </div>
      </header>

      <section className="mt-8">
        <div className="mb-4 flex items-center gap-2">
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white"
            style={{ background: "var(--site-accent)" }}
          >
            {ar ? "المباني" : "Buildings"} · {buildings.length}
          </span>
          <span className="text-xs text-slate-400">Phase 2 preview — template UI arrives in Phase 4</span>
        </div>

        {buildings.length === 0 ? (
          <p className="text-slate-500">{ar ? "لا توجد مبانٍ متاحة بعد." : "No buildings published yet."}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {buildings.map((b) => (
              <li key={b.id} className="rounded-xl border p-4 transition hover:shadow-md">
                <div className="text-sm font-semibold text-slate-900">{b.name}</div>
                <div className="text-xs text-slate-500">{[b.city, b.governorate].filter(Boolean).join(", ")}</div>
                <div className="mt-2 text-xs" style={{ color: "var(--site-primary)" }}>
                  {b.unitCount} {ar ? "وحدة" : "units"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
