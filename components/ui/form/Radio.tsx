"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import type { FieldSize } from "./types";
import { useFieldA11y } from "./useFieldA11y";

type NativeRadioProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size" | "id" | "name" | "disabled" | "required" | "type"
>;

export interface RadioProps extends NativeRadioProps {
  /** Visible label rendered to the end side of the dot. */
  label: ReactNode;
  /** Optional helper text rendered below the label. */
  description?: ReactNode;
  /** Error tint on the dot border. */
  error?: string | boolean;
  /** Disabled. */
  disabled?: boolean;
  /** Sizing — only the label scales; the dot is fixed at 18 px. */
  size?: FieldSize;
  /** Stable id. */
  id?: string;
  /** Form name (required for radio groups). */
  name?: string;
  /** Outer label wrapper class. */
  className?: string;
}

const labelSize: Record<FieldSize, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-md",
};

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  {
    label,
    description,
    error,
    disabled,
    size = "md",
    id: idProp,
    name,
    className = "",
    checked,
    defaultChecked,
    onChange,
    value,
    ...rest
  },
  ref,
) {
  const { id, messageId, inputAriaProps } = useFieldA11y({
    id: idProp,
    error,
    helperText: description,
  });
  const hasError = !!error;

  return (
    <label
      htmlFor={id}
      className={`group inline-flex items-start gap-2.5 ${
        disabled ? "cursor-not-allowed" : "cursor-pointer"
      } ${className}`}
    >
      <span className="relative mt-0.5 inline-flex h-[18px] w-[18px] shrink-0">
        <input
          ref={ref}
          type="radio"
          name={name}
          value={value}
          disabled={disabled}
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={onChange}
          className={`peer h-[18px] w-[18px] appearance-none rounded-full border bg-surface
            ${hasError ? "border-error-500" : "border-border-strong"}
            checked:border-brand-500
            focus-visible:outline-none focus-visible:shadow-focus
            disabled:bg-subtle disabled:border-border-subtle disabled:cursor-not-allowed
            transition-colors duration-fast ease-out`}
          {...inputAriaProps}
          {...rest}
        />
        {/* Inner dot — visible only when :checked */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 m-auto h-2 w-2 rounded-full bg-brand-500 opacity-0 transition-opacity duration-fast ease-out peer-checked:opacity-100"
        />
      </span>

      <span className="flex flex-col">
        <span
          className={`${labelSize[size]} leading-tight ${
            disabled ? "text-fg-disabled" : "text-fg"
          }`}
        >
          {label}
        </span>
        {description && (
          <span
            id={messageId}
            className={`mt-0.5 text-xs leading-snug ${
              hasError ? "text-error-600" : "text-fg-tertiary"
            }`}
          >
            {typeof error === "string" ? error : description}
          </span>
        )}
      </span>
    </label>
  );
});
