import React from "react";

interface ComingSoonProps {
  className?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export function ComingSoon({
  className = "",
  primaryColor = "currentColor",
  secondaryColor = "currentColor",
}: ComingSoonProps) {
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
      {/* Hourglass body */}
      <path d="M55 30H145V60L102 96V104L145 140V170H55V140L98 104V96L55 60Z" />
      {/* Top plate */}
      <path d="M40 28h120" />
      {/* Bottom plate */}
      <path d="M40 172h120" />
      {/* Sand top (draining) */}
      <path
        d="M68 36L132 36L100 78Z"
        fill={secondaryColor} fillOpacity="0.30" stroke="none"
      />
      {/* Sand bottom (filling) */}
      <path
        d="M72 164L128 164L100 128Z"
        fill={secondaryColor} fillOpacity="0.30" stroke="none"
      />
      {/* Falling grains */}
      <circle cx="100" cy="112" r="3.5" fill={primaryColor} stroke="none" />
      <circle cx="100" cy="122" r="2.5" fill={primaryColor} stroke="none" opacity="0.6" />
    </svg>
  );
}
