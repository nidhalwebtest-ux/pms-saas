import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteBySlug } from "@/lib/public-site/data";

/**
 * Public-site shell. Resolves the tenant by slug (rewritten here from
 * {slug}.binaya.app), renders a branded 404 for unknown/unpublished sites, and
 * applies the org's brand colours + reading direction as CSS variables.
 *
 * NOTE: <html>/<body> come from the root app/layout.tsx; this only wraps content.
 */

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) return { title: "Site not found" };

  const ar = site.defaultLanguage === "ar";
  const name = (ar ? site.siteNameAr : site.siteNameEn) || site.siteNameEn || site.siteNameAr || site.orgName;
  const desc = (ar ? site.metaDescriptionAr : site.metaDescriptionEn) || (ar ? site.taglineAr : site.taglineEn) || undefined;

  return {
    title: name,
    description: desc,
    openGraph: {
      title: name ?? undefined,
      description: desc,
      images: site.ogImageUrl ? [site.ogImageUrl] : undefined,
      type: "website",
    },
    robots: { index: true, follow: true },
  };
}

export default async function PublicSiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) notFound();

  const dir = site.defaultLanguage === "ar" ? "rtl" : "ltr";

  return (
    <div
      dir={dir}
      data-site={site.slug}
      style={
        {
          "--site-primary": site.primaryColor,
          "--site-accent": site.accentColor,
        } as React.CSSProperties
      }
      className="min-h-screen bg-white text-slate-900"
    >
      {children}
    </div>
  );
}
