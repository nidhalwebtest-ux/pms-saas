"use client";

import {
  ButtonHTMLAttributes,
  forwardRef,
  ReactNode,
  useEffect,
} from "react";
import { Spinner } from "./Spinner";

/* ----------------------------------------------------------------------------
 *  Types
 * ------------------------------------------------------------------------- */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "destructive"
  | "link";

export type ButtonSize = "sm" | "md" | "lg" | "xl" | "icon";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  /**
   * Marketing-only: adds a brand drop-shadow on the primary variant plus a
   * subtle hover translate. Off by default so dashboard buttons stay still.
   */
  lift?: boolean;
  children?: ReactNode;
}

/* ----------------------------------------------------------------------------
 *  Class tables — single source of truth for variant × size × state.
 *  Sizes use arbitrary pixel values where the design-token spacing scale
 *  doesn't expose 28 / 34 / 14 px directly (project tokens override
 *  Tailwind defaults for spacing 1–9).
 * ------------------------------------------------------------------------- */

const base =
  "inline-flex items-center justify-center gap-2 " +
  "font-medium whitespace-nowrap select-none " +
  "rounded-md transition-colors duration-fast ease-out " +
  "focus-visible:outline-none disabled:cursor-not-allowed " +
  "aria-disabled:cursor-not-allowed";

const sizeText: Record<Exclude<ButtonSize, "icon">, string> = {
  sm: "h-[28px] text-sm px-2.5",     // 28 / 12px / 10px
  md: "h-[34px] text-[13px] px-3.5", // 34 / 13px / 14px
  lg: "h-10 text-base px-[18px]",    // 40 / 14px / 18px
  xl: "h-[52px] text-base px-[26px]",// 52 / 16px / 26px — marketing CTAs
};

const sizeIcon: Record<"sm" | "md" | "lg", string> = {
  sm: "h-[28px] w-[28px] px-0",
  md: "h-[34px] w-[34px] px-0",
  lg: "h-10 w-10 px-0",
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-500 text-fg-on-brand shadow-xs " +
    "hover:bg-brand-600 hover:shadow-sm " +
    "active:bg-brand-700 active:shadow-none " +
    "focus-visible:shadow-focus " +
    "disabled:bg-gray-200 disabled:text-fg-disabled disabled:shadow-none " +
    "aria-disabled:bg-brand-500 aria-disabled:hover:bg-brand-500",

  secondary:
    "bg-surface text-fg border border-border-default " +
    "hover:bg-subtle hover:border-border-strong " +
    "active:bg-muted " +
    "focus-visible:border-brand-500 focus-visible:shadow-focus " +
    "disabled:bg-subtle disabled:text-fg-disabled disabled:border-border-subtle",

  ghost:
    "bg-transparent text-fg-secondary " +
    "hover:bg-subtle hover:text-fg " +
    "active:bg-muted " +
    "focus-visible:text-fg focus-visible:shadow-focus " +
    "disabled:text-fg-disabled disabled:bg-transparent",

  destructive:
    "bg-error-500 text-white shadow-xs " +
    "hover:bg-error-600 hover:shadow-sm " +
    "active:bg-error-700 active:shadow-none " +
    "focus-visible:shadow-focus-error " +
    "disabled:bg-gray-200 disabled:text-fg-disabled disabled:shadow-none",

  link:
    "inline-flex items-center gap-1 h-auto p-0 " +
    "text-brand-600 underline underline-offset-2 " +
    "hover:text-brand-700 active:text-brand-700 " +
    "focus-visible:shadow-focus rounded-sm " +
    "disabled:text-fg-disabled disabled:no-underline",
};

function devWarnAriaLabel(size: ButtonSize, ariaLabel?: string) {
  if (
    process.env.NODE_ENV !== "production" &&
    size === "icon" &&
    !ariaLabel
  ) {
    console.warn(
      '[Button] size="icon" requires an aria-label so the button is announced to assistive tech.',
    );
  }
}

/* ----------------------------------------------------------------------------
 *  Component
 * ------------------------------------------------------------------------- */

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    fullWidth = false,
    loading = false,
    leftIcon,
    rightIcon,
    lift = false,
    disabled,
    type = "button",
    className = "",
    onClick,
    children,
    ...rest
  },
  ref,
) {
  const ariaLabel = rest["aria-label"];
  useEffect(() => {
    devWarnAriaLabel(size, ariaLabel);
  }, [size, ariaLabel]);

  const handleClick: ButtonProps["onClick"] = (e) => {
    if (loading) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  const sizeClass =
    variant === "link"
      ? ""
      : size === "icon"
      ? sizeIcon.md
      : sizeText[size];

  const spinnerPx =
    size === "sm" ? 12 :
    size === "lg" ? 16 :
    size === "xl" ? 18 :
    size === "icon" ? 16 : 14;

  // Marketing lift treatment — only meaningful on the primary variant.
  const liftClass =
    lift && variant === "primary"
      ? "shadow-brand hover:shadow-brand-hover hover:-translate-y-px active:translate-y-0 transition-[transform,box-shadow,background-color] duration-150"
      : "";

  const classes = [
    base,
    variantClasses[variant],
    sizeClass,
    fullWidth ? "w-full" : "",
    loading ? "cursor-wait" : "",
    liftClass,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const startSlot = loading ? <Spinner size={spinnerPx} /> : leftIcon;

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      onClick={handleClick}
      className={classes}
      {...rest}
    >
      {startSlot && (
        <span
          className={`inline-flex shrink-0 ${loading ? "opacity-100" : ""}`}
          aria-hidden="true"
        >
          {startSlot}
        </span>
      )}

      {size !== "icon" && children !== undefined && (
        <span className={loading ? "opacity-90" : ""}>{children}</span>
      )}

      {rightIcon && !loading && (
        <span className="inline-flex shrink-0" aria-hidden="true">
          {rightIcon}
        </span>
      )}
    </button>
  );
});
