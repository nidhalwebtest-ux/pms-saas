import Link from "next/link";
import { MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Container from "./ui/Container";

type Col = { h: string; links: string[] };

// Real destinations, parallel to the translated label order per column.
const HREFS: string[][] = [
  ["/#features", "/#pricing", "/#how", "/#faq"],
  ["/about", "/contact", "#", "#"],
  ["/privacy", "/terms", "#"],
];

export default async function MarketingFooter() {
  const t = await getTranslations("marketing.footer");
  const cols = t.raw("cols") as Col[];
  return (
    <footer data-screen-label="Footer" className="bg-[#0c243d] text-[#a9bdd4]">
      <Container className="py-12 md:py-[72px]">
        <div className="flex flex-wrap justify-between gap-10">
          <div className="min-w-[220px] flex-1 basis-[260px]">
            <Link href="/" className="inline-flex items-center gap-2.5 text-[21px] font-bold tracking-tight text-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/binaya-mark.svg" alt="" className="h-8 w-8 rounded-lg" />
              <span>Binaya</span>
            </Link>
            <p className="mt-4 max-w-[280px] text-[14.5px] leading-[1.6]">{t("tagline")}</p>
            <p className="mt-4 flex items-center gap-2 text-[14px]">
              <MapPin className="h-4 w-4 text-brand-300" strokeWidth={1.7} />
              {t("contact")}
            </p>
          </div>
          <div className="flex flex-wrap gap-11">
            {cols.map((col, ci) => (
              <div key={col.h} className="min-w-[120px]">
                <div className="mb-3.5 text-[14px] font-bold text-white">{col.h}</div>
                <div className="flex flex-col gap-[11px]">
                  {col.links.map((label, li) => (
                    <a key={label} href={HREFS[ci]?.[li] ?? "#"} className="text-[14px] text-[#a9bdd4] transition-colors hover:text-white">
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="my-6 h-px bg-white/10" />
        <div className="flex flex-wrap items-center justify-between gap-3.5">
          <span className="text-[13px] text-[#7b93b0]">{t("rights")}</span>
          <span className="text-[13px] text-[#a9bdd4]">{t("made")}</span>
        </div>
      </Container>
    </footer>
  );
}
