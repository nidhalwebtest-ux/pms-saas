"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import {
  borderState,
  controlBase,
  controlSize,
  controlPaddingWithRightIcon,
} from "./inputStyles";
import { FormField } from "./FormField";
import type { BaseFieldProps } from "./types";
import { useFieldA11y } from "./useFieldA11y";

type NativeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size" | "id" | "name" | "disabled" | "readOnly" | "required" | "type"
>;

export interface PasswordFieldProps extends BaseFieldProps, NativeInputProps {
  /** aria-label for the toggle button when password is hidden. */
  showLabel?: string;
  /** aria-label for the toggle button when password is visible. */
  hideLabel?: string;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(
    {
      label,
      helperText,
      error,
      required,
      showOptional,
      disabled,
      readOnly,
      success,
      size = "md",
      id: idProp,
      name,
      className,
      reserveMessageSpace = true,
      showLabel = "Show password",
      hideLabel = "Hide password",
      autoComplete = "current-password",
      ...rest
    },
    ref,
  ) {
    const [show, setShow] = useState(false);
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

    const inputClasses = [
      controlBase,
      controlSize[size],
      variantCls,
      controlPaddingWithRightIcon,
    ].join(" ");

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
          <input
            ref={ref}
            name={name}
            type={show ? "text" : "password"}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            autoComplete={autoComplete}
            className={inputClasses}
            {...inputAriaProps}
            {...rest}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            disabled={disabled}
            aria-label={show ? hideLabel : showLabel}
            aria-pressed={show}
            tabIndex={-1}
            className="absolute inset-y-0 end-0 inline-flex items-center pe-3 text-fg-tertiary hover:text-fg transition-colors duration-fast ease-out disabled:cursor-not-allowed disabled:text-fg-disabled"
          >
            {show ? (
              <EyeSlashIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </FormField>
    );
  },
);
