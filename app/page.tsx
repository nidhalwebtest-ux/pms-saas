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
import RtlPreviewSection from "@/components/marketing/sections/RtlPreviewSection";
import FaqSection from "@/components/marketing/sections/FaqSection";
import FinalCtaSection from "@/components/marketing/sections/FinalCtaSection";

export const metadata = {
  title: "Binaya PMS — Property management software, made in Salalah",
  description:
    "Binaya PMS helps property managers in Salalah handle reservations, payments, and operations across multiple buildings — in one place.",
};

export default function MarketingHomePage() {
  return (
    // `overflow-x-hidden` is a defensive guard so a stray transform / negative
    // inset / 3D-rotated card on a section can never force horizontal scroll
    // on the whole page. Mirrors the same guard the dashboard layout uses.
    <div className="overflow-x-hidden">
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
        <RtlPreviewSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <MarketingFooter />
    </div>
  );
}

