"use client";

import { useContext } from "react";
import { ConfirmDialogContext } from "./ConfirmDialogProvider";
import type { ConfirmDialogOptions, ConfirmDialogResult } from "./types";

/**
 * Imperative confirm API. Returns an async function that opens the shared
 * <ConfirmDialog>, awaits the user's choice, and resolves to
 * `{ confirmed, reason?, notes? }`.
 *
 * Requires <ConfirmDialogProvider> to be mounted somewhere above the
 * consumer.
 *
 * @example
 *   const confirm = useConfirmDialog();
 *   const { confirmed } = await confirm({
 *     title: "Delete expense?",
 *     description: "This cannot be undone.",
 *     tone: "destructive",
 *     confirmLabel: "Delete",
 *   });
 *   if (confirmed) await deleteExpense(id);
 */
export function useConfirmDialog(): (
  options: ConfirmDialogOptions,
) => Promise<ConfirmDialogResult> {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    throw new Error(
      "useConfirmDialog() requires <ConfirmDialogProvider> at the app root",
    );
  }
  return ctx.confirm;
}
