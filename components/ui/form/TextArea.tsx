"use client";

import { forwardRef, type TextareaHTMLAttributes } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { borderState, textareaSize } from "./inputStyles";
import { FormField } from "./FormField";
import type { BaseFieldProps } from "./types";
import { useFieldA11y } from "./useFieldA11y";

type NativeTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "size" | "id" | "name" | "disabled" | "readOnly" | "required"
>;

export interface TextAreaProps extends BaseFieldProps, NativeTextareaProps {
  /** Minimum visible rows. Default 3. */
  minRows?: number;

  /** Maximum visible rows before scroll. Default 10. */
  maxRows?: number;

  /** Allow user-drag resize. Default false. */
  resizable?: boolean;
}

const baseClass =
  "w-full bg-surface text-fg border rounded-md " +
  "transition-colors duration-fast ease-out " +
  "placeholder:text-fg-tertiary " +
  "focus:outline-none " +
  "disabled:bg-subtle disabled:text-fg-disabled disabled:cursor-not-allowed " +
  "read-only:bg-subtle read-only:cursor-default";

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea(
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
      minRows = 3,
      maxRows = 10,
      resizable = false,
      style,
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
      baseClass,
      textareaSize[size],
      variantCls,
      resizable ? "resize-y" : "resize-none",
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
        <TextareaAutosize
          ref={ref}
          name={name}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          minRows={minRows}
          maxRows={maxRows}
          dir="auto"
          className={classes}
          // react-textarea-autosize uses a narrow Style type ({ height?: number });
          // accept any CSSProperties at the call site and trust the cast.
          style={style as never}
          {...inputAriaProps}
          {...rest}
        />
      </FormField>
    );
  },
);
