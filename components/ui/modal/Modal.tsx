"use client";

import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
} from "@headlessui/react";
import type {
  ModalProps,
  ModalSize,
  ModalTone,
  ModalVariant,
} from "./types";

/* ----------------------------------------------------------------------------
 *  Context — lets sub-components (Header, Body) read modal-level state.
 * ------------------------------------------------------------------------- */

interface ModalContextValue {
  onClose: () => void;
  size: ModalSize;
  variant: ModalVariant;
  tone: ModalTone;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  progress?: { step: number; total: number };
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function useModalContext(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error(
      "<ModalHeader> / <ModalBody> / <ModalFooter> must be used inside <Modal>",
    );
  }
  return ctx;
}

/* ----------------------------------------------------------------------------
 *  Size tables — sheet (centered / top-aligned) vs drawer.
 * ------------------------------------------------------------------------- */

const sheetWidth: Record<ModalSize, string> = {
  sm: "w-[480px] max-w-[calc(100vw-32px)]",
  md: "w-[640px] max-w-[calc(100vw-32px)]",
  lg: "w-[768px] max-w-[calc(100vw-32px)]",
  xl: "w-[1024px] max-w-[calc(100vw-32px)]",
  full: "w-[min(90vw,1280px)]",
};

const drawerWidth: Record<ModalSize, string> = {
  sm: "w-[380px]",
  md: "w-[480px]",
  lg: "w-[640px]",
  xl: "w-[800px]",
  full: "w-[min(95vw,1280px)]",
};

/* ----------------------------------------------------------------------------
 *  Panel position + entry/exit transition per variant.
 *  Uses Headless UI v2 data-state attributes (data-closed, data-enter).
 * ------------------------------------------------------------------------- */

const panelByVariant: Record<ModalVariant, string> = {
  centered:
    "rounded-xl my-auto " +
    "data-[closed]:opacity-0 data-[closed]:scale-95 " +
    "transition duration-fast ease-out",
  "top-aligned":
    "rounded-xl mt-[12vh] mb-auto " +
    "data-[closed]:opacity-0 data-[closed]:-translate-y-4 " +
    "transition duration-fast ease-out",
  "drawer-end":
    "rounded-s-xl rounded-e-none h-full max-h-screen " +
    "data-[closed]:translate-x-full rtl:data-[closed]:-translate-x-full " +
    "transition-transform duration-medium ease-out",
  "drawer-start":
    "rounded-e-xl rounded-s-none h-full max-h-screen " +
    "data-[closed]:-translate-x-full rtl:data-[closed]:translate-x-full " +
    "transition-transform duration-medium ease-out",
  "bottom-sheet":
    "rounded-t-2xl rounded-b-none mt-auto w-full max-w-none " +
    "data-[closed]:translate-y-full " +
    "transition-transform duration-medium ease-out",
};

/**
 * Mobile auto-convert: at < sm breakpoint, sheet variants (centered /
 * top-aligned) become bottom-sheets so phones get a usable layout.
 */
const mobileSheetOverride =
  "max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:w-full max-sm:max-w-none " +
  "max-sm:mt-auto max-sm:mb-0 max-sm:data-[closed]:scale-100 " +
  "max-sm:data-[closed]:translate-y-full max-sm:data-[closed]:opacity-100";

/* ----------------------------------------------------------------------------
 *  Outer flex container that positions the panel inside the viewport.
 * ------------------------------------------------------------------------- */

const containerByVariant: Record<ModalVariant, string> = {
  centered:
    "fixed inset-0 z-50 flex items-center justify-center p-4 " +
    "max-sm:items-end max-sm:p-0",
  "top-aligned":
    "fixed inset-0 z-50 flex items-start justify-center p-4 " +
    "max-sm:items-end max-sm:p-0",
  "drawer-end": "fixed inset-0 z-50 flex justify-end",
  "drawer-start": "fixed inset-0 z-50 flex justify-start",
  "bottom-sheet": "fixed inset-0 z-50 flex items-end",
};

/* ----------------------------------------------------------------------------
 *  Component
 * ------------------------------------------------------------------------- */

export function Modal({
  open,
  onClose,
  size = "md",
  variant = "centered",
  tone = "default",
  closeOnBackdrop = true,
  closeOnEsc = true,
  backdropBlur = false,
  progress,
  fullScreenOnMobile = true,
  loading,
  error,
  onRetry,
  children,
  className = "",
}: ModalProps) {
  // ESC suppression — when closeOnEsc=false, stop Escape before HUI sees it.
  useEffect(() => {
    if (closeOnEsc || !open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () =>
      document.removeEventListener("keydown", handler, true);
  }, [closeOnEsc, open]);

  // Headless UI fires `onClose` for both backdrop click and ESC. If
  // closeOnBackdrop=false, swap the handler with a no-op — but keep ESC
  // working via the close button + the user's own state.
  const effectiveOnClose = closeOnBackdrop ? onClose : () => {};

  const isSheet = variant === "centered" || variant === "top-aligned";
  const sizeCls = variant === "bottom-sheet"
    ? "w-full max-w-none"
    : variant.startsWith("drawer-")
    ? drawerWidth[size]
    : sheetWidth[size];

  const panelCls = [
    "relative flex flex-col bg-surface text-fg shadow-2xl focus:outline-none",
    isSheet ? "max-h-[min(85vh,720px)]" : "",
    sizeCls,
    panelByVariant[variant],
    isSheet && fullScreenOnMobile ? mobileSheetOverride : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const backdropCls = [
    "fixed inset-0 bg-black/45",
    backdropBlur ? "backdrop-blur-sm" : "",
    "data-[closed]:opacity-0 transition-opacity duration-fast ease-out",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <ModalContext.Provider
      value={{
        onClose,
        size,
        variant,
        tone,
        loading,
        error,
        onRetry,
        progress,
      }}
    >
      <Dialog
        open={open}
        onClose={effectiveOnClose}
        transition
        className="relative z-50"
      >
        <DialogBackdrop transition className={backdropCls} />
        <div className={containerByVariant[variant]}>
          <DialogPanel transition className={panelCls}>
            {progress && (
              <div
                className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-brand-100 rounded-t-xl"
                aria-hidden="true"
              >
                <div
                  className="h-full bg-brand-500 transition-all duration-medium ease-out"
                  style={{
                    width: `${Math.min(100, Math.max(0, (progress.step / progress.total) * 100))}%`,
                  }}
                />
              </div>
            )}
            {children}
          </DialogPanel>
        </div>
      </Dialog>
    </ModalContext.Provider>
  );
}
