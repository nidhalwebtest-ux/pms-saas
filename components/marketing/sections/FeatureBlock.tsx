import type { ReactNode } from "react";
import { Check } from "lucide-react";
import Container from "../ui/Container";
import { Reveal } from "../ui/Reveal";

type FeatureBlockProps = {
  id: string;
  screenLabel: string;
  flip?: boolean;
  tinted?: boolean;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  visual: ReactNode;
};

export default function FeatureBlock({
  id,
  screenLabel,
  flip = false,
  tinted = false,
  eyebrow,
  title,
  description,
  bullets,
  visual,
}: FeatureBlockProps) {
  return (
    <section
      id={id}
      data-screen-label={screenLabel}
      className={["py-10 md:py-14", tinted ? "border-y border-gray-200 bg-gray-50" : "bg-white"].join(" ")}
    >
      <Container>
        <div
          className={[
            "grid items-center gap-10 py-6 md:gap-16 md:py-10",
            flip
              ? "md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
              : "md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]",
          ].join(" ")}
        >
          <Reveal from={flip ? "right" : "left"} className={flip ? "md:order-2" : ""}>
            <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-500">
              {eyebrow}
            </span>
            <h2 className="mt-3 mb-4 text-[26px] font-bold leading-[1.15] tracking-[-0.02em] text-balance text-gray-900 md:text-[38px]">
              {title}
            </h2>
            <p className="mb-6 text-[15px] leading-[1.6] text-gray-600 text-pretty md:text-[18px]">
              {description}
            </p>
            <ul className="m-0 grid list-none gap-3 p-0">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-[11px] text-[15.5px] leading-[1.5] text-gray-900">
                  <span className="mt-px grid h-[22px] w-[22px] flex-none place-items-center rounded-[7px] bg-brand-50 text-brand-500">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal from={flip ? "left" : "right"} delay={120} className={flip ? "md:order-1" : ""}>
            <div className="overflow-hidden rounded-[18px] border border-gray-200 bg-white shadow-[0_24px_50px_-26px_rgba(15,39,64,.28)] transition-transform duration-300 hover:-translate-y-1">
              {visual}
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
