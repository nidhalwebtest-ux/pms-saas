/**
 * Per-template design tokens + layout switches. The three templates are
 * genuinely different layouts (header, hero, building list, sections, footer —
 * see app/(public-site)/sites/[slug]/[lang]/_templates/*), and these tokens carry
 * the shared pieces: typography, surfaces, radii and rhythm. The org's brand
 * colours (--site-primary / --site-accent) are shared across all three.
 *
 * Tailwind scans this file (tailwind.public.config.ts), so classes can be
 * written as plain string literals here.
 * Font CSS variables (--font-*) are declared in styles/fonts.css.
 */
import { fontStackFor } from "./fonts";

export type TemplateKey = "template_1" | "template_2" | "template_3";

export interface Theme {
  key: TemplateKey;
  /** value for --font-display (headings) */
  fontStack: string;
  /** page/body background */
  page: string;
  hero: {
    height: string;
    /** flex container alignment for the hero content */
    align: string;
    /** overlay gradient over the hero image */
    overlay: string;
    /** eyebrow/location chip */
    kicker: string;
    /** h1 classes */
    title: string;
    /** tagline classes */
    subtitle: string;
  };
  /** section eyebrow label */
  eyebrow: string;
  /** section h2 */
  sectionTitle: string;
  /** inner-page h1 (list/search/book pages) */
  pageTitle: string;
  /** card container */
  card: string;
  /** small pill (badge / amenity) */
  chip: string;
  /** primary button / CTA shape */
  btn: string;
  /** search form container + its field cells */
  searchBox: string;
  searchCell: string;
  /** footer surface + text */
  footer: { wrap: string; name: string; heading: string; text: string; hover: string; muted: string };
}

const THEMES: Record<TemplateKey, Theme> = {
  // ── T1 Coastal — light, airy, image-forward, warm serif ──
  template_1: {
    key: "template_1",
    fontStack: "var(--font-fraunces), var(--font-tajawal), Georgia, serif",
    page: "bg-white",
    hero: {
      height: "h-[86vh] min-h-[560px]",
      align: "items-start justify-center text-start",
      overlay: "bg-gradient-to-t from-black/70 via-black/25 to-black/40",
      kicker: "rounded-full bg-white/15 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-white ring-1 ring-white/25 backdrop-blur-sm",
      title: "mt-5 max-w-3xl text-5xl font-semibold leading-[1.05] text-white drop-shadow-sm sm:text-6xl md:text-7xl",
      subtitle: "mt-5 max-w-xl text-lg font-light leading-relaxed text-white/90 sm:text-xl",
    },
    eyebrow: "text-xs font-semibold uppercase tracking-[0.18em]",
    sectionTitle: "mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl",
    pageTitle: "text-3xl font-semibold text-slate-900 sm:text-4xl",
    card: "rounded-2xl ring-1 ring-slate-200/70 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/[0.06]",
    chip: "rounded-full",
    btn: "rounded-full",
    searchBox: "rounded-2xl bg-white p-3 shadow-2xl shadow-black/10 ring-1 ring-black/5",
    searchCell: "rounded-xl bg-slate-50/80",
    footer: {
      wrap: "mt-16 border-t border-slate-200 bg-slate-50",
      name: "text-slate-900", heading: "text-slate-800", text: "text-slate-600", hover: "hover:text-slate-900", muted: "text-slate-400",
    },
  },

  // ── T2 Classic — heritage hotel: ivory, centred, refined serif, squared, hairlines ──
  template_2: {
    key: "template_2",
    fontStack: "var(--font-playfair), var(--font-amiri), Georgia, serif",
    page: "bg-[#fbf9f3]",
    hero: {
      height: "h-[72vh] min-h-[480px]",
      align: "items-center justify-center text-center",
      overlay: "bg-black/45",
      kicker: "text-xs font-normal uppercase tracking-[0.32em] text-white/85 after:mx-auto after:mt-3 after:block after:h-px after:w-12 after:bg-white/50 after:content-['']",
      title: "mt-5 max-w-3xl text-5xl font-normal leading-[1.1] text-white sm:text-6xl md:text-7xl",
      subtitle: "mt-5 max-w-xl text-lg font-light italic leading-relaxed text-white/90 sm:text-xl",
    },
    eyebrow: "text-[11px] font-normal uppercase tracking-[0.3em]",
    sectionTitle: "mt-3 text-3xl font-normal text-stone-900 sm:text-4xl",
    pageTitle: "text-center text-3xl font-normal text-stone-900 sm:text-4xl",
    card: "rounded-none ring-1 ring-stone-300 hover:shadow-lg hover:shadow-black/[0.05]",
    chip: "rounded-none",
    btn: "rounded-none",
    searchBox: "rounded-none bg-white p-3 shadow-xl shadow-black/10 ring-1 ring-stone-300",
    searchCell: "rounded-none bg-[#faf7ef]",
    footer: {
      wrap: "border-t border-stone-300 bg-[#f3efe4]",
      name: "text-stone-900", heading: "text-stone-800", text: "text-stone-600", hover: "hover:text-stone-900", muted: "text-stone-400",
    },
  },

  // ── T3 Modern — bold: dark header/hero/footer, split hero, bento tiles, tight grotesk ──
  template_3: {
    key: "template_3",
    fontStack: "var(--font-space), var(--font-cairo), system-ui, sans-serif",
    page: "bg-white",
    hero: {
      height: "",
      align: "",
      overlay: "",
      kicker: "w-fit rounded-md bg-[color:var(--site-accent)] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-black",
      title: "mt-5 text-5xl font-bold leading-[0.98] tracking-tight text-white sm:text-6xl xl:text-7xl",
      subtitle: "mt-5 max-w-lg text-lg font-normal leading-relaxed text-white/70",
    },
    eyebrow: "text-xs font-bold uppercase tracking-[0.2em]",
    sectionTitle: "mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl",
    pageTitle: "text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl",
    card: "rounded-xl ring-1 ring-slate-900/10 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-black/10",
    chip: "rounded-md",
    btn: "rounded-lg",
    searchBox: "rounded-2xl bg-white p-2.5 shadow-2xl shadow-black/30 ring-1 ring-white/10",
    searchCell: "rounded-lg bg-slate-100",
    footer: {
      wrap: "bg-slate-950",
      name: "text-white", heading: "text-white", text: "text-white/65", hover: "hover:text-white", muted: "text-white/40",
    },
  },
};

/** The template's tokens, with the heading font replaced when the site picked a font preset. */
export function themeFor(key: string, fontPreset?: string | null): Theme {
  const base = THEMES[(key as TemplateKey)] ?? THEMES.template_1;
  const stack = fontStackFor(fontPreset);
  return stack ? { ...base, fontStack: stack } : base;
}
