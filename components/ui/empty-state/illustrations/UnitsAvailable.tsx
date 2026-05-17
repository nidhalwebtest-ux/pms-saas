import React from "react";

interface UnitsAvailableProps {
  className?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export function UnitsAvailable({
  className = "",
  primaryColor = "currentColor",
  secondaryColor = "currentColor",
}: UnitsAvailableProps) {
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
      {/* Key bow — tinted */}
      <circle
        cx="60" cy="110" r="32"
        fill={secondaryColor} fillOpacity="0.14"
      />
      <circle cx="60" cy="110" r="32" />
      {/* Keyhole */}
      <circle cx="60" cy="110" r="10" strokeWidth={5} />
      {/* Shaft */}
      <path d="M92 110h83" />
      {/* Teeth */}
      <path d="M140 110v22" />
      <path d="M165 110v17" />
      {/* Sparkle (top-right) */}
      <path
        d="M158 32c0 8 4.5 12.5 12.5 12.5C162.5 44.5 158 49 158 57c0-8-4.5-12.5-12.5-12.5C153.5 44.5 158 40 158 32Z"
        strokeWidth={4} fill={secondaryColor} fillOpacity="0.25"
      />
    </svg>
  );
}
