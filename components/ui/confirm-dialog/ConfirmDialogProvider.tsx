"use client";

import {
  createContext,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import type { ConfirmDialogOptions, ConfirmDialogResult } from "./types";

export interface ConfirmDialogContextValue {
  confirm: (options: ConfirmDialogOptions) => Promise<ConfirmDialogResult>;
}

export const ConfirmDialogContext =
  createContext<ConfirmDialogContextValue | null>(null);

/**
 * Mounts the single shared <ConfirmDialog> instance at the app root and
 * exposes the imperative `confirm(...)` API via context. Place once near
 * the top of the tree (typically inside the root layout, above the
 * routed children).
 */
export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);
  const resolverRef = useRef<((r: ConfirmDialogResult) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmDialogOptions) => {
    return new Promise<ConfirmDialogResult>((resolve) => {
      // If a previous dialog is still pending (rare — overlapping calls),
      // resolve it as cancelled so its caller doesn't hang forever.
      if (resolverRef.current) {
        resolverRef.current({ confirmed: false });
      }
      resolverRef.current = resolve;
      setOptions(opts);
    });
  }, []);

  const handleConfirm = useCallback((result: ConfirmDialogResult) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const handleCancel = useCallback(() => {
    resolverRef.current?.({ confirmed: false });
    resolverRef.current = null;
    setOptions(null);
  }, []);

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialog
        options={options}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmDialogContext.Provider>
  );
}
