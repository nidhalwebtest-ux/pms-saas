"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui";

/* ============================================================================
 *  MarketingButton — thin convenience around the design-system Button.
 *
 *  Marketing CTAs always want lift=true on the primary variant. Wrapping
 *  the existing Button instead of forking it keeps the implementation
 *  single-sourced: every change to the design-system Button flows through
 *  here automatically.
 *
 *  Also accepts an optional `href` and wraps the button in a Next Link so
 *  call sites can pass `<MarketingButton href="…">` without having to wire
 *  up the Link themselves.
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
  const btn = (
    <Button
      {...rest}
      variant={variant}
      size={size}
      lift={variant === "primary"}
      onClick={href ? (e) => e.preventDefault() : rest.onClick}
    >
      {children}
    </Button>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex">
        {btn}
      </Link>
    );
  }
  return btn;
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
