"use client";

import { type ReactNode } from "react";
import { messageRowBase, messageRowReserved, messageVariant } from "./inputStyles";

export interface CheckboxGroupProps {
  /** Visible group label rendered as a `<legend>`. */
  label: ReactNode;
  /** Helper text shown below the group. Hidden when `error` is present. */
  helperText?: ReactNode;
  /** Error message rendered in the message row. */
  error?: string | boolean;
  /** Visual asterisk + aria-required on the fieldset. */
  required?: boolean;
  /** Renders the word "optional" next to the label. */
  showOptional?: boolean;
  /** Disable the entire group. */
  disabled?: boolean;
  /** Layout direction for the children Checkboxes. Default: vertical. */
  direction?: "vertical" | "horizontal";
  /** Outer wrapper class. */
  className?: string;
  /** Reserve message-row height. Default true. */
  reserveMessageSpace?: boolean;
  /** Children — Checkbox atoms. */
  children: ReactNode;
}

export function CheckboxGroup({
  label,
  helperText,
  error,
  required,
  showOptional,
  disabled,
  direction = "vertical",
  className,
  reserveMessageSpace = true,
  children,
}: CheckboxGroupProps) {
  const hasError = !!error;
  const errorMessage = typeof error === "string" ? error : null;
  const variantCls = hasError ? messageVariant.error : messageVariant.helper;
  const showMessageRow = reserveMessageSpace || hasError || helperText !== undefined;

  return (
    <fieldset
      disabled={disabled}
      aria-required={required || undefined}
      aria-invalid={hasError || undefined}
      className={className}
    >
      <legend className="text-[13px] font-medium text-fg leading-5">
        {label}
        {required && (
          <span className="ms-0.5 text-error-500" aria-hidden="true">
            *
          </span>
        )}
        {showOptional && !required && (
          <span className="ms-1.5 text-xs text-fg-tertiary">optional</span>
        )}
      </legend>

      <div
        className={`mt-2 ${
          direction === "vertical" ? "flex flex-col gap-2" : "flex flex-wrap gap-x-5 gap-y-2"
        }`}
      >
        {children}
      </div>

      {showMessageRow && (
        <p
          role={hasError ? "alert" : undefined}
          className={`mt-1 ${messageRowBase} ${
            reserveMessageSpace ? messageRowReserved : ""
          } ${variantCls}`}
        >
          {errorMessage ?? helperText ?? " "}
        </p>
      )}
    </fieldset>
  );
}
