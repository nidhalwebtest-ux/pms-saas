"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import type { FieldSize } from "./types";
import { useFieldA11y } from "./useFieldA11y";

type NativeCheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size" | "id" | "name" | "disabled" | "required" | "type"
>;

export interface CheckboxProps extends NativeCheckboxProps {
  /** Visible label rendered to the end side of the box. */
  label: ReactNode;
  /** Optional helper text rendered below the label. */
  description?: ReactNode;
  /** Error tint on the box border. */
  error?: string | boolean;
  /** Show indeterminate visual (master-checkbox-of-group case). */
  indeterminate?: boolean;
  /** Required attribute + visual asterisk. */
  required?: boolean;
  /** Disabled. */
  disabled?: boolean;
  /** Sizing — only the label scales; the box is fixed at 18 px. */
  size?: FieldSize;
  /** Stable id; auto-generated via useId() when omitted. */
  id?: string;
  /** Form name. */
  name?: string;
  /** Extra class on the outer label wrapper. */
  className?: string;
}

const labelSize: Record<FieldSize, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-md",
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    {
      label,
      description,
      error,
      indeterminate,
      required,
      disabled,
      size = "md",
      id: idProp,
      name,
      className = "",
      checked,
      defaultChecked,
      onChange,
      ...rest
    },
    ref,
  ) {
    const innerRef = useRef<HTMLInputElement | null>(null);
    const setRefs = (node: HTMLInputElement | null) => {
      innerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
    };

    useEffect(() => {
      if (innerRef.current) innerRef.current.indeterminate = !!indeterminate;
    }, [indeterminate]);

    const { id, messageId, inputAriaProps } = useFieldA11y({
      id: idProp,
      error,
      helperText: description,
      required,
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
            ref={setRefs}
            type="checkbox"
            name={name}
            disabled={disabled}
            required={required}
            checked={checked}
            defaultChecked={defaultChecked}
            onChange={onChange}
            className={`peer h-[18px] w-[18px] appearance-none rounded-sm border bg-surface
              ${hasError ? "border-error-500" : "border-border-strong"}
              checked:border-brand-500 checked:bg-brand-500
              indeterminate:border-brand-500 indeterminate:bg-brand-500
              focus-visible:outline-none focus-visible:shadow-focus
              disabled:bg-subtle disabled:border-border-subtle disabled:cursor-not-allowed
              transition-colors duration-fast ease-out`}
            {...inputAriaProps}
            {...rest}
          />
          {/* Check icon — visible when :checked */}
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white opacity-0 transition-opacity duration-fast ease-out peer-checked:opacity-100 peer-indeterminate:opacity-0"
          >
            <path
              d="M3 8.5l3 3 7-7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          {/* Indeterminate dash — visible only when :indeterminate */}
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white opacity-0 transition-opacity duration-fast ease-out peer-indeterminate:opacity-100"
          >
            <path
              d="M3.5 8h9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </span>

        <span className="flex flex-col">
          <span
            className={`${labelSize[size]} leading-tight ${
              disabled ? "text-fg-disabled" : "text-fg"
            }`}
          >
            {label}
            {required && (
              <span className="ms-0.5 text-error-500" aria-hidden="true">
                *
              </span>
            )}
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
  },
);
