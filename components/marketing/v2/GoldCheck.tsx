/* The video's gold ✓ disc. The tick path has pathLength=1 so a parent can "draw" it by animating
 * stroke-dashoffset 1 → 0 on [data-check-path]. Rendered already drawn unless `drawn={false}`. */

export function GoldCheck({ size = 32, drawn = true, className = "" }: { size?: number; drawn?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="#C9A45C" />
      <path
        data-check-path
        d="M11.5 20.5 L17.5 26.5 L29 14"
        fill="none"
        stroke="#0B1F3A"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={drawn ? 0 : 1}
      />
    </svg>
  );
}
