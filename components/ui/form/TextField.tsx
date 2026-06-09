"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Spinner } from "../Spinner";
import {
  borderState,
  controlBase,
  controlSize,
  controlPaddingWithLeftIcon,
  controlPaddingWithRightIcon,
  iconSlot,
} from "./inputStyles";
import { FormField } from "./FormField";
import type { BaseFieldProps } from "./types";
import { useFieldA11y } from "./useFieldA11y";

/* ----------------------------------------------------------------------------
 *  Types
 * ------------------------------------------------------------------------- */

type NativeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size" | "id" | "name" | "disabled" | "readOnly" | "required"
>;

export interface TextFieldProps extends BaseFieldProps, NativeInputProps {
  /** Icon rendered on the start side (left in LTR, right in RTL). 16 px, currentColor. */
  leftIcon?: ReactNode;

  /**
   * Icon rendered on the end side. Hidden when `loading` is true
   * (the spinner takes its slot).
   */
  rightIcon?: ReactNode;
}

/* ----------------------------------------------------------------------------
 *  Component
 * ------------------------------------------------------------------------- */

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField(
    {
      label,
      helperText,
      error,
      required,
      showOptional,
      disabled,
      readOnly,
      loading,
      success,
      size = "md",
      id: idProp,
      name,
      className,
      reserveMessageSpace = true,
      leftIcon,
      rightIcon,
      type = "text",
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

    const showRightSlot = loading || !!rightIcon;

    const inputClasses = [
      controlBase,
      controlSize[size],
      variantCls,
      leftIcon ? controlPaddingWithLeftIcon : "",
      showRightSlot ? controlPaddingWithRightIcon : "",
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
          {leftIcon && (
            <span className={`${iconSlot} start-0 ps-3`} aria-hidden="true">
              <span className="inline-flex h-4 w-4 items-center justify-center">
                {leftIcon}
              </span>
            </span>
          )}
          <input
            ref={ref}
            name={name}
            type={type}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            dir="auto"
            className={inputClasses}
            {...inputAriaProps}
            {...rest}
          />
          {showRightSlot && (
            <span className={`${iconSlot} end-0 pe-3`} aria-hidden="true">
              <span className="inline-flex h-4 w-4 items-center justify-center">
                {loading ? <Spinner size={16} /> : rightIcon}
              </span>
            </span>
          )}
        </div>
      </FormField>
    );
  },
);
