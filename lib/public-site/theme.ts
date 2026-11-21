/**
 * Per-template design tokens. Same components, three visual identities —
 * differentiated by typography, hero treatment, surfaces, radii and rhythm.
 * The org's brand colours (--site-primary / --site-accent) are shared across all.
 *
 * Font CSS variables (--font-*) are declared by next/font in the public layout.
 */

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
  /** card container */
  card: string;
  /** small pill (badge / amenity) */
  chip: string;
  /** primary button / CTA shape */
  btn: string;
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
    card: "rounded-2xl ring-1 ring-slate-200/70 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/[0.06]",
    chip: "rounded-full",
    btn: "rounded-full",
  },

  // ── T2 Classic — elegant, ivory, centred, refined serif, squared accents ──
  template_2: {
    key: "template_2",
    fontStack: "var(--font-playfair), var(--font-amiri), Georgia, serif",
    page: "bg-[#fbf9f3]",
    hero: {
      height: "h-[88vh] min-h-[580px]",
      align: "items-center justify-center text-center",
      overlay: "bg-black/45",
      kicker: "text-xs font-normal uppercase tracking-[0.32em] text-white/85 after:mx-auto after:mt-3 after:block after:h-px after:w-12 after:bg-white/50 after:content-['']",
      title: "mt-5 max-w-3xl text-5xl font-normal leading-[1.1] text-white sm:text-6xl md:text-7xl",
      subtitle: "mt-5 max-w-xl text-lg font-light italic leading-relaxed text-white/90 sm:text-xl",
    },
    eyebrow: "text-[11px] font-normal uppercase tracking-[0.3em]",
    sectionTitle: "mt-2 text-3xl font-normal text-stone-900 sm:text-4xl",
    card: "rounded-lg ring-1 ring-stone-200 hover:shadow-lg hover:shadow-black/[0.05]",
    chip: "rounded-none",
    btn: "rounded-none",
  },

  // ── T3 Modern — bold, dark hero, minimal, tight grotesk ──
  template_3: {
    key: "template_3",
    fontStack: "var(--font-space), var(--font-cairo), system-ui, sans-serif",
    page: "bg-white",
    hero: {
      height: "h-[90vh] min-h-[600px]",
      align: "items-start justify-end text-start",
      overlay: "bg-gradient-to-t from-black/85 via-black/45 to-black/30",
      kicker: "rounded-md bg-[color:var(--site-accent)] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-black",
      title: "mt-5 max-w-4xl text-6xl font-bold tracking-tight leading-[0.95] text-white sm:text-7xl md:text-8xl",
      subtitle: "mt-6 max-w-xl text-lg font-normal leading-relaxed text-white/80 sm:text-xl",
    },
    eyebrow: "text-xs font-bold uppercase tracking-[0.2em]",
    sectionTitle: "mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl",
    card: "rounded-xl ring-1 ring-slate-900/10 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-black/10",
    chip: "rounded-md",
    btn: "rounded-lg",
  },
};

export function themeFor(key: string): Theme {
  return THEMES[(key as TemplateKey)] ?? THEMES.template_1;
}
