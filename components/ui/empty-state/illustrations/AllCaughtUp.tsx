import React from "react";

interface AllCaughtUpProps {
  className?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export function AllCaughtUp({
  className = "",
  primaryColor = "currentColor",
  secondaryColor = "currentColor",
}: AllCaughtUpProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      stroke={primaryColor}
      strokeWidth={6}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Envelope body — tinted */}
      <rect
        x="20" y="70" width="135" height="100" rx="6"
        fill={secondaryColor} fillOpacity="0.08"
      />
      <rect x="20" y="70" width="135" height="100" rx="6" />
      {/* Flap V */}
      <path d="M20 78L87.5 130L155 78" />
      {/* Check badge top-right */}
      <circle
        cx="160" cy="55" r="30"
        fill={secondaryColor} fillOpacity="0.22"
      />
      <circle cx="160" cy="55" r="30" />
      {/* Check mark */}
      <path d="M146 57l10 10l20-22" strokeWidth={7} />
    </svg>
  );
}
