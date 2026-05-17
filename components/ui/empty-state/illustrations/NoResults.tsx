import React from "react";

interface NoResultsProps {
  className?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export function NoResults({
  className = "",
  primaryColor = "currentColor",
  secondaryColor = "currentColor",
}: NoResultsProps) {
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
      {/* Glass — tinted fill */}
      <circle
        cx="85" cy="85" r="55"
        fill={secondaryColor} fillOpacity="0.08"
      />
      <circle cx="85" cy="85" r="55" />
      {/* Handle */}
      <path d="M125 125l45 45" strokeWidth={8} />
      {/* Dashed empty-zone indicator inside glass */}
      <circle
        cx="85" cy="85" r="28"
        strokeWidth={5} strokeDasharray="6 10" opacity="0.55"
      />
      {/* Hint stroke through middle */}
      <path d="M67 85h36" strokeWidth={5} opacity="0.7" />
    </svg>
  );
}
