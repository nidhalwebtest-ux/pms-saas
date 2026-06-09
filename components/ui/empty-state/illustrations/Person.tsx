interface Props {
  className?: string;
}

export function PersonIllustration({ className }: Props) {
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
      <circle cx="24" cy="17" r="7" />
      <path d="M9 41c2-7.5 8-11.5 15-11.5s13 4 15 11.5" />
      <circle cx="24" cy="17" r="7" fill="currentColor" fillOpacity="0.12" stroke="none" />
      <path d="M9 41h30" strokeWidth={1.4} opacity="0.5" />
    </svg>
  );
}
