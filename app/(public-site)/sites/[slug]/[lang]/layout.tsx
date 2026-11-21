import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "@/styles/public-site.css";
import { getSiteView } from "@/lib/public-site/render";
import { isLangParam } from "@/lib/public-site/lang";
import { SiteProvider, type SiteContext } from "@/lib/public-site/context";
import SiteHeader from "./_components/SiteHeader";
import SiteFooter from "./_components/SiteFooter";
import WhatsAppFab from "./_components/WhatsAppFab";

/**
 * ROOT layout of the public booking sites ({slug}.binaya.app). It is separate
 * from the app's root layout (app/(main)/layout.tsx) so visitors get none of the
 * dashboard's JS/CSS/messages, and it reads NO cookies or headers: the language
 * comes from the URL ([lang], see lib/public-site/lang.ts), so every page can be
 * pre-rendered and served from the CDN. Data is cached + tag-invalidated when
 * the operator edits the site (lib/public-site/data.ts).
 *
 * Display faces per template (--font-fraunces/-tajawal/-playfair/-amiri/-space/-cairo)
 * are self-hosted (styles/fonts.css); browsers only fetch the faces they render.
 */

const ROOT_DOMAIN = "binaya.app";
type Params = { slug: string; lang: string };

// Pages are built on first visit, then cached (ISR) — no build-time list.
export function generateStaticParams(): Params[] {
  return [];
}
export const revalidate = 300;

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug, lang: langParam } = await params;
  const v = isLangParam(langParam) ? await getSiteView(slug, langParam) : null;
  if (!v) return { title: "Site not found", robots: { index: false } };
  const { site, lang, siteName } = v;
  const ar = lang === "ar";
  const desc = (ar ? site.metaDescriptionAr : site.metaDescriptionEn) || (ar ? site.taglineAr : site.taglineEn) || undefined;
  return {
    title: { default: siteName, template: `%s · ${siteName}` },
    description: desc,
    metadataBase: new URL(`https://${slug}.${ROOT_DOMAIN}`),
    openGraph: { title: siteName, description: desc, images: site.ogImageUrl ? [site.ogImageUrl] : undefined, type: "website", locale: ar ? "ar_OM" : "en_OM" },
    robots: { index: true, follow: true },
  };
}

export default async function PublicSiteLayout({ children, params }: { children: React.ReactNode; params: Promise<Params> }) {
  const { slug, lang: langParam } = await params;
  if (!isLangParam(langParam)) notFound();
  const v = await getSiteView(slug, langParam);

  // Unknown / unpublished site: bare document; the page's notFound() renders
  // the branded not-found screen with a real 404 status.
  if (!v) {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  const { site, lang, dir, dict, theme, base, siteName } = v;
  const address = lang === "ar" ? site.addressAr : site.addressEn;

  // Only what the client islands (search bar, language switch, booking form, quote) need.
  const ctx: SiteContext = {
    slug, lang, dir, dict, base, theme,
    defaultLanguage: site.defaultLanguage,
    currency: site.currency, showPrices: site.showPrices,
    siteName, whatsapp: site.whatsappNumber,
  };

  return (
    <html lang={lang} dir={dir}>
      <body
        data-template={site.templateKey}
        style={{
          "--site-primary": site.primaryColor,
          "--site-accent": site.accentColor,
          "--font-display": theme.fontStack,
        } as React.CSSProperties}
        className={`flex min-h-screen flex-col ${theme.page} text-slate-900 antialiased`}
      >
        <SiteProvider value={ctx}>
          <SiteHeader v={v} logoUrl={site.logoUrl ?? site.orgLogo} />
          <div className="flex-1">{children}</div>
          <SiteFooter
            v={v}
            phone={site.phone} email={site.email} address={address}
            instagram={site.instagramUrl} mapsUrl={site.googleMapsUrl}
          />
          <WhatsAppFab whatsapp={site.whatsappNumber} />
        </SiteProvider>
      </body>
    </html>
  );
}
