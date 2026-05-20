import Container, { SectionHead } from "../ui/Container";
import { Reveal } from "../ui/Reveal";
import { CalendarMini, KhareefPricingMini, MultiDeviceMini } from "../mocks";

const SOLUTIONS = [
  {
    visual: <CalendarMini />,
    title: "See every unit at a glance",
    body: "Color-coded availability across all your buildings. Find any vacant night in seconds — even when the phone rings on a Friday afternoon.",
  },
  {
    visual: <KhareefPricingMini />,
    title: "Khareef-ready pricing",
    body: "Automatic rate changes for Khareef season. Maximise revenue during your busiest months without spreadsheet juggling.",
  },
  {
    visual: <MultiDeviceMini />,
    title: "Manage from anywhere",
    body: "Approve expenses from your phone. Check dashboards from home. Run your business from the gardens of Al Haffa if you want.",
  },
];

export default function SolutionSection() {
  return (
    <section id="features" data-screen-label="Solution" className="bg-gray-50 py-16 md:py-24">
      <Container>
        <SectionHead
          eyebrow="The Binaya way"
          title="Built for the way you actually work."
          description="Binaya PMS handles every part of property management — from the first phone call to the monthly P&L — so you can stop firefighting and start running the business."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {SOLUTIONS.map(({ visual, title, body }, i) => (
            <Reveal key={title} delay={i * 120}>
              <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white p-7 transition-all duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl">
                <div className="relative h-[180px] overflow-hidden rounded-md border border-gray-200 bg-gray-50 transition-transform duration-300 group-hover:scale-[1.02]">
                  {visual}
                </div>
                <h3 className="mt-5 mb-2 text-xl font-semibold tracking-tight">{title}</h3>
                <p className="m-0 text-[14.5px] text-gray-600">{body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
