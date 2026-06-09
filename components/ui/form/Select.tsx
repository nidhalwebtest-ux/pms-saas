"use client";

import {
  forwardRef,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { ChevronUpDownIcon } from "@heroicons/react/24/outline";
import { borderState, controlBase, controlSize } from "./inputStyles";
import { FormField } from "./FormField";
import type { BaseFieldProps } from "./types";
import { useFieldA11y } from "./useFieldA11y";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

type NativeSelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "size" | "id" | "name" | "disabled" | "required" | "children"
>;

export interface SelectProps extends BaseFieldProps, NativeSelectProps {
  /**
   * Option list. When omitted, render `children` (allows `<optgroup>` / custom).
   */
  options?: SelectOption[];

  /**
   * Optional placeholder rendered as a disabled first option. Only meaningful
   * when the field is uncontrolled (no `value`) and unselected by default.
   */
  placeholder?: string;

  /** Custom `<option>` markup (alternative to `options`). */
  children?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      label,
      helperText,
      error,
      required,
      showOptional,
      disabled,
      success,
      size = "md",
      id: idProp,
      name,
      className,
      reserveMessageSpace = true,
      options,
      placeholder,
      children,
      ...rest
    },
    ref,
  ) {
    const { id, messageId, hasError, inputAriaProps } = useFieldA11y({
      id: idProp,
      error,
      helperText,
      required,
    });

    const variantCls = hasError
      ? borderState.error
      : success
      ? borderState.success
      : borderState.default;

    const classes = [
      controlBase,
      controlSize[size],
      variantCls,
      "appearance-none pe-9",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <FormField
        id={id}
        messageId={messageId}
        label={label}
        helperText={helperText}
        error={error}
        required={required}
        showOptional={showOptional}
        success={success}
        className={className}
        reserveMessageSpace={reserveMessageSpace}
      >
        <div className="relative">
          <select
            ref={ref}
            name={name}
            disabled={disabled}
            required={required}
            className={classes}
            {...inputAriaProps}
            {...rest}
          >
            {placeholder !== undefined && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options
              ? options.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                  >
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <span
            className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-fg-tertiary"
            aria-hidden="true"
          >
            <ChevronUpDownIcon className="h-4 w-4" />
          </span>
        </div>
      </FormField>
    );
  },
);
