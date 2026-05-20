import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import Container from "../ui/Container";
import { ButtonLink } from "../ui/MarketingButton";

type FeatureBlockProps = {
  id: string;
  screenLabel: string;
  flip?: boolean;
  tinted?: boolean;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  linkLabel: string;
  linkHref: string;
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
  linkLabel,
  linkHref,
  visual,
}: FeatureBlockProps) {
  return (
    <section
      id={id}
      data-screen-label={screenLabel}
      className={[
        "py-12 md:py-16",
        tinted ? "border-y border-gray-200 bg-gray-50" : "",
      ].join(" ")}
    >
      <Container>
        <div
          className={[
            "grid items-center gap-10 py-10 md:gap-20 md:py-16",
            flip
              ? "md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
              : "md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]",
          ].join(" ")}
        >
          <div className={flip ? "md:order-2" : ""}>
            <span className="font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-brand-600">
              {eyebrow}
            </span>
            <h2 className="mt-3 mb-4 text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-balance md:text-[38px]">
              {title}
            </h2>
            <p className="mb-6 text-[17px] leading-[1.55] text-gray-600 text-pretty">
              {description}
            </p>
            <ul className="m-0 mb-7 grid list-none gap-2.5 p-0">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-[15px] text-gray-700">
                  <span className="mt-px grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-brand-50 text-[12px] text-brand-600">
                    ✓
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <ButtonLink href={linkHref}>
              {linkLabel}
              <ArrowRight className="h-3 w-3 rtl:rotate-180" strokeWidth={2} />
            </ButtonLink>
          </div>
          <div className={flip ? "md:order-1" : ""}>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
              {visual}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
