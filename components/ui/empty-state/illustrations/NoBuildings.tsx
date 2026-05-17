import React from "react";

interface NoBuildingsProps {
  className?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export function NoBuildings({
  className = "",
  primaryColor = "currentColor",
  secondaryColor = "currentColor",
}: NoBuildingsProps) {
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
      {/* Roof accent (renders under outline) */}
      <path
        d="M40 75L100 32L160 75Z"
        fill={secondaryColor} fillOpacity="0.14" stroke="none"
      />
      {/* Building outline with pitched roof */}
      <path d="M40 180V75L100 32L160 75V180" />
      {/* Ground line */}
      <path d="M20 180h160" />
      {/* Door */}
      <path d="M85 180V135a15 15 0 0 1 30 0V180" />
      {/* Door knob */}
      <circle cx="107" cy="160" r="3" fill={primaryColor} stroke="none" />
      {/* Windows */}
      <rect x="56" y="95" width="22" height="22" rx="2" strokeWidth={5} />
      <rect x="89" y="95" width="22" height="22" rx="2" strokeWidth={5} />
      <rect x="122" y="95" width="22" height="22" rx="2" strokeWidth={5} />
      {/* Lit window accent */}
      <rect
        x="122" y="95" width="22" height="22" rx="2"
        fill={secondaryColor} fillOpacity="0.22" stroke="none"
      />
    </svg>
  );
}
