/**
 * Heading-font presets for the public booking sites (client + server safe).
 * Every preset pairs a Latin face with an Arabic face so both languages look
 * intentional. The faces are self-hosted (styles/fonts.css, --font-* variables);
 * browsers only download the ones a page actually renders.
 * "auto" = use the template's own typography (lib/public-site/theme.ts).
 */
export type FontPresetKey = "auto" | "classic" | "editorial" | "modern" | "friendly" | "clean";

export const FONT_PRESETS: { key: FontPresetKey; stack: string | null; latin: string; arabic: string }[] = [
  { key: "auto",      stack: null, latin: "var(--font-sans)", arabic: "var(--font-arabic)" },
  { key: "classic",   stack: "var(--font-playfair), var(--font-amiri), Georgia, serif", latin: "var(--font-playfair), Georgia, serif", arabic: "var(--font-amiri), serif" },
  { key: "editorial", stack: "var(--font-fraunces), var(--font-tajawal), Georgia, serif", latin: "var(--font-fraunces), Georgia, serif", arabic: "var(--font-tajawal), sans-serif" },
  { key: "modern",    stack: "var(--font-space), var(--font-cairo), system-ui, sans-serif", latin: "var(--font-space), system-ui, sans-serif", arabic: "var(--font-cairo), sans-serif" },
  { key: "friendly",  stack: "var(--font-poppins), var(--font-cairo), system-ui, sans-serif", latin: "var(--font-poppins), system-ui, sans-serif", arabic: "var(--font-cairo), sans-serif" },
  { key: "clean",     stack: '"IBM Plex Sans", "IBM Plex Sans Arabic", system-ui, sans-serif', latin: '"IBM Plex Sans", system-ui, sans-serif', arabic: '"IBM Plex Sans Arabic", sans-serif' },
];

export const isFontPreset = (v: unknown): v is FontPresetKey => FONT_PRESETS.some((p) => p.key === v);

/** The heading font stack for a preset, or null for "auto" / unknown. */
export const fontStackFor = (key: string | null | undefined): string | null =>
  FONT_PRESETS.find((p) => p.key === key)?.stack ?? null;
