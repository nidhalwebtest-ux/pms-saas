interface Props {
  className?: string;
}

export function KeySuccessIllustration({ className }: Props) {
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
      <circle cx="16" cy="24" r="8" />
      <circle cx="16" cy="24" r="8" fill="currentColor" fillOpacity="0.12" stroke="none" />
      <circle cx="16" cy="24" r="2.5" />
      <path d="M24 24h17" />
      <path d="M34 24v5" />
      <path d="M41 24v4" />
      <path d="M38 7c0 2.5 1.2 3.5 3.5 3.5-2.3 0-3.5 1.2-3.5 3.5 0-2.3-1.2-3.5-3.5-3.5 2.3 0 3.5-1 3.5-3.5z" />
    </svg>
  );
}
