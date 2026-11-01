"use client";

import Link from "next/link";
import type { ReactNode } from "react";
// direct import, not the "@/components/ui" barrel: the barrel pulls the whole dashboard UI kit into the landing page
import { Button, buttonClasses, type ButtonProps } from "@/components/ui/Button";

/* ============================================================================
 *  MarketingButton — thin convenience around the design-system Button.
 *
 *  Marketing CTAs always want lift=true on the primary variant. Wrapping
 *  the existing Button instead of forking it keeps the implementation
 *  single-sourced: every change to the design-system Button flows through
 *  here automatically.
 *
 *  Also accepts an optional `href`: it then renders ONE Next Link styled with
 *  the same button classes (never a <button> nested in an <a> — invalid HTML,
 *  two tab stops, and announced twice by screen readers).
 * ========================================================================= */

export type MarketingButtonProps = Omit<ButtonProps, "lift"> & {
  href?: string;
};

export function MarketingButton({
  href,
  variant = "primary",
  size = "md",
  children,
  ...rest
}: MarketingButtonProps) {
  if (href) {
    const { fullWidth, className, leftIcon, rightIcon } = rest;
    return (
      <Link
        href={href}
        className={buttonClasses({ variant, size, fullWidth, lift: variant === "primary", className })}
        aria-label={rest["aria-label"]}
      >
        {leftIcon && <span className="inline-flex shrink-0" aria-hidden="true">{leftIcon}</span>}
        <span>{children}</span>
        {rightIcon && <span className="inline-flex shrink-0" aria-hidden="true">{rightIcon}</span>}
      </Link>
    );
  }

  return (
    <Button
      {...rest}
      variant={variant}
      size={size}
      lift={variant === "primary"}
    >
      {children}
    </Button>
  );
}

/* ============================================================================
 *  ButtonLink — text-only "Learn more →" affordance used by feature blocks.
 *  Built to match the drop's grow-on-hover behaviour.
 * ========================================================================= */
export function ButtonLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1 font-medium text-brand-600 transition-all hover:gap-2 hover:text-brand-700"
    >
      {children}
    </Link>
  );
}
