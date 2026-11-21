import type { Config } from "tailwindcss";

/**
 * Tailwind build for the PUBLIC booking sites only (styles/public-site.css).
 *
 * Deliberately STANDALONE (stock Tailwind theme), not a preset of the app's
 * tailwind.config.ts: the dashboard design system remaps the spacing scale
 * (e.g. h-9 = 96px, p-5 = 24px) and shadows to its own tokens, which blew up
 * public-site layouts written against standard Tailwind (oversized logo,
 * search bar overflowing its card). Brand colours come from --site-primary /
 * --site-accent; fonts from styles/fonts.css. It only scans public-site files,
 * so visitors download a small stylesheet. rtl:/ltr: variants and logical
 * utilities (ms-*, start-*, …) are built into Tailwind 3.4.
 */
const config: Config = {
  content: [
    "./app/(public-site)/**/*.{ts,tsx}",
    "./lib/public-site/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
