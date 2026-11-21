import Link from "next/link";
import type { SiteView } from "@/lib/public-site/render";
import { withBase } from "@/lib/public-site/lang";
import LanguageSwitcher from "./LanguageSwitcher";

function Logo({ src, name, size, onDark = false }: { src: string | null; name: string; size: number; onDark?: boolean }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src} alt={name} width={size} height={size}
        style={{ height: size, width: size }}
        className={`rounded-lg object-contain ${onDark ? "bg-white p-0.5" : ""}`}
      />
    );
  }
  return (
    <span className="flex items-center justify-center rounded-lg font-bold text-white" style={{ height: size, width: size, background: "var(--site-primary)", fontSize: size * 0.45 }}>
      {name.charAt(0)}
    </span>
  );
}

/** Server component — one header per template; only the language switch ships JS. */
export default function SiteHeader({ v, logoUrl }: { v: SiteView; logoUrl: string | null }) {
  const { dict, siteName, theme, base } = v;
  const home = withBase(base, "/");
  const stays = withBase(base, "/buildings");

  // ── Classic: centred logo, nav left, actions right, hairline below ──
  if (theme.key === "template_2") {
    const link = "text-[12px] font-medium uppercase tracking-[0.2em] text-stone-600 transition hover:text-stone-900";
    return (
      <header className="sticky top-0 z-40 border-b border-stone-300 bg-[#fbf9f3]/95 backdrop-blur">
        <div className="mx-auto grid h-20 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-6">
          <nav className="hidden items-center gap-7 sm:flex">
            <Link href={home} className={link}>{dict.nav.home}</Link>
            <Link href={stays} className={link}>{dict.nav.buildings}</Link>
          </nav>
          <Link href={home} className="flex flex-col items-center gap-1 text-center sm:col-start-2">
            <Logo src={logoUrl} name={siteName} size={34} />
            <span className="max-w-[46vw] truncate text-lg font-[family-name:var(--font-display)] leading-none sm:text-xl" style={{ color: "var(--site-primary)" }}>{siteName}</span>
          </Link>
          <div className="col-start-3 flex items-center justify-end gap-1 sm:gap-2">
            <LanguageSwitcher />
            <Link
              href={stays}
              className={`whitespace-nowrap border border-[color:var(--site-primary)] px-4 py-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[color:var(--site-primary)] transition hover:bg-[color:var(--site-primary)] hover:text-white ${theme.btn}`}
            >
              {dict.nav.book}
            </Link>
          </div>
        </div>
      </header>
    );
  }

  // ── Modern: dark bar, left logo, bold nav ──
  if (theme.key === "template_3") {
    const link = "hidden rounded-md px-3 py-1.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white sm:block";
    return (
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href={home} className="flex min-w-0 items-center gap-2.5">
            <Logo src={logoUrl} name={siteName} size={34} onDark />
            <span className="truncate text-lg font-bold tracking-tight text-white font-[family-name:var(--font-display)]">{siteName}</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link href={home} className={link}>{dict.nav.home}</Link>
            <Link href={stays} className={link}>{dict.nav.buildings}</Link>
            <LanguageSwitcher tone="dark" />
            <Link href={stays} className={`whitespace-nowrap px-4 py-1.5 text-sm font-bold text-black transition hover:opacity-90 ${theme.btn}`} style={{ background: "var(--site-accent)" }}>
              {dict.nav.book}
            </Link>
          </nav>
        </div>
      </header>
    );
  }

  // ── Coastal: light bar, pill buttons ──
  const navLink = "hidden rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 sm:block";
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href={home} className="flex min-w-0 items-center gap-2.5">
          <Logo src={logoUrl} name={siteName} size={36} />
          <span className="truncate text-lg font-semibold font-[family-name:var(--font-display)]" style={{ color: "var(--site-primary)" }}>{siteName}</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href={home} className={navLink}>{dict.nav.home}</Link>
          <Link href={stays} className={navLink}>{dict.nav.buildings}</Link>
          <LanguageSwitcher />
          <Link href={stays} className={`whitespace-nowrap px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 ${theme.btn}`} style={{ background: "var(--site-accent)" }}>
            {dict.nav.book}
          </Link>
        </nav>
      </div>
    </header>
  );
}
