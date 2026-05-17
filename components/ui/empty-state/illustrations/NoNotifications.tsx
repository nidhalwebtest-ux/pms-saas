import React from "react";

interface NoNotificationsProps {
  className?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export function NoNotifications({
  className = "",
  primaryColor = "currentColor",
  secondaryColor = "currentColor",
}: NoNotificationsProps) {
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
      {/* Bell body — tinted */}
      <path
        d="M100 32C72 32 60 58 60 90V125C60 138 55 145 47 150H153C145 145 140 138 140 125V90C140 58 128 32 100 32Z"
        fill={secondaryColor} fillOpacity="0.12"
      />
      <path d="M100 32C72 32 60 58 60 90V125C60 138 55 145 47 150H153C145 145 140 138 140 125V90C140 58 128 32 100 32Z" />
      {/* Top knob */}
      <circle cx="100" cy="26" r="6" fill={primaryColor} stroke="none" />
      {/* Clapper / ringer */}
      <path d="M85 160c0 10 7 18 15 18s15-8 15-18" />
      {/* Sleeping Z indicator */}
      <path
        d="M158 55h16l-16 16h16"
        strokeWidth={4} opacity="0.55"
      />
    </svg>
  );
}
