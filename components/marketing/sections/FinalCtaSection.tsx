import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import Container from "../ui/Container";
import { Reveal } from "../ui/Reveal";
import { MarketingButton } from "../ui/MarketingButton";

const PERKS = [
  "Free for one building",
  "No credit card",
  "20-minute setup",
  "Cancel anytime",
];

export default function FinalCtaSection() {
  return (
    <section
      data-screen-label="Final CTA"
      className="final-cta-bg relative overflow-hidden py-20 md:py-28"
    >
      <Container className="relative z-10">
        <Reveal>
          <div className="mx-auto max-w-[760px] text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/20 bg-white/80 px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-brand-700 shadow-sm backdrop-blur">
              <Sparkles className="h-3 w-3 fill-brand-500 text-brand-500" strokeWidth={0} />
              Ready when you are
            </span>
            <h2 className="mx-auto mt-4 mb-5 max-w-[640px] text-[36px] font-semibold leading-[1.05] tracking-[-0.025em] text-balance md:text-[54px]">
              Stop juggling spreadsheets.
              <br />
              Start running your buildings.
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

            <ul className="mx-auto mt-8 flex max-w-[640px] flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13.5px] text-gray-600">
              {PERKS.map((p) => (
                <li key={p} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-success-600" strokeWidth={2} />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
