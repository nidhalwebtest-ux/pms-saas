import React from "react";

interface NoReservationsProps {
  className?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export function NoReservations({
  className = "",
  primaryColor = "currentColor",
  secondaryColor = "currentColor",
}: NoReservationsProps) {
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
      {/* Calendar body */}
      <rect x="25" y="46" width="150" height="134" rx="13" />
      {/* Header divider */}
      <path d="M25 80h150" />
      {/* Binding rings */}
      <path d="M63 28v34M137 28v34" />
      {/* Highlighted "today" cell */}
      <rect
        x="91" y="120" width="32" height="32" rx="6"
        fill={secondaryColor} fillOpacity="0.18" stroke="none"
      />
      {/* Day dots */}
      <g fill={primaryColor} stroke="none">
        <circle cx="59" cy="107" r="4" />
        <circle cx="84" cy="107" r="4" />
        <circle cx="109" cy="107" r="4" />
        <circle cx="134" cy="107" r="4" />
        <circle cx="59" cy="136" r="4" />
        <circle cx="84" cy="136" r="4" />
        <circle cx="107" cy="136" r="5.5" />
        <circle cx="59" cy="165" r="4" />
        <circle cx="84" cy="165" r="4" />
      </g>
    </svg>
  );
}
