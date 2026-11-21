import Link from "next/link";
import type { SiteView } from "@/lib/public-site/render";
import { withBase } from "@/lib/public-site/lang";
import LanguageSwitcher from "./LanguageSwitcher";

/** Server component — only the language switch ships JS. */
export default function SiteHeader({ v, logoUrl }: { v: SiteView; logoUrl: string | null }) {
  const { dict, siteName, theme, base } = v;
  const navLink = "hidden rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 sm:block";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href={withBase(base, "/")} className="flex min-w-0 items-center gap-2.5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={siteName} width={36} height={36} className="h-9 w-9 rounded-lg object-contain" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg text-base font-bold text-white" style={{ background: "var(--site-primary)" }}>
              {siteName.charAt(0)}
            </span>
          )}
          <span className="truncate text-lg font-semibold font-[family-name:var(--font-display)]" style={{ color: "var(--site-primary)" }}>{siteName}</span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href={withBase(base, "/")} className={navLink}>{dict.nav.home}</Link>
          <Link href={withBase(base, "/buildings")} className={navLink}>{dict.nav.buildings}</Link>
          <LanguageSwitcher />
          <Link
            href={withBase(base, "/buildings")}
            className={`px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 ${theme.btn}`}
            style={{ background: "var(--site-accent)" }}
          >
            {dict.nav.book}
          </Link>
        </nav>
      </div>
    </header>
  );
}
