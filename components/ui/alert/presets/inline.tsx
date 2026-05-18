"use client";

import type { ReactNode } from "react";
import { Button } from "../../Button";
import { Alert } from "../Alert";

/* ============================================================================
 *  PaymentRecorded
 *  Inline success confirmation shown on a payment / invoice page after a
 *  successful record. Not a toast — sticks around so the user can act on it
 *  (print receipt, view invoice).
 * ========================================================================= */

export interface PaymentRecordedProps {
  title: ReactNode;
  description?: ReactNode;
  /** Optional "View receipt" / "Print" CTA. */
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export function PaymentRecorded({
  title,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  dismissible,
  onDismiss,
  className,
}: PaymentRecordedProps) {
  const hasActions = (primaryLabel && onPrimary) || (secondaryLabel && onSecondary);
  return (
    <Alert
      variant="success"
      size="md"
      title={title}
      description={description}
      actions={
        hasActions ? (
          <>
            {primaryLabel && onPrimary && (
              <Button variant="primary" size="sm" onClick={onPrimary}>
                {primaryLabel}
              </Button>
            )}
            {secondaryLabel && onSecondary && (
              <Button variant="ghost" size="sm" onClick={onSecondary}>
                {secondaryLabel}
              </Button>
            )}
          </>
        ) : undefined
      }
      dismissible={dismissible}
      onDismiss={onDismiss}
      className={className}
    />
  );
}

/* ============================================================================
 *  NetworkErrorRetry
 *  Inline error block for failed data loads. One-click retry.
 * ========================================================================= */

export interface NetworkErrorRetryProps {
  title?: ReactNode;
  description?: ReactNode;
  retryLabel: string;
  onRetry: () => void;
  /** Pending state for the retry button. */
  retrying?: boolean;
  className?: string;
}

export function NetworkErrorRetry({
  title = "Couldn't load",
  description = "Check your connection and try again.",
  retryLabel,
  onRetry,
  retrying = false,
  className,
}: NetworkErrorRetryProps) {
  return (
    <Alert
      variant="error"
      size="md"
      title={title}
      description={description}
      actions={
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          loading={retrying}
        >
          {retryLabel}
        </Button>
      }
      className={className}
    />
  );
}

/* ============================================================================
 *  TenantBlacklistedWarning
 *  Banner shown on tenant / reservation flows when the tenant is on the
 *  blacklist. Should not be dismissible — staff need to see this every time.
 * ========================================================================= */

export interface TenantBlacklistedWarningProps {
  title: ReactNode;
  /** Reason recorded on the tenant. */
  reason?: ReactNode;
  /** Optional CTA to view tenant detail. */
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function TenantBlacklistedWarning({
  title,
  reason,
  actionLabel,
  onAction,
  className,
}: TenantBlacklistedWarningProps) {
  return (
    <Alert
      variant="error"
      size="md"
      title={title}
      description={reason}
      actions={
        actionLabel && onAction ? (
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : undefined
      }
      // Intentionally non-dismissible.
      role="alert"
      ariaLive="assertive"
      className={className}
    />
  );
}
