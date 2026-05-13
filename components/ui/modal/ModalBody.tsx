"use client";

import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { Button } from "../Button";
import { Spinner } from "../Spinner";
import { useModalContext } from "./Modal";
import type { ModalBodyProps } from "./types";

export function ModalBody({
  children,
  noPadding,
  className = "",
}: ModalBodyProps) {
  const { loading, error, onRetry } = useModalContext();

  const padding = noPadding ? "" : "px-6 py-5 max-sm:px-4 max-sm:py-4";
  const baseScroll = "flex-1 overflow-y-auto overscroll-contain";

  if (loading) {
    return (
      <div
        className={`${baseScroll} ${padding} flex min-h-[240px] items-center justify-center ${className}`}
      >
        <span className="inline-flex items-center gap-2 text-sm text-fg-tertiary">
          <Spinner size={16} />
          <span>Loading…</span>
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`${baseScroll} ${padding} flex min-h-[240px] flex-col items-center justify-center gap-3 text-center ${className}`}
      >
        <ExclamationCircleIcon className="h-8 w-8 text-error-500" />
        <p className="max-w-xs text-sm text-fg-secondary">{error}</p>
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`${baseScroll} ${padding} ${className}`}>{children}</div>
  );
}
