"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type InputHTMLAttributes,
} from "react";
import { MinusIcon, PlusIcon } from "@heroicons/react/24/outline";
import { Spinner } from "../Spinner";
import {
  borderState,
  controlBase,
  controlSize,
  controlPaddingWithRightIcon,
  iconSlot,
} from "./inputStyles";
import { FormField } from "./FormField";
import type { BaseFieldProps } from "./types";
import { useFieldA11y } from "./useFieldA11y";

type NativeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  | "size"
  | "id"
  | "name"
  | "disabled"
  | "readOnly"
  | "required"
  | "type"
  | "value"
  | "defaultValue"
  | "onChange"
  | "inputMode"
>;

export interface NumberFieldProps extends BaseFieldProps, NativeInputProps {
  /** Controlled value. Coerced to a string internally. */
  value?: number | string | null;

  /** Uncontrolled initial value. */
  defaultValue?: number | string | null;

  /**
   * Decimal precision. Defaults to 3 when `currency === "OMR"`, else 0.
   * Display value is formatted to this precision on blur.
   */
  precision?: number;

  /**
   * Currency code. When set, renders a suffix addon and bumps the default
   * precision (OMR → 3 decimals per `1 OMR = 1000 baisa` convention).
   */
  currency?: string;

  /** Minimum value (inclusive). Native min — keyboard ↑↓ respects it. */
  min?: number;

  /** Maximum value (inclusive). */
  max?: number;

  /** Step for keyboard ↑↓ and stepper buttons. Default 1. */
  step?: number;

  /**
   * Show `−` / `+` stepper buttons flanking the input. Each click adds /
   * subtracts `step` and clamps to `min` / `max`. Defaults to false.
   */
  stepper?: boolean;

  /** Fires with the parsed numeric value (or `null` for empty). */
  onValueChange?: (value: number | null) => void;
}

/**
 * Parses a user-entered string into a number. Strips thousand separators
 * (locale-aware) and allows a single decimal point or comma.
 */
function parseLooseNumber(input: string): number | null {
  if (!input) return null;
  // Remove anything that isn't digit, minus, dot, or comma.
  const cleaned = input.replace(/[^\d.,-]/g, "");
  // Treat last separator as the decimal point.
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized: string;
  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = cleaned.replace(/,/g, "");
  }
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatForDisplay(value: number | null, precision: number): string {
  if (value === null) return "";
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(value);
}

