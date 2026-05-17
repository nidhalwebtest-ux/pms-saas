interface Props {
  className?: string;
}

export function MailSuccessIllustration({ className }: Props) {
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
      <rect x="4" y="14" width="36" height="26" rx="2.5" />
      <path d="M4 17l18 12 18-12" />
      <circle cx="39" cy="11" r="7" fill="currentColor" fillOpacity="0.16" stroke="none" />
      <circle cx="39" cy="11" r="7" />
      <path d="M36 11l2 2 4.5-4.5" strokeWidth={1.9} />
    </svg>
  );
}
