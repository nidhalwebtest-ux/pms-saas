import React from "react";

interface NoExpensesProps {
  className?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export function NoExpenses({
  className = "",
  primaryColor = "currentColor",
  secondaryColor = "currentColor",
}: NoExpensesProps) {
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
      {/* Card peeking out */}
      <rect
        x="55" y="40" width="85" height="22" rx="3"
        fill={secondaryColor} fillOpacity="0.22"
      />
      <rect x="55" y="40" width="85" height="22" rx="3" />
      <path d="M63 55h28" strokeWidth={3} opacity="0.6" />
      {/* Wallet body — tinted */}
      <rect
        x="25" y="60" width="150" height="105" rx="8"
        fill={secondaryColor} fillOpacity="0.10"
      />
      <rect x="25" y="60" width="150" height="105" rx="8" />
      {/* Fold seam */}
      <path d="M25 112h150" strokeWidth={5} />
      {/* Clasp */}
      <circle cx="160" cy="112" r="5" fill={primaryColor} stroke="none" />
    </svg>
  );
}
