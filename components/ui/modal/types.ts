import type { ReactNode } from "react";

/**
 * Modal size token. Width changes per variant — see `Modal.tsx` for the
 * sizing tables. Height is always capped at `min(85vh, 720px)` (capped at
 * the viewport for drawer variants).
 */
export type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

/**
 * Position + entry animation.
 * - `centered`: vertical center, scale-in. Default.
 * - `top-aligned`: 12vh from top, slide-down. Long forms with room to grow.
 * - `drawer-end`: pinned to the logical end edge (right in LTR, left in RTL).
 * - `drawer-start`: pinned to the logical start edge.
 * - `bottom-sheet`: pinned to the bottom, slide-up. Always full-width.
 *
 * Below the `sm` breakpoint, `centered` and `top-aligned` auto-convert to
 * a bottom-sheet via `fullScreenOnMobile`.
 */
export type ModalVariant =
  | "centered"
  | "top-aligned"
  | "drawer-end"
  | "drawer-start"
  | "bottom-sheet";

/**
 * Header tint. Drives the header background and border color.
 * - `default`: white / surface.
 * - `destructive`: error-50 header with error-200 border. Used by the
 *   destructive ConfirmDialog and the Reject expense modal.
 * - `success`: success-50 header. Used as a flash state after successful
 *   submission for ~1.2 s.
 */
export type ModalTone = "default" | "destructive" | "success";

export interface ModalProps {
  /** Whether the modal is mounted and open. */
  open: boolean;
  /** Called when the modal requests to close (backdrop / ESC / explicit close). */
  onClose: () => void;
  /** Sizing scale. Default `"md"`. */
  size?: ModalSize;
  /** Position + entry animation. Default `"centered"`. */
  variant?: ModalVariant;
  /** Header tint. Default `"default"`. */
  tone?: ModalTone;
  /** Disable backdrop click to close. Default `true`. */
  closeOnBackdrop?: boolean;
  /** Disable Escape key to close. Default `true`. */
  closeOnEsc?: boolean;
  /** Soft blur the page behind the backdrop. Default `false`. */
  backdropBlur?: boolean;
  /** Multi-step progress bar above the header. */
  progress?: { step: number; total: number };
  /**
   * On screens narrower than the `sm` breakpoint, centered / top-aligned
   * modals convert to a bottom-sheet that fills the screen width. Default
   * `true`. Set to `false` to keep the centered look on all widths.
   */
  fullScreenOnMobile?: boolean;
  /** Render to a specific portal container (default: document.body). */
  container?: HTMLElement;
  /** Async-load state — body renders a centered spinner. */
  loading?: boolean;
  /** Error message — body renders icon + message + optional Retry. */
  error?: string;
  /** Retry callback. When present and `error` is set, a Retry button shows. */
  onRetry?: () => void;
  /** Children — typically `<ModalHeader>` + `<ModalBody>` + `<ModalFooter>`. */
  children: ReactNode;
  /** Class on the outer panel element. */
  className?: string;
}

export interface ModalHeaderProps {
  /** Title — rendered as `<DialogTitle>` (auto-wires `aria-labelledby`). */
  title?: ReactNode;
  /** Subtitle under the title — wired to `aria-describedby` indirectly. */
  subtitle?: ReactNode;
  /** Optional icon slot before the title — e.g. a colored circle with a warning glyph. */
  icon?: ReactNode;
  /** Hide the close button (rare — multi-step flows requiring explicit nav). */
  hideClose?: boolean;
  /** Override `title` / `subtitle` with custom markup. */
  children?: ReactNode;
}

export interface ModalBodyProps {
  children: ReactNode;
  /** Drop the default `px-6 py-5` padding (media viewers, full-bleed). */
  noPadding?: boolean;
  className?: string;
}

export interface ModalFooterProps {
  children: ReactNode;
  /** Sticky to the bottom of the panel during body scroll. Default `true`. */
  sticky?: boolean;
  /**
   * Horizontal alignment of footer children. Default `"end"`.
   * - `end`: right in LTR, left in RTL. Cancel-then-Confirm convention.
   * - `between`: secondary on start, primary on end (multi-step Back/Continue).
   * - `start`: left in LTR, right in RTL.
   */
  justify?: "end" | "between" | "start";
  className?: string;
}
