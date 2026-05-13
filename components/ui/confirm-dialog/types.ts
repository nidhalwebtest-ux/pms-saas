import type { ReactNode } from "react";

/**
 * Visual + behavioral intent.
 * - `destructive`: irreversible action (delete, cancel reservation). Red header tint, red icon, destructive button.
 * - `warning`:     reversible-but-serious (no-show, archive). Default header, amber icon, destructive button.
 * - `info`:        informational confirm (restore, publish). Default header, brand icon, primary button.
 * - `default`:     neutral. No header icon, primary button.
 */
export type ConfirmDialogTone = "default" | "destructive" | "warning" | "info";

export interface ConfirmDialogReasonOption {
  value: string;
  label: string;
}

export interface ConfirmDialogReasonConfig {
  /** Reason dropdown options. */
  options: ConfirmDialogReasonOption[];
  /** Field label. Default: "Reason". */
  label?: string;
  /** Placeholder option text. Default: "Select a reason…". */
  placeholder?: string;
  /**
   * Reasons that reveal an optional notes textarea. Implied by `notesRequiredFor`.
   */
  notesFor?: string[];
  /**
   * Reasons that make the notes textarea required (and reveal it).
   */
  notesRequiredFor?: string[];
  /** Notes field label. Default: "Notes". */
  notesLabel?: string;
  /** Notes field placeholder. */
  notesPlaceholder?: string;
}

export interface ConfirmDialogTypeToConfirmConfig {
  /** The literal string the user must type to enable the confirm button. */
  value: string;
  /** Field label. Default: `Type ${value} to confirm`. */
  label?: string;
}

export interface ConfirmDialogResult {
  /** True if the user clicked confirm (and any async work succeeded). */
  confirmed: boolean;
  /** Reason value if a reason field was shown and selected. */
  reason?: string;
  /** Trimmed notes if a notes textarea was shown and filled. */
  notes?: string;
}

export interface ConfirmDialogOptions {
  /** Title — appears in ModalHeader as the DialogTitle. */
  title: ReactNode;
  /** Short description under the title. Plain prose, no formatting needed. */
  description?: ReactNode;
  /** Visual intent. Default `"default"`. */
  tone?: ConfirmDialogTone;
  /** Primary action button label. Default "Confirm". */
  confirmLabel?: string;
  /** Cancel button label. Default "Cancel". */
  cancelLabel?: string;
  /** Reason / notes block. Omit for a plain yes/no dialog. */
  reason?: ConfirmDialogReasonConfig;
  /** Type-to-confirm input. Omit for a plain yes/no dialog. */
  typeToConfirm?: ConfirmDialogTypeToConfirmConfig;
  /**
   * Extra body slot rendered between the description and the reason/notes
   * fields. Use for inline warnings (e.g. "Total refund: 250.000 OMR").
   */
  body?: ReactNode;
  /** Hide the Cancel button — for one-button "OK" dialogs. Default false. */
  hideCancel?: boolean;
  /**
   * Optional async work to run while the dialog shows a loading state.
   * - If provided: dialog stays open with a loading spinner until this
   *   resolves, then closes. If it throws, the dialog closes and the
   *   returned promise resolves with `{ confirmed: false }` — the caller
   *   is expected to surface errors (toast) inside `onConfirm` before
   *   re-throwing.
   * - If omitted: dialog closes as soon as the user clicks confirm and
   *   the returned promise resolves immediately with `{ confirmed: true, … }`.
   */
  onConfirm?: (result: { reason?: string; notes?: string }) => void | Promise<void>;
}
