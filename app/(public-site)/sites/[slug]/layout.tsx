import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCachedSite, resolveLang, dirFor } from "@/lib/public-site/render";
import { getDict } from "@/lib/public-site/i18n";
import { SiteProvider, type SiteContext } from "@/lib/public-site/context";
import SiteHeader from "./_components/SiteHeader";
import SiteFooter from "./_components/SiteFooter";
import WhatsAppFab from "./_components/WhatsAppFab";

const ROOT_DOMAIN = "binaya.app";
type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await getCachedSite(slug);
  if (!site) return { title: "Site not found" };
  const lang = await resolveLang(site);
  const ar = lang === "ar";
  const name = (ar ? site.siteNameAr : site.siteNameEn) || site.siteNameEn || site.siteNameAr || site.orgName;
  const desc = (ar ? site.metaDescriptionAr : site.metaDescriptionEn) || (ar ? site.taglineAr : site.taglineEn) || undefined;
  return {
    title: { default: name ?? site.orgName, template: `%s · ${name ?? site.orgName}` },
    description: desc,
    metadataBase: new URL(`https://${slug}.${ROOT_DOMAIN}`),
    openGraph: { title: name ?? undefined, description: desc, images: site.ogImageUrl ? [site.ogImageUrl] : undefined, type: "website" },
    robots: { index: true, follow: true },
  };
}

export default async function PublicSiteLayout({ children, params }: { children: React.ReactNode; params: Promise<Params> }) {
  const { slug } = await params;
  const site = await getCachedSite(slug);
  if (!site) notFound();

  const lang = await resolveLang(site);
  const dir = dirFor(lang);
  const dict = getDict(lang);
  const siteName = (lang === "ar" ? site.siteNameAr : site.siteNameEn) || site.orgName;
  const address = lang === "ar" ? site.addressAr : site.addressEn;

  const ctx: SiteContext = {
    slug, lang, dir, dict, rootDomain: ROOT_DOMAIN,
    templateKey: site.templateKey,
    primaryColor: site.primaryColor, accentColor: site.accentColor,
    currency: site.currency, showPrices: site.showPrices,
    siteName, whatsapp: site.whatsappNumber,
  };

  return (
    <div
      dir={dir}
      data-template={site.templateKey}
      style={{ "--site-primary": site.primaryColor, "--site-accent": site.accentColor } as React.CSSProperties}
      className="flex min-h-screen flex-col bg-white text-slate-900 antialiased"
    >
      <SiteProvider value={ctx}>
        <SiteHeader logoUrl={site.logoUrl ?? site.orgLogo} />
        <div className="flex-1">{children}</div>
        <SiteFooter
          phone={site.phone} email={site.email} address={address}
          instagram={site.instagramUrl} mapsUrl={site.googleMapsUrl}
        />
        <WhatsAppFab />
      </SiteProvider>
    </div>
  );
}
