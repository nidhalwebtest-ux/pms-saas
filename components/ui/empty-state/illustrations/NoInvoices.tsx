import React from "react";

interface NoInvoicesProps {
  className?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export function NoInvoices({
  className = "",
  primaryColor = "currentColor",
  secondaryColor = "currentColor",
}: NoInvoicesProps) {
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
      {/* Receipt body with torn zigzag bottom */}
      <path
        d="M50 25H150V158L138 175L125 158L113 175L100 158L87 175L75 158L62 175L50 158Z"
        fill={secondaryColor} fillOpacity="0.08"
      />
      <path d="M50 25H150V158L138 175L125 158L113 175L100 158L87 175L75 158L62 175L50 158Z" />
      {/* Item lines */}
      <path d="M70 60h60" strokeWidth={5} />
      <path d="M70 85h60" strokeWidth={5} />
      <path d="M70 110h45" strokeWidth={5} />
      {/* Total label */}
      <path d="M70 138h22" strokeWidth={5} />
      {/* Paid check */}
      <path d="M110 138l7 7l14-15" strokeWidth={6} />
    </svg>
  );
}
