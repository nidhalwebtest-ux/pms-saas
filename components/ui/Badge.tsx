"use client";

import { forwardRef, HTMLAttributes, ReactNode, CSSProperties } from "react";

/* ----------------------------------------------------------------------------
 *  Types
 * ------------------------------------------------------------------------- */

export type BadgeTone =
  | "neutral"
  | "info"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "accent"
  | "gold";

export type BadgeAppearance = "subtle" | "solid" | "outline";

export type BadgeSize = "sm" | "md" | "lg";

export interface BadgeProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  tone?: BadgeTone;
  appearance?: BadgeAppearance;
  size?: BadgeSize;
  /** Leading 5/6/7 px dot in the tone color. Hidden when `icon` is set. */
  dot?: boolean;
  /** Leading icon. Overrides `dot` when present. */
  icon?: ReactNode;
  /** Animates the dot with the `badge-pulse` keyframe (Overstay only). */
  pulse?: boolean;
  /** Line-through on the label (Cancelled reservations). */
  strikethrough?: boolean;
  /** When present, renders a trailing × button. Requires `closeLabel`. */
  onClose?: () => void;
  /** aria-label for the trailing × button. */
  closeLabel?: string;
  children: ReactNode;
}

/* ----------------------------------------------------------------------------
 *  Size / dot / icon scales
 *  Sizes use arbitrary pixel values where the design-token spacing scale
 *  doesnt expose 20 / 24 / 28 px directly (spacing 5/6/7 are overridden
 *  in this projects tailwind.config.ts).
 * ------------------------------------------------------------------------- */

const sizeBase: Record<BadgeSize, string> = {
  sm: "h-[20px] text-xs px-2",       // 20 px tall, 11 px text (--text-xs), 8 px x-pad
  md: "h-[24px] text-sm px-2.5",     // 24 px tall, 12 px text (--text-sm), 10 px x-pad
  lg: "h-[28px] text-[13px] px-3",   // 28 px tall, 13 px text (no token), 12 px x-pad
};

const dotSize: Record<BadgeSize, string> = {
  sm: "h-[5px] w-[5px]",
  md: "h-1.5 w-1.5",                 // 6 px (default Tailwind, not in token scale)
  lg: "h-[7px] w-[7px]",
};

const iconBox: Record<BadgeSize, string> = {
  sm: "h-2.5 w-2.5",                 // 10 px
  md: "h-3 w-3",                     // 12 px
  lg: "h-3.5 w-3.5",                 // 14 px
};

/* ----------------------------------------------------------------------------
 *  Tone × appearance tables — Tailwind tokens (neutral / info / brand /
 *  success / warning / danger).
 * ------------------------------------------------------------------------- */

type TailwindToneKey = Exclude<BadgeTone, "accent" | "gold">;

const tailwindTone: Record<
  TailwindToneKey,
  { subtle: string; solid: string; outline: string; dot: string }
> = {
  neutral: {
    subtle:  "bg-gray-100 text-gray-700 border-border-default",
    solid:   "bg-gray-700 text-white border-transparent",
    outline: "bg-transparent text-gray-700 border-border-default",
    dot:     "bg-gray-500",
  },
  info: {
    subtle:  "bg-info-50 text-info-700 border-info-500/20",
    solid:   "bg-info-600 text-white border-transparent",
    outline: "bg-transparent text-info-700 border-info-500/30",
    dot:     "bg-info-500",
  },
  brand: {
    subtle:  "bg-brand-50 text-brand-700 border-brand-500/20",
    solid:   "bg-brand-500 text-white border-transparent",
    outline: "bg-transparent text-brand-700 border-brand-500/30",
    dot:     "bg-brand-500",
  },
  success: {
    subtle:  "bg-success-50 text-success-700 border-success-500/20",
    solid:   "bg-success-600 text-white border-transparent",
    outline: "bg-transparent text-success-700 border-success-500/30",
    dot:     "bg-success-500",
  },
  warning: {
    subtle:  "bg-warning-50 text-warning-700 border-warning-500/30",
    solid:   "bg-warning-600 text-white border-transparent",
    outline: "bg-transparent text-warning-700 border-warning-500/30",
    dot:     "bg-warning-600",
  },
  danger: {
    subtle:  "bg-error-50 text-error-700 border-error-500/20",
    solid:   "bg-error-600 text-white border-transparent",
    outline: "bg-transparent text-error-700 border-error-500/30",
    dot:     "bg-error-500",
  },
};

