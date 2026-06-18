import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic, IBM_Plex_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "@/styles/globals.css";
import { Toaster } from "sonner";
import { dirFor, type Locale } from "@/i18n/config";
import { ConfirmDialogProvider } from "@/components/ui";

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
  title: "Binaya — Property Management for Oman",
  description:
    "Manage properties, tenants, reservations, and payments in one modern platform. Built for property managers in Oman.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#185FA5",
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
          <ConfirmDialogProvider>
            {children}
          </ConfirmDialogProvider>
          <Toaster position="top-center" richColors dir={dir} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
