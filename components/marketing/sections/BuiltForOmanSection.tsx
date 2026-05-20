import { Languages, CircleDollarSign, Waves } from "lucide-react";
import Container, { SectionHead } from "../ui/Container";
import { ArabicUIMini, OMRInvoiceMini, KhareefCalendarMini } from "../mocks";

const OMAN_CARDS = [
  {
    Icon: Languages,
    title: "Full Arabic support",
    body: "Native Arabic interface with proper right-to-left layout. Train your team in their preferred language — receptionist by receptionist.",
    visual: <ArabicUIMini />,
  },
  {
    Icon: CircleDollarSign,
    title: "OMR currency, baisa-precise",
    body: "Built for Omani Rial with proper 3-decimal precision. No conversion errors, no confusing dollar signs slipping into invoices.",
    visual: <OMRInvoiceMini />,
  },
  {
    Icon: Waves,
    title: "Khareef season tools",
    body: "Seasonal pricing, occupancy forecasting, peak-season dashboards. Built around how Salalah's rental economy actually works.",
    visual: <KhareefCalendarMini />,
  },
];

export default function BuiltForOmanSection() {
  return (
    <section
      id="oman"
      data-screen-label="Built for Oman"
      className="oman-bg relative overflow-hidden py-16 md:py-24"
    >
      <Container className="relative">
        <SectionHead
          eyebrow="Made in Salalah"
          title="Made in Oman. For Oman."
          description="Other property software treats Oman as an afterthought — an extra currency setting, a half-baked translation. Binaya was built specifically for how property runs in Salalah."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {OMAN_CARDS.map(({ Icon, title, body, visual }) => (
            <article
              key={title}
              className="rounded-lg border border-khareef-200/60 bg-white p-7 shadow-[0_1px_2px_oklch(0.4_0.1_175/0.04)]"
            >
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-[10px] bg-khareef-50 text-khareef-700">
                <Icon className="h-[22px] w-[22px]" strokeWidth={1.75} />
              </div>
              <h3 className="mb-2 text-[19px] font-semibold tracking-tight">{title}</h3>
              <p className="mb-4 text-[14.5px] text-gray-600">{body}</p>
              <div className="relative h-[120px] overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                {visual}
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
