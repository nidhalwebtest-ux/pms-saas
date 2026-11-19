"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MarketingButton } from "./ui/MarketingButton";

// The modal (Headless UI dialog + form fields, ~200 KB of JS) is only needed
// once a visitor clicks "Demo Tour", so it's split out of the landing bundle.
// Loading starts on hover/focus of the button, so it's ready by the click.
const loadDemoTourModal = () => import("./DemoTourModal");
const DemoTourModal = dynamic(() => loadDemoTourModal().then((m) => m.DemoTourModal), { ssr: false });

/**
 * Hero CTA row — client component so "Demo Tour" can open a modal in place
 * rather than navigating away. "Start free" stays a plain link to the
 * existing signup flow for visitors who already know they want an account.
 */
export function HeroCtaRow() {
  const t = useTranslations("marketing.demoTour");
  const [demoOpen, setDemoOpen] = useState(false);
  // Mount the modal only after the first open (then keep it mounted so the
  // close transition still plays).
  const [demoMounted, setDemoMounted] = useState(false);
  const openDemo = () => {
    setDemoMounted(true);
    setDemoOpen(true);
  };

  return (
    <>
      <div className="mt-7 flex flex-wrap items-center gap-4">
        <MarketingButton
          variant="primary"
          size="xl"
          onClick={openDemo}
          onMouseEnter={loadDemoTourModal}
          onFocus={loadDemoTourModal}
        >
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
      {demoMounted && <DemoTourModal open={demoOpen} onClose={() => setDemoOpen(false)} />}
    </>
  );
}
