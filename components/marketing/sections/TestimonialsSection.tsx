import { ArrowRight } from "lucide-react";
import Container, { SectionHead } from "../ui/Container";
import { Reveal } from "../ui/Reveal";
import { ButtonLink } from "../ui/MarketingButton";

const TESTIMONIALS = [
  {
    quote:
      "We tracked Khareef bookings on spreadsheets for five years. Binaya replaced everything in a week, and we are already seeing fewer lost bookings during the rush.",
    initials: "AB",
    name: "Ahmed Al Balushi",
    meta: "Owner · Salalah Plaza · 22 units",
    avatarCls: "bg-brand-100 text-brand-700",
  },
  {
    quote:
      "Finally a system that understands how Omani property managers actually work. The Khareef pricing alone saves me hours every season — and probably catches OMR 800 in revenue I used to lose.",
    initials: "RA",
    name: "Reem Al-Hinai",
    meta: "Manager · Mirbat Resort · 18 units",
    avatarCls: "bg-[oklch(0.92_0.05_175)] text-khareef-700",
  },
  {
    quote:
      "My receptionists love it. My accountant loves it. I can approve expenses from the car. It just works — and it speaks Arabic, which my team appreciates.",
    initials: "SK",
    name: "Salim Al-Khalili",
    meta: "Owner · Haffa Residences · 12 units",
    avatarCls: "bg-[oklch(0.95_0.04_80)] text-warning-700",
  },
];

export default function TestimonialsSection() {
  return (
    <section data-screen-label="Testimonials" className="bg-gray-50 py-16 md:py-24">
      <Container>
        <SectionHead
          eyebrow="Customer stories"
          title="What property managers are saying."
          description="Real feedback from operators across Salalah, Mirbat, and Al Haffa — the people Binaya was built with, not just for."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 100}>
              <article className="flex h-full flex-col gap-5 rounded-lg border border-gray-200 bg-white p-7 transition-all duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg">
              <p className="m-0 flex-1 text-base leading-[1.55] text-gray-800 text-pretty">
                <span className="mb-1 block font-serif text-[40px] leading-none text-brand-300 rtl:rtl-mirror">
                  &ldquo;
                </span>
                {t.quote}
              </p>
              <div className="flex items-center gap-3 border-t border-gray-200 pt-4">
                <div className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-full text-sm font-semibold ${t.avatarCls}`}>
                  {t.initials}
                </div>
                <div>
                  <strong className="block text-sm font-semibold text-gray-900">{t.name}</strong>
                  <span className="font-mono text-[12.5px] text-gray-500">{t.meta}</span>
                </div>
              </div>
              </article>
            </Reveal>
          ))}
        </div>
        <div className="mt-10 text-center">
          <ButtonLink href="#case-studies">
            Read full case studies
            <ArrowRight className="h-3 w-3 rtl:rotate-180" strokeWidth={2} />
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
