import { Star } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Container from "../ui/Container";

const LOGOS = [
  { glyph: "SP", name: "Salalah Plaza",    tint: "bg-brand-50 text-brand-700" },
  { glyph: "MR", name: "Mirbat Resort",    tint: "bg-khareef-50 text-khareef-700" },
  { glyph: "HR", name: "Haffa Residences", tint: "bg-warning-50 text-warning-700" },
  { glyph: "DH", name: "Dhofar Homes",     tint: "bg-success-50 text-success-700" },
  { glyph: "AS", name: "Al Saada Suites",  tint: "bg-info-50 text-info-700" },
];

export default async function TrustBarSection() {
  const t = await getTranslations("marketing.trust");
  return (
    <section
      data-screen-label="Trust"
      className="relative overflow-hidden border-y border-gray-200 bg-gradient-to-b from-gray-50 to-white py-9"
    >
      <Container className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
        <span className="inline-flex items-center gap-2 rounded-full border border-khareef-200/80 bg-white px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-khareef-700 shadow-sm">
          <Star className="h-3 w-3 fill-khareef-500 text-khareef-500" strokeWidth={0} />
          {t("madeIn")}
        </span>
        <div className="flex flex-wrap items-center justify-center gap-x-9 gap-y-4">
          {LOGOS.map((l) => (
            <span
              key={l.glyph}
              className="group inline-flex items-center gap-2.5 text-[14px] font-medium tracking-tight text-gray-500 transition-opacity duration-200 hover:opacity-100"
              style={{ opacity: 0.75 }}
            >
              <span className={`grid h-7 w-7 place-items-center rounded-md font-mono text-[11px] font-semibold transition-transform duration-200 group-hover:scale-110 ${l.tint}`}>
                {l.glyph}
              </span>
              {l.name}
            </span>
          ))}
        </div>
      </Container>
    </section>
  );
}
