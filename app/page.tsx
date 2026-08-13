import type { Metadata } from "next";
import MarketingNavbar from "@/components/marketing/MarketingNavbar";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import HeroSection from "@/components/marketing/sections/HeroSection";
import ProblemSection from "@/components/marketing/sections/ProblemSection";
import SolutionSection from "@/components/marketing/sections/SolutionSection";
import FeatureReservations from "@/components/marketing/sections/FeatureReservations";
import FeatureReports from "@/components/marketing/sections/FeatureReports";
import FeatureExpenses from "@/components/marketing/sections/FeatureExpenses";
import ImpactSection from "@/components/marketing/sections/ImpactSection";
import HowItWorksSection from "@/components/marketing/sections/HowItWorksSection";
import PricingSection from "@/components/marketing/sections/PricingSection";
import ContactSection from "@/components/marketing/sections/ContactSection";
import RtlPreviewSection from "@/components/marketing/sections/RtlPreviewSection";
import FaqSection from "@/components/marketing/sections/FaqSection";
import FinalCtaSection from "@/components/marketing/sections/FinalCtaSection";
import FloatingWhatsApp from "@/components/marketing/FloatingWhatsApp";

export const metadata: Metadata = {
  title: "نظام بناية لإدارة العقارات | Binaya PMS — Property Management Software in Salalah, Oman",
  description:
    "برنامج بناية لإدارة المباني والعقارات في صلالة وسلطنة عُمان. نظام متكامل لإدارة الحجوزات، المستأجرين، الفواتير، المصروفات والتقارير المالية بالريال العُماني. | Leading property management software for buildings, reservations, invoicing, and expenses in Salalah & Oman.",
  keywords: [
    "برنامج إدارة العقارات صلالة",
    "إدارة المباني عمان",
    "نظام إدارة الأملاك صلالة",
    "برنامج شقق مفروشة صلالة",
    "Binaya PMS",
    "Salalah Property Management Software",
    "Oman PMS",
    "Property Management Software Salalah",
    "فواتير العقارات عمان",
    "إدارة الحجوزات عمان",
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
    title: "نظام بناية لإدارة العقارات | Binaya PMS — Property Management Software in Salalah, Oman",
    description:
      "برنامج بناية لإدارة المباني والعقارات في صلالة وعُمان. الحجوزات، الفواتير، المصروفات، والتقارير في مكان واحد.",
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
    title: "نظام بناية لإدارة العقارات | Binaya PMS",
    description: "أدِر مبانيك باحترافية في صلالة وعُمان — نظام الحجوزات والمدفوعات والمصروفات بالريال العُماني.",
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

export default function MarketingHomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Binaya PMS",
    operatingSystem: "Web-based Platform",
    applicationCategory: "BusinessApplication",
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "OMR",
      lowPrice: "10.000",
      highPrice: "75.000",
      offerCount: "3",
    },
    description:
      "Binaya PMS is the premier property management platform in Salalah, Oman designed for real estate managers to handle reservations, units, invoicing, and expenses.",
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
    <div className="overflow-x-hidden">
      {/* Structured Data (JSON-LD) for Search Engine Rich Snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <MarketingNavbar />
      <main id="top">
        <HeroSection />
        <ProblemSection />
        <SolutionSection />
        <FeatureReservations />
        <FeatureReports />
        <FeatureExpenses />
        <ImpactSection />
        <HowItWorksSection />
        <PricingSection />
        <ContactSection />
        <RtlPreviewSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <MarketingFooter />
      <FloatingWhatsApp />
    </div>
  );
}
