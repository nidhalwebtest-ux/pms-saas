"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Menu, X } from "lucide-react";
import Container from "./ui/Container";
import { MarketingButton } from "./ui/MarketingButton";
import { type Locale } from "@/i18n/config";
import { DuoIcon } from "./v2/icons";
import { whatsappUrl } from "@/lib/marketing/whatsapp";
import v2 from "./v2/landing.module.css";

// Landing v2: the four anchors follow the promo video's story (pain → solution → pricing → contact).
const NAV_LINKS = [
  { href: "/#problems", id: "problems", key: "problems" },
  { href: "/#solution", id: "solution", key: "solution" },
  { href: "/#pricing",  id: "pricing",  key: "pricing" },
  { href: "/#contact",  id: "contact",  key: "contact" },
];

/** Scroll-spy: id of the story section under the middle of the viewport (null above the first). */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);
  return active;
}

/** The video's gold progress bar: fills in the reading direction as the page scrolls. */
function ReadingProgress() {
  const bar = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px]">
      <span
        ref={bar}
        className="absolute inset-0 origin-left rtl:origin-right bg-[#C9A45C]/70"
        style={{ transform: "scaleX(0)" }}
      />
    </span>
  );
}

export default function MarketingNavbar() {
  const t = useTranslations("marketing.nav");
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [ids] = useState(() => NAV_LINKS.map((l) => l.id));
  const active = useActiveSection(ids);
  const wa = whatsappUrl(t("whatsappText"));

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
            href="/"
            className="inline-flex items-center gap-2.5 text-[17px] font-semibold tracking-tight text-gray-900"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/binaya-mark.svg" alt="" className="h-[30px] w-[30px]" />
            {/* wordmark in Poppins 600, as in the promo video */}
            <span dir="ltr" className="[font-family:var(--font-poppins),sans-serif] text-[19px] font-semibold tracking-[-0.02em]">
              Binaya
            </span>
          </Link>

          <nav className="ms-2 hidden items-center gap-1 lg:flex" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                aria-current={active === link.id ? "location" : undefined}
                className={[
                  "relative inline-flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-2 text-[15px] transition-colors hover:bg-gray-100 hover:text-gray-900",
                  active === link.id ? "font-semibold text-brand-600" : "text-gray-700",
                ].join(" ")}
              >
                {t(link.key)}
                <span
                  aria-hidden="true"
                  className={[
                    "absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-brand-500 transition-opacity duration-200",
                    active === link.id ? "opacity-100" : "opacity-0",
                  ].join(" ")}
                />
              </a>
            ))}
          </nav>

          <span className="flex-1" />

          <div className="flex items-center gap-1.5">
            <LanguageSwitch />
            <div className="hidden sm:inline-flex">
              <MarketingButton href="/login" variant="ghost" size="sm">
                {t("login")}
              </MarketingButton>
            </div>
            <div className="hidden md:inline-flex">
              <MarketingButton href="/login?mode=signup" variant="secondary" size="md">
                {t("signup")}
              </MarketingButton>
            </div>
            {/* primary CTA (D5): WhatsApp, gold like the video's CTA */}
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              data-cta="nav-whatsapp"
              className={`${v2.ctaGold} hidden sm:inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-[14.5px] font-bold transition-[filter]`}
            >
              <DuoIcon name="whatsappLogo" size={20} duo="#0B1F3A" duoOpacity={0.18} />
              {t("whatsapp")}
            </a>
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
        <ReadingProgress />
      </header>

      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} whatsapp={wa} />
    </>
  );
}

/* ============================================================================
 *  Mobile drawer — slide-down sheet below the header. Links scroll to their
 *  anchor and close on click; the backdrop and ESC close it too.
 * ========================================================================= */

function MobileDrawer({ open, onClose, whatsapp }: { open: boolean; onClose: () => void; whatsapp: string }) {
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
          "fixed inset-x-0 top-[60px] z-40 max-h-[calc(100vh-60px)] overflow-y-auto border-b border-gray-200 bg-white shadow-xl transition-[transform,visibility] duration-300 lg:hidden",
          // invisible when closed, so no part of the drawer can peek out under the header
          open ? "visible translate-y-0" : "invisible -translate-y-full",
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
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              data-cta="drawer-whatsapp"
              className={`${v2.ctaGold} inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[16px] font-bold`}
            >
              <DuoIcon name="whatsappLogo" size={22} duo="#0B1F3A" duoOpacity={0.18} />
              {t("whatsapp")}
            </a>
            <MarketingButton href="/login?mode=signup" variant="secondary" size="lg" fullWidth>
              {t("signup")}
            </MarketingButton>
            <MarketingButton href="/login" variant="ghost" size="lg" fullWidth>
              {t("login")}
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
