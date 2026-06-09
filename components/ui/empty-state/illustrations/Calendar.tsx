/**
 * Mirror of `public/illustrations/calendar.svg`. Inlined as a React
 * component so the EmptyState variant tile's `currentColor` flows in
 * through `stroke` and `fill`. The original .svg stays in `public/` for
 * URL consumers (`<img src="/illustrations/calendar.svg" />`).
 */

interface Props {
  className?: string;
}

export function CalendarIllustration({ className }: Props) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="6" y="11" width="36" height="32" rx="3" />
      <path d="M6 19h36" />
      <path d="M15 7v8M33 7v8" />
      <rect x="22" y="29" width="7" height="7" rx="1.5" fill="currentColor" fillOpacity="0.16" stroke="none" />
      <circle cx="14" cy="26" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="20" cy="26" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="26" cy="26" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="32" cy="26" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="33" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="20" cy="33" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="25.5" cy="32.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="14" cy="39" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="20" cy="39" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
