import React from "react";

interface NoActivityProps {
  className?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export function NoActivity({
  className = "",
  primaryColor = "currentColor",
  secondaryColor = "currentColor",
}: NoActivityProps) {
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
      {/* Clock face — tinted */}
      <circle
        cx="100" cy="100" r="70"
        fill={secondaryColor} fillOpacity="0.08"
      />
      <circle cx="100" cy="100" r="70" />
      {/* Hour markers */}
      <path d="M100 40v8M100 152v8M40 100h8M152 100h8" />
      {/* Hour hand */}
      <path d="M100 100V60" strokeWidth={8} />
      {/* Minute hand */}
      <path d="M100 100l32 16" strokeWidth={7} />
      {/* Center pin */}
      <circle cx="100" cy="100" r="6" fill={primaryColor} stroke="none" />
    </svg>
  );
}
