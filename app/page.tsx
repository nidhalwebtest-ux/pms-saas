import type { Metadata } from "next";
import MarketingNavbar from "@/components/marketing/MarketingNavbar";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import HeroSection from "@/components/marketing/sections/HeroSection";
import PainSection from "@/components/marketing/v2/sections/PainSection";
import SolutionSection from "@/components/marketing/v2/sections/SolutionSection";
import StripSection from "@/components/marketing/v2/sections/StripSection";
import PlansSection from "@/components/marketing/v2/sections/PlansSection";
import FaqSection from "@/components/marketing/sections/FaqSection";
import { EndCard } from "@/components/marketing/v2/sections/EndCard";
import FloatingWhatsApp from "@/components/marketing/FloatingWhatsApp";
import { landingFontClass } from "@/components/marketing/v2/fonts";
import { getTranslations } from "next-intl/server";
import { getPublicPlans } from "@/lib/subscription";
import { formatOmr } from "@/lib/subscription-core";

export const metadata: Metadata = {
  title: "نظام بناية لإدارة الفنادق والشقق المفروشة | Binaya PMS — Hotel & Furnished Apartment Management Software",
  description:
    "برنامج بناية لإدارة الفنادق والشقق المفروشة في عُمان ودول الخليج. نظام متكامل لإدارة الحجوزات، النزلاء، الفواتير، المصروفات والتقارير المالية بالريال العُماني. | Leading hotel and furnished-apartment management software for reservations, guests, invoicing, and expenses across Oman & the Gulf.",
  keywords: [
    "برنامج إدارة الفنادق عمان",
    "نظام إدارة الشقق المفروشة",
    "برنامج حجوزات فنادق صلالة",
    "إدارة الشقق الفندقية عمان",
    "Binaya PMS",
    "Hotel Management Software Oman",
    "Furnished Apartment Management Software",
    "Short-Term Rental Management Software Gulf",
    "فواتير الفنادق عمان",
    "إدارة حجوزات النزلاء",
  ],
  authors: [{ name: "Binaya Software Team", url: "https://www.binaya.app" }],
  creator: "Binaya PMS",
  publisher: "Binaya PMS",
  metadataBase: new URL("https://www.binaya.app"),
  alternates: {
    canonical: "/",
    languages: {
      ar: "/",
      en: "/",
    },
  },
  openGraph: {
    title: "نظام بناية لإدارة الفنادق والشقق المفروشة | Binaya PMS — Hotel & Furnished Apartment Management Software",
    description:
      "برنامج بناية لإدارة الفنادق والشقق المفروشة في عُمان ودول الخليج. الحجوزات، الفواتير، المصروفات، والتقارير في مكان واحد.",
    url: "https://www.binaya.app",
    siteName: "Binaya PMS",
    images: [
      {
        url: "/brand/binaya-mark.svg",
        width: 800,
        height: 600,
        alt: "Binaya PMS Logo",
      },
    ],
    locale: "ar_OM",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "نظام بناية لإدارة الفنادق والشقق المفروشة | Binaya PMS",
    description: "أدِر فندقك أو شققك المفروشة باحترافية — نظام الحجوزات والمدفوعات والمصروفات بالريال العُماني.",
    images: ["/brand/binaya-mark.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default async function MarketingHomePage() {
  const tFaq = await getTranslations("marketing.faq");
  const faqItems = tFaq.raw("items") as { q: string; a: string }[];
  const { plans } = await getPublicPlans();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Binaya PMS",
    operatingSystem: "Web-based Platform",
    applicationCategory: "BusinessApplication",
    // matches the public plans shown in the pricing section (SubscriptionPlan table)
    offers: plans.map((p) => ({
      "@type": "Offer",
      name: p.nameEn,
      ...(p.free
        ? { price: "0", priceCurrency: "OMR" }
        : {
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: formatOmr(p.monthly),
              priceCurrency: "OMR",
              unitText: "MONTH",
            },
          }),
    })),
    description:
      "Binaya PMS is the premier hotel and furnished-apartment management platform in Oman designed for hospitality operators to handle reservations, guests, invoicing, and expenses.",
    publisher: {
      "@type": "Organization",
      name: "Binaya PMS",
      url: "https://www.binaya.app",
      telephone: "+96877804803",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Salalah",
        addressRegion: "Dhofar",
        addressCountry: "OM",
      },
    },
  };

  return (
    <div className={`overflow-x-clip ${landingFontClass}`}>
      {/* Structured Data (JSON-LD) for Search Engine Rich Snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqItems.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          }),
        }}
      />

      <MarketingNavbar />
      <main id="top">
        <HeroSection />
        <PainSection />
        <SolutionSection />
        <StripSection />
        <PlansSection />
        <FaqSection />
        <EndCard />
      </main>
      <MarketingFooter />
      <FloatingWhatsApp />
    </div>
  );
}
