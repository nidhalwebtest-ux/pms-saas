interface Props {
  className?: string;
}

export function SearchIllustration({ className }: Props) {
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
      <circle cx="20" cy="20" r="13" />
      <circle cx="20" cy="20" r="13" fill="currentColor" fillOpacity="0.08" stroke="none" />
      <path d="M30 30l9.5 9.5" strokeWidth={2} />
      <circle cx="20" cy="20" r="7" strokeDasharray="2 2.5" opacity="0.55" />
      <path d="M16 20h8" strokeWidth={1.4} opacity="0.7" />
    </svg>
  );
}
