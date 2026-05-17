import React from "react";

interface NoUnitsProps {
  className?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export function NoUnits({
  className = "",
  primaryColor = "currentColor",
  secondaryColor = "currentColor",
}: NoUnitsProps) {
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
      {/* Floor / threshold line */}
      <path d="M30 175h140" />
      {/* Door frame */}
      <rect x="50" y="25" width="100" height="150" rx="4" />
      {/* Upper panel */}
      <rect x="65" y="40" width="70" height="55" rx="2" strokeWidth={5} />
      {/* Lower panel with accent */}
      <rect
        x="65" y="105" width="70" height="55" rx="2"
        fill={secondaryColor} fillOpacity="0.14" stroke="none"
      />
      <rect x="65" y="105" width="70" height="55" rx="2" strokeWidth={5} />
      {/* Door knob */}
      <circle cx="128" cy="100" r="4" fill={primaryColor} stroke="none" />
    </svg>
  );
}
