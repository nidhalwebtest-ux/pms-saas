import React from "react";

interface NoPaymentsProps {
  className?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export function NoPayments({
  className = "",
  primaryColor = "currentColor",
  secondaryColor = "currentColor",
}: NoPaymentsProps) {
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
      {/* Top coin face — tinted */}
      <ellipse
        cx="100" cy="85" rx="55" ry="14"
        fill={secondaryColor} fillOpacity="0.22"
      />
      <ellipse cx="100" cy="85" rx="55" ry="14" />
      {/* Side walls of cylinder stack */}
      <path d="M45 85v60" />
      <path d="M155 85v60" />
      {/* Front edges of stacked coins */}
      <path d="M45 115a55 14 0 0 0 110 0" />
      <path d="M45 145a55 14 0 0 0 110 0" />
      {/* Top-coin engraving */}
      <path d="M85 85h30" strokeWidth={4} opacity="0.55" />
    </svg>
  );
}
