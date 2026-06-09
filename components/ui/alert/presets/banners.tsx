"use client";

import type { ReactNode } from "react";
import { Button } from "../../Button";
import { Alert } from "../Alert";

/* ============================================================================
 *  TrialExpiryBanner
 *  Top-of-page warning banner for trial accounts. Days-remaining countdown
 *  + an upgrade CTA.
 * ========================================================================= */

export interface TrialExpiryBannerProps {
  daysRemaining: number;
  /** Heading. Caller supplies localised copy. */
  title: ReactNode;
  /** Body — typically explains what happens at expiry. */
  description?: ReactNode;
  /** CTA label, e.g. "Upgrade". */
  upgradeLabel: string;
  onUpgrade: () => void;
  /** Allow staff to dismiss the banner for the session. */
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export function TrialExpiryBanner({
  daysRemaining,
  title,
  description,
  upgradeLabel,
  onUpgrade,
  dismissible,
  onDismiss,
  className,
}: TrialExpiryBannerProps) {
  // < 3 days is urgent — flip to error variant.
  const urgent = daysRemaining <= 3;
  return (
    <Alert
      variant={urgent ? "error" : "warning"}
      size="md"
      title={title}
      description={description}
      actions={
        <Button variant={urgent ? "destructive" : "primary"} size="sm" onClick={onUpgrade}>
          {upgradeLabel}
        </Button>
      }
      dismissible={dismissible}
      onDismiss={onDismiss}
      className={className}
    />
  );
}

/* ============================================================================
 *  MaintenanceBanner
 *  Solid top-of-app strip for scheduled maintenance windows. Use `solid`
 *  appearance for full-bleed visibility.
 * ========================================================================= */

export interface MaintenanceBannerProps {
  /** Single-line message. */
  message: ReactNode;
  /** Optional severity. Default `"warning"`. */
  severity?: "info" | "warning" | "error";
  className?: string;
}

export function MaintenanceBanner({
  message,
  severity = "warning",
  className,
}: MaintenanceBannerProps) {
  return (
    <Alert
      variant={severity}
      size="sm"
      appearance="solid"
      title={message}
      role="status"
      ariaLive="polite"
      className={className}
    />
  );
}

/* ============================================================================
 *  FeatureAnnouncement
 *  Dismissible product news banner. Brand-tinted.
 * ========================================================================= */

export interface FeatureAnnouncementProps {
  title: ReactNode;
  description?: ReactNode;
  /** "Learn more" / "Try it" CTA. */
  actionLabel?: string;
  onAction?: () => void;
  /** Dismiss handler — caller persists the dismissal state. */
  onDismiss: () => void;
  className?: string;
}

export function FeatureAnnouncement({
  title,
  description,
  actionLabel,
  onAction,
  onDismiss,
  className,
}: FeatureAnnouncementProps) {
  return (
    <Alert
      variant="announcement"
      size="md"
      title={title}
      description={description}
      actions={
        actionLabel && onAction ? (
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : undefined
      }
      dismissible
      onDismiss={onDismiss}
      className={className}
    />
  );
}

/* ============================================================================
 *  PendingApprovalsBanner
 *  Section header strip used on the Expenses / Team pages to flag pending
 *  approvals. Carries an explicit count.
 * ========================================================================= */

export interface PendingApprovalsBannerProps {
  count: number;
  title: ReactNode;
  description?: ReactNode;
  /** Optional CTA (e.g. "Review all"). */
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function PendingApprovalsBanner({
  count,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: PendingApprovalsBannerProps) {
  return (
    <Alert
      variant="warning"
      size="md"
      title={
        <span className="inline-flex items-center gap-2">
          {title}
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-warning-100 px-1.5 text-xs font-semibold text-warning-700 ltr-numbers">
            {count}
          </span>
        </span>
      }
      description={description}
      actions={
        actionLabel && onAction ? (
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : undefined
      }
      className={className}
    />
  );
}
