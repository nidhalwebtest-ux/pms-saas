import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { headers } from "next/headers";
// Self-hosted fonts (public/fonts) + the --font-* variables. Replaces next/font/google,
// whose build-time downloads intermittently failed Turbopack builds (prod deploy 2026-11-19).
// Regenerate with: node scripts/fonts/sync-google-fonts.mjs
import "@/styles/fonts.css";
import "@/styles/globals.css";
import { Toaster } from "sonner";
import { dirFor, type Locale } from "@/i18n/config";
// direct import: the "@/components/ui" barrel would ship the whole dashboard UI kit to every page
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { MetaPixel } from "@/components/analytics/MetaPixel";
import { extractSiteSlug } from "@/lib/public-site/subdomain";

export const metadata: Metadata = {
  title: "Binaya — Hotel & Furnished Apartment Management",
  description:
    "Manage hotels, furnished apartments, guest reservations, and payments in one modern platform. Built for hospitality operators in Oman and the Gulf.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
};

/**
 * Message namespaces the root layout sends to the browser. Everything public
 * (landing, login, contact, privacy, terms, verify-email) only needs these.
 * App areas (dashboard, admin, onboarding, invite) re-provide the FULL
 * dictionary via a nested provider (components/FullMessagesProvider.tsx), so a
 * soft navigation into them still has every string. Shipping all 31 namespaces
 * here cost ~260 KB (EN) / ~330 KB (AR) of HTML on every public page load.
 * Server components are unaffected — getTranslations() reads the full set.
 */
const PUBLIC_MESSAGE_NAMESPACES = ["common", "marketing", "auth", "phoneInput", "subscription"] as const;

function pickMessages(all: Record<string, unknown>, keys: readonly string[]) {
  return Object.fromEntries(keys.filter((k) => k in all).map((k) => [k, all[k]]));
}

export const viewport: Viewport = {
  themeColor: "#185FA5",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await getLocale()) as Locale;
  const dir = dirFor(locale);
  // Tenant booking sites ({slug}.binaya.app) belong to customers — keep Binaya's
  // analytics (GA + Meta pixel) off them, and send no app messages: the public
  // site has its own self-contained dictionary (lib/public-site/i18n.ts).
  const isTenantSite = Boolean(extractSiteSlug((await headers()).get("host")));
  const messages = isTenantSite
    ? {}
    : pickMessages(await getMessages(), PUBLIC_MESSAGE_NAMESPACES);

  return (
    <html lang={locale} dir={dir}>
      <head>
        {/* Google Analytics (gtag.js) — Binaya's own pages only */}
        {!isTenantSite && <>
        <Script
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-MK5E9PV4X7"
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-MK5E9PV4X7');
            `,
          }}
        />
        </>}
      </head>
      <body className={`antialiased ${locale === "ar" ? "font-arabic" : ""}`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ConfirmDialogProvider>
            {children}
          </ConfirmDialogProvider>
          <Toaster position="top-center" richColors dir={dir} />
        </NextIntlClientProvider>
        {!isTenantSite && <MetaPixel />}
      </body>
    </html>
  );
}
