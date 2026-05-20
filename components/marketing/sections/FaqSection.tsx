"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import Container, { SectionHead } from "../ui/Container";

/* ============================================================================
 *  FAQ — placeholder
 *  TODO: paste design markup + real Q/A once provided. Stub here uses a
 *  basic accordion so the section is keyboard- and screen-reader-usable
 *  in its placeholder state.
 * ========================================================================= */

const PLACEHOLDER_QA: { q: string; a: string }[] = [
  {
    q: "Is Binaya really free for one building?",
    a: "Yes. The free tier covers a single building of up to 15 units with one user account, forever. No card on file required.",
  },
  {
    q: "How long does setup take?",
    a: "Most customers create their first real reservation within 20 minutes of signing up. If you have an existing spreadsheet, we can import it for you in one go.",
  },
  {
    q: "Does Binaya handle Khareef pricing automatically?",
    a: "Yes. Seasonal rates apply automatically between configurable date ranges, including the Jun 15 – Sep 15 Khareef window.",
  },
  {
    q: "Can my team work in Arabic?",
    a: "Yes. The entire product UI is bilingual English / Arabic with right-to-left layout. Each user picks their own language.",
  },
];

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" data-screen-label="FAQ" className="bg-gray-50 py-16 md:py-24">
      <Container className="max-w-[800px]">
        <SectionHead
          eyebrow="Common questions"
          title="Everything you might ask."
          description="The straight answers we wish we'd had when we evaluated property software."
        />
        <ul className="m-0 list-none divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white p-0">
          {PLACEHOLDER_QA.map((item, i) => {
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
