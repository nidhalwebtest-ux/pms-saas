import type { ReactNode } from "react";

/* ============================================================================
 *  Marketing Container — page-level horizontal max-width.
 *
 *  Distinct from the dashboard's 1440 px `max-w-container`. Marketing pages
 *  use a narrower 1200 px shell so the long-form copy stays comfortable to
 *  read at desktop widths.
 * ========================================================================= */
export default function Container({
  children,
  className = "",
  wide = false,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={[
        "mx-auto w-full px-5 sm:px-8",
        wide ? "max-w-marketing-container-wide" : "max-w-marketing-container",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/* ============================================================================
 *  SectionHead — centered eyebrow + h2 + lede triplet used by every
 *  marketing section that opens with copy.
 * ========================================================================= */
export function SectionHead({
  eyebrow,
  title,
  description,
  muted = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  muted?: boolean;
}) {
  return (
    <div className="mx-auto mb-14 max-w-[720px] text-center">
      <span
        className={[
          "inline-block font-mono text-[12px] font-medium uppercase tracking-[0.08em]",
          muted ? "text-gray-500" : "text-brand-600",
        ].join(" ")}
      >
        {eyebrow}
      </span>
      <h2 className="mt-3 mb-4 text-[34px] font-semibold leading-[1.1] tracking-[-0.025em] text-balance md:text-[44px]">
        {title}
      </h2>
      {description && (
        <p className="m-0 text-lg text-gray-600 text-pretty">{description}</p>
      )}
    </div>
  );
}
