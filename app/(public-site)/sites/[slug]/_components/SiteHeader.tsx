"use client";

import Link from "next/link";
import { useSite } from "@/lib/public-site/context";
import LanguageSwitcher from "./LanguageSwitcher";

export default function SiteHeader({ logoUrl }: { logoUrl: string | null }) {
  const { dict, siteName } = useSite();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 min-w-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={siteName} className="h-9 w-9 rounded-lg object-contain" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg text-base font-bold text-white" style={{ background: "var(--site-primary)" }}>
              {siteName.charAt(0)}
            </span>
          )}
          <span className="truncate text-lg font-semibold font-[family-name:var(--font-display)]" style={{ color: "var(--site-primary)" }}>{siteName}</span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/" className="hidden rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 sm:block">
            {dict.nav.home}
          </Link>
          <Link href="/buildings" className="hidden rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 sm:block">
            {dict.nav.buildings}
          </Link>
          <LanguageSwitcher />
          <Link
            href="/buildings"
            className="rounded-full px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            style={{ background: "var(--site-accent)" }}
          >
            {dict.nav.book}
          </Link>
        </nav>
      </div>
    </header>
  );
}
