interface Props {
  className?: string;
}

export function CheckmarkIllustration({ className }: Props) {
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
      <circle cx="24" cy="24" r="17" fill="currentColor" fillOpacity="0.14" stroke="none" />
      <circle cx="24" cy="24" r="17" />
      <path d="M15 24.5l6 6 12-13" strokeWidth={2} />
    </svg>
  );
}
