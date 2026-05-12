import type { Config } from "tailwindcss";

/**
 * Binaya PMS — Tailwind configuration
 *
 * Tokens are sourced from /styles/design-tokens.css via CSS variables so that
 * runtime themes (light/dark, RTL/LTR, brand overrides) only need to swap
 * the variables — no Tailwind rebuild required.
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "var(--brand-50)",
          100: "var(--brand-100)",
          200: "var(--brand-200)",
          300: "var(--brand-300)",
          400: "var(--brand-400)",
          500: "var(--brand-500)",
          600: "var(--brand-600)",
          700: "var(--brand-700)",
          900: "var(--brand-900)",
          DEFAULT: "var(--brand-500)",
        },
        gray: {
          0: "var(--gray-0)",
          50: "var(--gray-50)",
          100: "var(--gray-100)",
          200: "var(--gray-200)",
          300: "var(--gray-300)",
          400: "var(--gray-400)",
          500: "var(--gray-500)",
          600: "var(--gray-600)",
          700: "var(--gray-700)",
          800: "var(--gray-800)",
          900: "var(--gray-900)",
        },
        success: {
          50: "var(--success-50)",
          500: "var(--success-500)",
          600: "var(--success-600)",
          700: "var(--success-700)",
          DEFAULT: "var(--success-500)",
        },
        warning: {
          50: "var(--warning-50)",
          500: "var(--warning-500)",
          600: "var(--warning-600)",
          700: "var(--warning-700)",
          DEFAULT: "var(--warning-500)",
        },
        error: {
          50: "var(--error-50)",
          100: "var(--error-100)",
          500: "var(--error-500)",
          600: "var(--error-600)",
          700: "var(--error-700)",
          DEFAULT: "var(--error-500)",
        },
        info: {
          50: "var(--info-50)",
          500: "var(--info-500)",
          600: "var(--info-600)",
          700: "var(--info-700)",
          DEFAULT: "var(--info-500)",
        },
        // Semantic surface / foreground aliases
        canvas: "var(--bg-canvas)",
        surface: "var(--bg-surface)",
        subtle: "var(--bg-subtle)",
        muted: "var(--bg-muted)",
        fg: "var(--fg-default)",
        "fg-secondary": "var(--fg-secondary)",
        "fg-tertiary": "var(--fg-tertiary)",
        "fg-disabled": "var(--fg-disabled)",
        "fg-on-brand": "var(--fg-on-brand)",
        "border-subtle": "var(--border-subtle)",
        "border-default": "var(--border-default)",
        "border-strong": "var(--border-strong)",
      },

      fontFamily: {
        sans: ["var(--font-sans)"],
        arabic: ["var(--font-arabic)"],
        mono: ["var(--font-mono)"],
      },

      fontSize: {
        xs: ["var(--text-xs)", { lineHeight: "var(--leading-normal)" }],
        sm: ["var(--text-sm)", { lineHeight: "var(--leading-normal)" }],
        base: ["var(--text-base)", { lineHeight: "var(--leading-normal)" }],
        md: ["var(--text-md)", { lineHeight: "var(--leading-normal)" }],
        lg: ["var(--text-lg)", { lineHeight: "var(--leading-snug)" }],
        xl: ["var(--text-xl)", { lineHeight: "var(--leading-snug)" }],
        "2xl": ["var(--text-2xl)", { lineHeight: "var(--leading-snug)" }],
        "3xl": ["var(--text-3xl)", { lineHeight: "var(--leading-tight)" }],
        "4xl": ["var(--text-4xl)", { lineHeight: "var(--leading-tight)" }],
        "5xl": ["var(--text-5xl)", { lineHeight: "var(--leading-tight)" }],
      },

      fontWeight: {
        light: "var(--font-light)",
        normal: "var(--font-regular)",
        medium: "var(--font-medium)",
        semibold: "var(--font-semibold)",
        bold: "var(--font-bold)",
      },

      letterSpacing: {
        tighter: "var(--tracking-tighter)",
        tight: "var(--tracking-tight)",
        normal: "var(--tracking-normal)",
        wide: "var(--tracking-wide)",
        wider: "var(--tracking-wider)",
      },

      spacing: {
        0: "var(--space-0)",
        1: "var(--space-1)",
        2: "var(--space-2)",
        3: "var(--space-3)",
        4: "var(--space-4)",
        5: "var(--space-5)",
        6: "var(--space-6)",
        7: "var(--space-7)",
        8: "var(--space-8)",
        9: "var(--space-9)",
      },

      borderRadius: {
        none: "var(--radius-none)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-full)",
        DEFAULT: "var(--radius-md)",
      },

      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        focus: "var(--shadow-focus)",
        "focus-error": "var(--shadow-focus-error)",
      },

      transitionDuration: {
        fast: "var(--duration-fast)",
        medium: "var(--duration-medium)",
        slow: "var(--duration-slow)",
        slower: "var(--duration-slower)",
      },

      transitionTimingFunction: {
        out: "var(--ease-out)",
        "in-out": "var(--ease-in-out)",
        spring: "var(--ease-spring)",
      },

      maxWidth: {
        container: "var(--container-2xl)",
      },

      zIndex: {
        base: "var(--z-base)",
        dropdown: "var(--z-dropdown)",
        sticky: "var(--z-sticky)",
        overlay: "var(--z-overlay)",
        modal: "var(--z-modal)",
        toast: "var(--z-toast)",
      },
    },
  },

  plugins: [
    // Logical-property utilities for RTL: ms-/me-/ps-/pe-/start-/end-
    // come built-in with Tailwind v3.3+. No plugin needed for those.
    require("tailwindcss-rtl"),
    require("@tailwindcss/forms")({ strategy: "class" }),
  ],
};

export default config;
