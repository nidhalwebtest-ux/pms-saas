"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import Container, { SectionHead } from "../ui/Container";

export default function FaqSection() {
  const t = useTranslations("marketing.faq");
  const QA = [
    { q: t("q1"), a: t("a1") },
    { q: t("q2"), a: t("a2") },
    { q: t("q3"), a: t("a3") },
    { q: t("q4"), a: t("a4") },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" data-screen-label="FAQ" className="bg-gray-50 py-16 md:py-24">
      <Container className="max-w-[800px]">
        <SectionHead
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />
        <ul className="m-0 list-none divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white p-0">
          {QA.map((item, i) => {
            const isOpen = open === i;
            return (
              <li key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-start text-[15px] font-medium text-gray-900 hover:bg-gray-50"
                >
                  {item.q}
                  <ChevronDown
                    className={[
                      "h-4 w-4 text-gray-500 transition-transform",
                      isOpen ? "rotate-180" : "",
                    ].join(" ")}
                    strokeWidth={1.75}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 text-[14.5px] leading-[1.6] text-gray-600">
                    {item.a}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
