"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import Container, { SectionHead } from "../ui/Container";

type Item = { q: string; a: string };

export default function FaqSection() {
  const t = useTranslations("marketing.faq");
  const items = t.raw("items") as Item[];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" data-screen-label="FAQ" className="border-b border-gray-200 bg-white py-16 md:py-24">
      <Container className="max-w-[760px]">
        <SectionHead eyebrow={t("eyebrow")} title={t("title")} />
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {items.map((item, i) => {
            const isOpen = open === i;
            return (
              <li
                key={item.q}
                className={["overflow-hidden rounded-[14px] border border-gray-200", isOpen ? "bg-gray-50" : "bg-white"].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-[22px] py-[19px] text-start text-[16.5px] font-semibold text-gray-900"
                >
                  {item.q}
                  <ChevronDown
                    className={["h-5 w-5 flex-none text-brand-500 transition-transform", isOpen ? "rotate-180" : ""].join(" ")}
                    strokeWidth={2.2}
                  />
                </button>
                {isOpen && (
                  <p className="m-0 px-[22px] pb-5 text-[15.5px] leading-[1.65] text-gray-600">{item.a}</p>
                )}
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