/* ----------------------------------------------------------------------------
 *  Tone × appearance — OKLCH (accent / gold). Not in Tailwind palette,
 *  applied via inline style.
 * ------------------------------------------------------------------------- */

type OklchToneKey = "accent" | "gold";

const oklchTone: Record<
  OklchToneKey,
  {
    subtle: CSSProperties;
    solid: CSSProperties;
    outline: CSSProperties;
    dot: CSSProperties;
  }
> = {
  accent: {
    subtle: {
      backgroundColor: "oklch(0.965 0.025 295)",
      color:           "oklch(0.400 0.140 295)",
      borderColor:     "oklch(0.560 0.150 295 / 0.22)",
    },
    solid: {
      backgroundColor: "oklch(0.510 0.150 295)",
      color:           "#fff",
      borderColor:     "transparent",
    },
    outline: {
      backgroundColor: "transparent",
      color:           "oklch(0.400 0.140 295)",
      borderColor:     "oklch(0.560 0.150 295 / 0.30)",
    },
    dot: {
      backgroundColor: "oklch(0.560 0.150 295)",
    },
  },
  gold: {
    subtle: {
      backgroundColor: "oklch(0.965 0.040 90)",
      color:           "oklch(0.420 0.150 75)",
      borderColor:     "oklch(0.700 0.150 80 / 0.30)",
    },
    solid: {
      backgroundColor: "oklch(0.620 0.165 78)",
      color:           "var(--gray-900)",
      borderColor:     "transparent",
    },
    outline: {
      backgroundColor: "transparent",
      color:           "oklch(0.420 0.150 75)",
      borderColor:     "oklch(0.700 0.150 80 / 0.30)",
    },
    dot: {
      backgroundColor: "oklch(0.700 0.155 80)",
    },
  },
};

const isOklch = (tone: BadgeTone): tone is OklchToneKey =>
  tone === "accent" || tone === "gold";

/* ----------------------------------------------------------------------------
 *  Component
 * ------------------------------------------------------------------------- */

const base =
  "inline-flex items-center gap-1.5 whitespace-nowrap " +
  "font-medium rounded-sm border " +
  "transition-colors duration-fast ease-out";

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  {
    tone = "neutral",
    appearance = "subtle",
    size = "md",
    dot = false,
    icon,
    pulse = false,
    strikethrough = false,
    onClose,
    closeLabel,
    className = "",
    style,
    children,
    ...rest
  },
  ref,
) {
  const oklch = isOklch(tone);

  // Tailwind classes for non-OKLCH tones; empty string for OKLCH tones.
  const variantCls = oklch ? "" : tailwindTone[tone][appearance];

  // Inline style for OKLCH tones merges with any caller-provided style.
  const containerStyle: CSSProperties | undefined = oklch
    ? { ...oklchTone[tone][appearance], ...style }
    : style;

  const classes = [base, sizeBase[size], variantCls, className]
    .filter(Boolean)
    .join(" ");

  const showIcon = !!icon;
  const showDot = dot && !showIcon;

  const dotCls = oklch ? "" : tailwindTone[tone].dot;
  const dotStyle = oklch ? oklchTone[tone].dot : undefined;

  return (
    <span ref={ref} className={classes} style={containerStyle} {...rest}>
      {showIcon && (
        <span
          className={`inline-flex shrink-0 ${iconBox[size]}`}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}

      {showDot && (
        <span
          aria-hidden="true"
          className={`shrink-0 rounded-full ${dotSize[size]} ${dotCls} ${
            pulse ? "badge-pulse-dot" : ""
          }`}
          style={dotStyle}
        />
      )}

      <span className={strikethrough ? "line-through" : ""}>{children}</span>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel ?? "Remove"}
          className="ms-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm hover:bg-black/10 transition-colors"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="h-2.5 w-2.5"
            aria-hidden="true"
          >
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </span>
  );
});
