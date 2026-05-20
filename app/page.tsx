import MarketingNavbar from "@/components/marketing/MarketingNavbar";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import HeroSection from "@/components/marketing/sections/HeroSection";
import TrustBarSection from "@/components/marketing/sections/TrustBarSection";
import ProblemSection from "@/components/marketing/sections/ProblemSection";
import SolutionSection from "@/components/marketing/sections/SolutionSection";
import FeatureReservations from "@/components/marketing/sections/FeatureReservations";
import FeatureFinance from "@/components/marketing/sections/FeatureFinance";
import FeatureReports from "@/components/marketing/sections/FeatureReports";
import FeatureExpenses from "@/components/marketing/sections/FeatureExpenses";
import BuiltForOmanSection from "@/components/marketing/sections/BuiltForOmanSection";
import HowItWorksSection from "@/components/marketing/sections/HowItWorksSection";
import TestimonialsSection from "@/components/marketing/sections/TestimonialsSection";
import PricingSection from "@/components/marketing/sections/PricingSection";
import RtlPreviewSection from "@/components/marketing/sections/RtlPreviewSection";
import FaqSection from "@/components/marketing/sections/FaqSection";
import FinalCtaSection from "@/components/marketing/sections/FinalCtaSection";

export const metadata = {
  title: "Binaya PMS — Property management software, made in Salalah",
  description:
    "Binaya PMS helps property managers in Salalah handle reservations, payments, and operations across multiple buildings — in one place. Free for one building.",
};

export default function MarketingHomePage() {
  return (
    <>
      <MarketingNavbar />
      <main id="top">
        <HeroSection />
        <TrustBarSection />
        <ProblemSection />
        <SolutionSection />
        <FeatureReservations />
        <FeatureFinance />
        <FeatureReports />
        <FeatureExpenses />
        <BuiltForOmanSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <PricingSection />
        <RtlPreviewSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <MarketingFooter />
    </>
  );
}
