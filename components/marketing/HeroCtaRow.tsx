"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MarketingButton } from "./ui/MarketingButton";
import { DemoTourModal } from "./DemoTourModal";

/**
 * Hero CTA row — client component so "Demo Tour" can open a modal in place
 * rather than navigating away. "Start free" stays a plain link to the
 * existing signup flow for visitors who already know they want an account.
 */
export function HeroCtaRow() {
  const t = useTranslations("marketing.demoTour");
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <>
      <div className="mt-7 flex flex-wrap items-center gap-4">
        <MarketingButton variant="primary" size="xl" onClick={() => setDemoOpen(true)}>
          {t("cta")}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" strokeWidth={1.75} />
        </MarketingButton>
        <Link
          href="/login?mode=signup"
          className="text-sm font-semibold text-gray-600 underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gray-900 hover:decoration-gray-500"
        >
          {t("ctaSecondary")}
        </Link>
      </div>
      <DemoTourModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </>
  );
}
