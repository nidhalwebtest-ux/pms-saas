import React from "react";

interface NoSearchResultsProps {
  className?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export function NoSearchResults({
  className = "",
  primaryColor = "currentColor",
  secondaryColor = "currentColor",
}: NoSearchResultsProps) {
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
      {/* Glass — tinted */}
      <circle
        cx="85" cy="85" r="55"
        fill={secondaryColor} fillOpacity="0.10"
      />
      <circle cx="85" cy="85" r="55" />
      {/* Handle */}
      <path d="M125 125l45 45" strokeWidth={8} />
      {/* Question mark inside glass */}
      <path
        d="M73 73a12 12 0 1 1 14 18v6"
        strokeWidth={6}
      />
      <circle cx="87" cy="113" r="3.5" fill={primaryColor} stroke="none" />
    </svg>
  );
}
