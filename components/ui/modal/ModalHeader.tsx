"use client";

import { DialogTitle } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "../Button";
import { useModalContext } from "./Modal";
import type { ModalHeaderProps, ModalTone } from "./types";

const toneClass: Record<ModalTone, string> = {
  default: "bg-surface border-b border-border-subtle",
  destructive: "bg-error-50 border-b border-error-200",
  success: "bg-success-50 border-b border-success-200",
};

export function ModalHeader({
  title,
  subtitle,
  icon,
  hideClose,
  children,
}: ModalHeaderProps) {
  const { onClose, tone, progress } = useModalContext();

  return (
    <header
      className={`relative ${toneClass[tone]} px-6 py-4 max-sm:px-4 ${
        progress ? "pt-5" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {icon && <div className="shrink-0">{icon}</div>}
        <div className="flex-1 min-w-0">
          {children ?? (
            <>
              {title && (
                <DialogTitle className="text-lg font-semibold text-fg leading-tight">
                  {title}
                </DialogTitle>
              )}
              {subtitle && (
                <p className="mt-0.5 text-sm text-fg-tertiary">{subtitle}</p>
              )}
            </>
          )}
        </div>
        {!hideClose && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            aria-label="Close"
            className="-me-2 -mt-1 shrink-0"
          >
            <XMarkIcon className="h-5 w-5" />
          </Button>
        )}
      </div>
    </header>
  );
}