export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(
  function NumberField(
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
      value,
      defaultValue,
      precision: precisionProp,
      currency,
      min,
      max,
      step = 1,
      stepper = false,
      onValueChange,
      placeholder,
      onFocus,
      onBlur,
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

    const precision = precisionProp ?? (currency === "OMR" ? 3 : 0);

    // Internal display string. Initialized from value/defaultValue.
    const initial =
      value !== undefined ? value : defaultValue !== undefined ? defaultValue : null;
    const initialNum =
      typeof initial === "number" ? initial : typeof initial === "string" ? parseLooseNumber(initial) : null;
    const [display, setDisplay] = useState(() =>
      initialNum === null ? "" : formatForDisplay(initialNum, precision),
    );
    const [isFocused, setIsFocused] = useState(false);

    // Keep display in sync with a *controlled* value when not actively typing.
    useEffect(() => {
      if (value === undefined || isFocused) return;
      const n = typeof value === "number" ? value : value === null ? null : parseLooseNumber(value);
      setDisplay(n === null ? "" : formatForDisplay(n, precision));
    }, [value, precision, isFocused]);

    const handleFocus = useCallback(
      (e: FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);
        // Show the raw number (no thousand separators) while editing.
        const n = parseLooseNumber(display);
        if (n !== null) setDisplay(String(n));
        onFocus?.(e);
      },
      [display, onFocus],
    );

    const handleBlur = useCallback(
      (e: FocusEvent<HTMLInputElement>) => {
        setIsFocused(false);
        const n = parseLooseNumber(display);
        setDisplay(n === null ? "" : formatForDisplay(n, precision));
        onValueChange?.(n);
        onBlur?.(e);
      },
      [display, precision, onValueChange, onBlur],
    );

    const variantCls = hasError
      ? borderState.error
      : success
      ? borderState.success
      : borderState.default;

    const showSuffix = !!currency;
    const showSpinner = !!loading;
    const showRightSlot = showSuffix || showSpinner;

    const inputClasses = [
      controlBase,
      controlSize[size],
      variantCls,
      showRightSlot ? controlPaddingWithRightIcon : "",
      "text-end tabular-nums ltr-num",
      // When stepper is on, the input is sandwiched between buttons — drop
      // its rounded corners on both ends so the segmented control reads as one.
      stepper ? "rounded-none border-x-0 focus:border-x" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const adjustBy = useCallback(
      (delta: number) => {
        if (disabled || readOnly) return;
        const current = parseLooseNumber(display) ?? 0;
        let next = current + delta;
        if (min !== undefined) next = Math.max(min, next);
        if (max !== undefined) next = Math.min(max, next);
        setDisplay(formatForDisplay(next, precision));
        onValueChange?.(next);
      },
      [display, disabled, readOnly, min, max, precision, onValueChange],
    );

    const stepperButton = stepper
      ? "inline-flex items-center justify-center bg-bg-subtle text-fg-secondary border border-border-default transition-colors duration-fast ease-out hover:bg-bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
      : "";
    const stepperHeight = controlSize[size].match(/h-\[?[0-9]+(?:px)?\]?/)?.[0] ?? "h-[38px]";
    const stepperSize = `${stepperHeight} w-9`;

    // Hidden field for the *parsed* numeric value when the component is used
    // with server-actions (uncontrolled). Keeps form submission strict.
    const parsedValue = parseLooseNumber(display);
    const hiddenInputRef = useRef<HTMLInputElement>(null);

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
        <div className={stepper ? "flex" : "relative"} dir="ltr">
          {stepper && (
            <button
              type="button"
              onClick={() => adjustBy(-step)}
              disabled={
                disabled ||
                readOnly ||
                (min !== undefined && (parseLooseNumber(display) ?? 0) <= min)
              }
              aria-label="Decrease"
              className={`${stepperButton} ${stepperSize} rounded-s-md`}
            >
              <MinusIcon className="h-4 w-4" />
            </button>
          )}
          <input
            ref={ref}
            name={value !== undefined ? undefined : `${name ?? ""}__display`}
            type="text"
            inputMode="decimal"
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            placeholder={placeholder}
            min={min}
            max={max}
            step={step}
            value={display}
            onChange={(e) => {
              setDisplay(e.target.value);
              const n = parseLooseNumber(e.target.value);
              onValueChange?.(n);
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={inputClasses}
            {...inputAriaProps}
            {...rest}
          />
          {/* Hidden canonical value for native form submission. */}
          {value === undefined && name && (
            <input
              ref={hiddenInputRef}
              type="hidden"
              name={name}
              value={parsedValue === null ? "" : String(parsedValue)}
            />
          )}
          {showRightSlot && !stepper && (
            <span className={`${iconSlot} end-0 pe-3`} aria-hidden="true">
              {showSpinner ? (
                <span className="inline-flex h-4 w-4 items-center justify-center">
                  <Spinner size={16} />
                </span>
              ) : (
                <span className="text-xs font-medium text-fg-tertiary">
                  {currency}
                </span>
              )}
            </span>
          )}
          {stepper && (
            <button
              type="button"
              onClick={() => adjustBy(step)}
              disabled={
                disabled ||
                readOnly ||
                (max !== undefined && (parseLooseNumber(display) ?? 0) >= max)
              }
              aria-label="Increase"
              className={`${stepperButton} ${stepperSize} rounded-e-md`}
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </FormField>
    );
  },
);
