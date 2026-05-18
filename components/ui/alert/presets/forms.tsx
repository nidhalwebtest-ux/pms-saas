"use client";

import type { ReactNode } from "react";
import { Alert } from "../Alert";

export interface FormErrorSummaryItem {
  /** Field id to anchor / focus on click. */
  fieldId?: string;
  /** Human-readable error message. */
  message: string;
}

export interface FormErrorSummaryProps {
  /** Heading shown above the list. Defaults to a generic prompt. */
  title?: ReactNode;
  /**
   * Either a single message string (renders as a one-liner) or a list of
   * field-keyed errors (renders as anchored list).
   */
  errors: string | FormErrorSummaryItem[];
  /** Focus the field on click. Default `true`. */
  focusOnClick?: boolean;
  className?: string;
}

/**
 * Form-level error summary. Use at the top of a form to consolidate
 * validation errors from a Server Action / async submit. Items render as
 * anchor links that focus their target field on click.
 *
 * Pair with `aria-describedby` on each form field for full coverage.
 */
export function FormErrorSummary({
  title = "Please fix the following before continuing",
  errors,
  focusOnClick = true,
  className,
}: FormErrorSummaryProps) {
  const isList = Array.isArray(errors);

  return (
    <Alert
      variant="error"
      size="md"
      title={title}
      className={className}
      description={
        isList ? (
          <ul className="mt-1 list-disc ps-5 space-y-0.5">
            {errors.map((err, i) => (
              <li key={err.fieldId ?? i}>
                {err.fieldId ? (
                  <a
                    href={`#${err.fieldId}`}
                    onClick={(e) => {
                      if (!focusOnClick || !err.fieldId) return;
                      const el = document.getElementById(err.fieldId);
                      if (el) {
                        e.preventDefault();
                        el.focus();
                        el.scrollIntoView({ block: "center", behavior: "smooth" });
                      }
                    }}
                    className="underline underline-offset-2 hover:text-error-700"
                  >
                    {err.message}
                  </a>
                ) : (
                  err.message
                )}
              </li>
            ))}
          </ul>
        ) : (
          errors
        )
      }
    />
  );
}
