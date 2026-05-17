interface Props {
  className?: string;
}

export function ClockIllustration({ className }: Props) {
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
      <circle cx="24" cy="24" r="17" />
      <circle cx="24" cy="24" r="17" fill="currentColor" fillOpacity="0.08" stroke="none" />
      <path d="M24 10v2M24 36v2M10 24h2M36 24h2" />
      <path d="M24 24V14" strokeWidth={1.9} />
      <path d="M24 24l8 4" strokeWidth={1.9} />
      <circle cx="24" cy="24" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
