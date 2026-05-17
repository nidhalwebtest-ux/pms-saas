interface Props {
  className?: string;
}

export function ReceiptIllustration({ className }: Props) {
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
      <path d="M11 5h26v38l-3.25-2.5L30.5 43l-3.25-2.5L24 43l-3.25-2.5L17.5 43l-3.25-2.5L11 43z" />
      <path d="M16 14h16M16 20h16M16 26h11" />
      <path d="M16 33h6" />
      <path d="M27 33.5l2 2 4.5-4.5" strokeWidth={1.9} />
    </svg>
  );
}
