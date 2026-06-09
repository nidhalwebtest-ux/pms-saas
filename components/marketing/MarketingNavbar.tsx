"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Menu, X } from "lucide-react";
import Container from "./ui/Container";
import { MarketingButton } from "./ui/MarketingButton";
import { type Locale } from "@/i18n/config";

const NAV_LINKS = [
  { href: "#features", key: "features" },
  { href: "#how",      key: "how" },
  { href: "#pricing",  key: "pricing" },
  { href: "#faq",      key: "faq" },
];

export default function MarketingNavbar() {
  const t = useTranslations("marketing.nav");
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ESC closes the mobile drawer; lock body scroll while open so the
  // backdrop does not flick the page underneath.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  return (
    <>
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
            "flex items-center gap-3 lg:gap-9 transition-[height] duration-200",
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
                {t(link.key)}
              </a>
            ))}
          </nav>

          <span className="flex-1" />

          <div className="flex items-center gap-1.5">
            <LanguageSwitch />
            <div className="hidden sm:inline-flex">
              <MarketingButton href="#login" variant="ghost" size="sm">
                {t("login")}
              </MarketingButton>
            </div>
            <div className="hidden sm:inline-flex">
              <MarketingButton href="#trial" variant="primary" size="md">
                {t("trial")}
              </MarketingButton>
            </div>
            <button
              type="button"
              aria-label={menuOpen ? t("closeMenu") : t("openMenu")}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-gray-200 bg-white transition-colors hover:bg-gray-50 lg:hidden"
            >
              {menuOpen
                ? <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
                : <Menu className="h-[18px] w-[18px]" strokeWidth={1.75} />}
            </button>
          </div>
        </Container>
      </header>

      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

/* ============================================================================
 *  Mobile drawer — slide-down sheet below the header. Links scroll to their
 *  anchor and close on click; the backdrop and ESC close it too.
 * ========================================================================= */

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("marketing.nav");
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={[
          "fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm transition-opacity duration-200 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      />
      {/* Drawer */}
      <div
        id="mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        className={[
          "fixed inset-x-0 top-[60px] z-40 max-h-[calc(100vh-60px)] overflow-y-auto border-b border-gray-200 bg-white shadow-xl transition-transform duration-300 lg:hidden",
          open ? "translate-y-0" : "-translate-y-full",
        ].join(" ")}
      >
        <Container className="py-6">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={onClose}
                className="flex items-center justify-between rounded-md px-3 py-3 text-base font-medium text-gray-900 hover:bg-gray-50"
              >
                {t(link.key)}
                <ChevronDown className="h-4 w-4 rotate-[-90deg] rtl:rotate-90 text-gray-400" strokeWidth={1.5} />
              </a>
            ))}
          </nav>
          <div className="mt-5 flex flex-col gap-2 border-t border-gray-200 pt-5">
            <MarketingButton href="#login" variant="secondary" size="lg" fullWidth>
              {t("login")}
            </MarketingButton>
            <MarketingButton href="#trial" variant="primary" size="lg" fullWidth>
              {t("trial")}
            </MarketingButton>
          </div>
        </Container>
      </div>
    </>
  );
}

/* ============================================================================
 *  Language switch — toggles between EN and AR by POSTing to /api/me/language
 *  (which sets the NEXT_LOCALE cookie pre-auth too). After the request lands,
 *  router.refresh() re-renders the entire tree in the new locale.
 * ========================================================================= */

function LanguageSwitch() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale) return;
    // Optimistic localStorage hint (next-intl reads the cookie, but
    // sibling code in the dashboard mirrors this).
    try { localStorage.setItem("locale", next); } catch {}
    startTransition(async () => {
      await fetch("/api/me/language", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex items-center rounded-full border border-gray-200 bg-white p-[2px] text-[12px] font-medium shadow-sm"
    >
      <button
        type="button"
        disabled={pending}
        onClick={() => switchTo("en")}
        aria-pressed={locale === "en"}
        className={[
          "rounded-full px-2.5 py-1 transition-colors",
          locale === "en"
            ? "bg-gray-900 text-white"
            : "text-gray-500 hover:text-gray-700",
        ].join(" ")}
      >
        EN
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => switchTo("ar")}
        aria-pressed={locale === "ar"}
        className={[
          "rounded-full px-2.5 py-1 font-arabic transition-colors",
          locale === "ar"
            ? "bg-gray-900 text-white"
            : "text-gray-500 hover:text-gray-700",
        ].join(" ")}
      >
        العربية
      </button>
    </div>
  );
}
