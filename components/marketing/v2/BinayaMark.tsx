/* The Binaya arch mark (same geometry as /brand/binaya-mark.svg), built so it can "draw itself"
 * like in the promo video: animate [data-mark-arch] stroke-dashoffset 1 → 0, then its fill-opacity
 * 0 → 1, and [data-mark-door] opacity 0 → 1. Rendered fully drawn by default (no JS, reduced motion). */

const ARCH = "M11 53 L11 30 A21 21 0 0 1 53 30 L53 53 L41 53 L41 32 A9 9 0 0 0 23 32 L23 53 Z";

export function BinayaMark({ size = 160, className = "", label }: { size?: number; className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path
        data-mark-arch
        d={ARCH}
        fill="#fff"
        stroke="#fff"
        strokeWidth={1.2}
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={0}
      />
      <rect data-mark-door x="29" y="40" width="8" height="13" rx="2" fill="#85B7EB" />
    </svg>
  );
}
