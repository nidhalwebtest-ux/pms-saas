"use client";

import type { ModalFooterProps } from "./types";

const justifyClass = {
  end: "justify-end",
  between: "justify-between",
  start: "justify-start",
} as const;

export function ModalFooter({
  children,
  sticky = true,
  justify = "end",
  className = "",
}: ModalFooterProps) {
  return (
    <footer
      className={`flex items-center gap-2 border-t border-border-subtle bg-surface px-6 py-4 max-sm:px-4 ${
        justifyClass[justify]
      } ${sticky ? "sticky bottom-0" : ""} ${className}`}
    >
      {children}
    </footer>
  );
}
