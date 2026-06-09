"use client";

import { useId, type ReactNode } from "react";

/**
 * Centralizes the aria wiring every form field needs: a stable id, a
 * matching message id (for helper/error), and the `aria-invalid` /
 * `aria-describedby` props for the input element.
 *
 * Pass `id` (optional) — when omitted, useId() generates a stable one.
 * Returns props ready to spread onto the input + the message-row id for
 * the FormField wrapper.
 */
export function useFieldA11y(opts: {
  id?: string;
  error?: string | boolean;
  helperText?: ReactNode;
  required?: boolean;
}) {
  const generatedId = useId();
  const id = opts.id ?? generatedId;
  const messageId = `${id}-message`;
  const hasError = !!opts.error;
  const hasMessage = hasError || !!opts.helperText;

  return {
    id,
    messageId,
    hasError,
    hasMessage,
    /** Spread onto the input/select/textarea element. */
    inputAriaProps: {
      id,
      "aria-invalid": hasError || undefined,
      "aria-describedby": hasMessage ? messageId : undefined,
      "aria-required": opts.required || undefined,
    },
  };
}
