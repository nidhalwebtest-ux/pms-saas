"use client";

import type { ReactNode } from "react";
import type { BaseFieldProps } from "./types";
import {
  messageRowBase,
  messageRowReserved,
  messageVariant,
} from "./inputStyles";

/**
 * FormField — the layout primitive every form atom composes through.
 * Owns the label, required-asterisk, helper/error rendering, and the
 * vertical rhythm. Atoms render their control as children and pass the
 * matching `messageId` so screen-readers can find the error.
 */
export interface FormFieldProps
  extends Pick<
    BaseFieldProps,
    | "label"
    | "helperText"
    | "error"
    | "required"
    | "showOptional"
    | "success"
    | "className"
    | "reserveMessageSpace"
  > {
  /** The DOM id of the inner control — wires `<label htmlFor>`. */
  id: string;

  /** The DOM id of the message row — wires the control's `aria-describedby`. */
  messageId: string;

  /** The rendered control (input, select, textarea, …). */
  children: ReactNode;

  /**
   * Optional adornment rendered to the end of the label row (e.g. a
   * `Max 5` counter or a "Forgot password?" link).
   */
  labelEnd?: ReactNode;
}

export function FormField({
  id,
  messageId,
  label,
  helperText,
  error,
  required,
  showOptional,
  success,
  className,
  reserveMessageSpace = true,
  labelEnd,
  children,
}: FormFieldProps) {
  const hasError = !!error;
  const errorMessage = typeof error === "string" ? error : null;
  const showMessageRow =
    reserveMessageSpace || hasError || helperText !== undefined;

  const variantCls = hasError
    ? messageVariant.error
    : success
    ? messageVariant.success
    : messageVariant.helper;

  return (
    <div className={className}>
      {/* Label row */}
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={id}
          className="text-[13px] font-medium text-fg leading-5"
        >
          {label}
          {required && (
            <span className="ms-0.5 text-error-500" aria-hidden="true">
              *
            </span>
          )}
          {showOptional && !required && (
            <span className="ms-1.5 text-xs text-fg-tertiary">optional</span>
          )}
        </label>
        {labelEnd && <span className="text-xs text-fg-tertiary">{labelEnd}</span>}
      </div>

      {/* Control */}
      <div className="mt-1">{children}</div>

      {/* Message row */}
      {showMessageRow && (
        <p
          id={messageId}
          role={hasError ? "alert" : undefined}
          className={`mt-1 ${messageRowBase} ${
            reserveMessageSpace ? messageRowReserved : ""
          } ${variantCls}`}
        >
          {errorMessage ?? helperText ?? " "}
        </p>
      )}
    </div>
  );
}
