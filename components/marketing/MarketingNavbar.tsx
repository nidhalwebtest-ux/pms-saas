"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu } from "lucide-react";
import Container from "./ui/Container";
import { MarketingButton } from "./ui/MarketingButton";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how",      label: "How it works" },
  { href: "#pricing",  label: "Pricing" },
  { href: "#resources",label: "Resources", hasMenu: true },
];

export default function MarketingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={[
        "sticky top-0 z-50 backdrop-blur-md backdrop-saturate-150",
        "bg-white/85 transition-[border-color,box-shadow,padding] duration-200",
        scrolled
          ? "border-b border-gray-200 shadow-[0_1px_0_0_oklch(0.155_0.009_258/0.02)]"
          : "border-b border-transparent",
      ].join(" ")}
    >
      <Container
        className={[
          "flex items-center gap-9 transition-[height] duration-200",
          scrolled ? "h-[60px]" : "h-[72px]",
        ].join(" ")}
      >
        <Link
          href="#top"
          className="inline-flex items-center gap-2.5 text-[17px] font-semibold tracking-tight text-gray-900"
        >
          <span className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-brand-500 text-[15px] font-semibold text-white shadow-brand">
            B
          </span>
          <span>
            Binaya <span className="font-normal text-gray-500">PMS</span>
          </span>
        </Link>

        <nav className="ms-2 hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              {link.label}
              {link.hasMenu && <ChevronDown className="h-2.5 w-2.5" strokeWidth={1.5} />}
            </a>
          ))}
        </nav>

        <span className="flex-1" />

        <div className="flex items-center gap-1.5">
          <LanguageSwitch />
          <div className="hidden sm:inline-flex">
            <MarketingButton href="#login" variant="ghost" size="sm">
              Log in
            </MarketingButton>
          </div>
          <div className="hidden sm:inline-flex">
            <MarketingButton href="#trial" variant="primary" size="md">
              Start free trial
            </MarketingButton>
          </div>
          <button
            type="button"
            aria-label="Menu"
            className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-gray-200 bg-white lg:hidden"
          >
            <Menu className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </button>
        </div>
      </Container>
    </header>
  );
}

function LanguageSwitch() {
  return (
    <button
      type="button"
      aria-label="Language"
      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-transparent px-2.5 py-1.5 text-[13px] font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
    >
      <span className="text-gray-900">EN</span>
      <span className="font-light text-gray-300">/</span>
      <span className="font-arabic">العربية</span>
    </button>
  );
}
