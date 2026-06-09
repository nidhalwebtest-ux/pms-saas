interface Props {
  className?: string;
}

export function BuildingIllustration({ className }: Props) {
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
      <path d="M9 43V15l15-8 15 8v28" />
      <path d="M4 43h40" />
      <path d="M20 43V32h8v11" />
      <rect x="13" y="21" width="5" height="5" rx="0.6" />
      <rect x="30" y="21" width="5" height="5" rx="0.6" />
      <rect x="21" y="21" width="6" height="5" rx="0.6" />
      <rect x="30" y="21" width="5" height="5" rx="0.6" fill="currentColor" fillOpacity="0.18" stroke="none" />
      <path d="M24 36v3" strokeWidth={1.4} />
      <circle cx="26" cy="37.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
