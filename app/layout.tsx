import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic, IBM_Plex_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "@/styles/globals.css";
import { Toaster } from "sonner";
import { dirFor, type Locale } from "@/i18n/config";

const sans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
  variable: "--font-arabic",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OmRent — Property Management for Oman",
  description:
    "Manage properties, tenants, reservations, and payments in one modern platform. Built for property managers in Oman.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();
  const dir = dirFor(locale);

  return (
    <html lang={locale} dir={dir} className={`${sans.variable} ${arabic.variable} ${mono.variable}`}>
      <body className={`antialiased ${locale === "ar" ? "font-arabic" : ""}`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <Toaster position="top-center" richColors dir={dir} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
