import { ArrowRight } from "lucide-react";
import Container from "../ui/Container";
import { MarketingButton } from "../ui/MarketingButton";

/* ============================================================================
 *  Final CTA — placeholder body. Uses the .final-cta-bg gradient ornament
 *  from globals.css. TODO: replace copy + visuals with the design hand-off.
 * ========================================================================= */
export default function FinalCtaSection() {
  return (
    <section
      data-screen-label="Final CTA"
      className="final-cta-bg relative overflow-hidden py-20 md:py-28"
    >
      <Container className="relative z-10 text-center">
        <span className="inline-block font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-brand-600">
          Ready when you are
        </span>
        <h2 className="mx-auto mt-3 mb-5 max-w-[640px] text-[36px] font-semibold leading-[1.05] tracking-[-0.025em] text-balance md:text-[52px]">
          Stop juggling spreadsheets. Start running your buildings.
        </h2>
        <p className="mx-auto mb-9 max-w-[560px] text-lg text-gray-600 text-pretty">
          Free for one building, forever. Set up in 20 minutes. No credit card,
          no sales call — just a working dashboard by lunch.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <MarketingButton href="#trial" variant="primary" size="xl">
            Start free trial
            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" strokeWidth={1.75} />
          </MarketingButton>
          <MarketingButton href="#demo" variant="secondary" size="xl">
            Talk to the team
          </MarketingButton>
        </div>
      </Container>
    </section>
  );
}
