interface Props {
  className?: string;
}

export function SparklesIllustration({ className }: Props) {
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
      <path
        d="M22 9c0 7 4 11 11 11-7 0-11 4-11 11 0-7-4-11-11-11 7 0 11-4 11-11z"
        fill="currentColor"
        fillOpacity="0.14"
      />
      <path d="M37 11c0 3 1.5 4.5 4 4.5-2.5 0-4 1.5-4 4.5 0-3-1.5-4.5-4-4.5 2.5 0 4-1.5 4-4.5z" />
      <path d="M36 33c0 2.5 1.2 3.7 3.5 3.7-2.3 0-3.5 1.2-3.5 3.8 0-2.6-1.2-3.8-3.5-3.8 2.3 0 3.5-1.2 3.5-3.7z" />
    </svg>
  );
}
