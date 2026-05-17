import React from "react";

interface NoTenantsProps {
  className?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export function NoTenants({
  className = "",
  primaryColor = "currentColor",
  secondaryColor = "currentColor",
}: NoTenantsProps) {
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
      {/* Head — tinted fill */}
      <circle
        cx="100" cy="70" r="28"
        fill={secondaryColor} fillOpacity="0.14"
      />
      <circle cx="100" cy="70" r="28" />
      {/* Shoulders / body arc */}
      <path d="M37 175c10-30 32-45 63-45s53 15 63 45" />
    </svg>
  );
}
