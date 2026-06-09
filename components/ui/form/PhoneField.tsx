"use client";

import {
  forwardRef,
  useCallback,
  useMemo,
  useState,
  type InputHTMLAttributes,
} from "react";
import {
  AsYouType,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { borderState, controlBase, controlSize } from "./inputStyles";
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
  | "inputMode"
  | "value"
  | "defaultValue"
  | "onChange"
>;

export interface PhoneFieldProps extends BaseFieldProps, NativeInputProps {
  /**
   * ISO 3166-1 alpha-2 country code (e.g. "OM", "AE", "SA"). Drives the
   * dial-code prefix and validation. Typically passed from org context.
   * Default: "OM" (Oman).
   */
  defaultCountry?: CountryCode;

  /** Controlled value — should be E.164 ("+96898765432"). */
  value?: string;

  /** Uncontrolled initial value (E.164 or local format). */
  defaultValue?: string;

  /** Fires with E.164 string when valid, or `null` when empty/invalid. */
  onValueChange?: (e164: string | null) => void;
}

/**
 * PhoneField — single-country phone input.
 *
 * Tier 2 ships without a country-picker dropdown. The `defaultCountry` prop
 * controls the dial-code prefix; callers needing multi-country selection
 * (cross-border tenants) should wait for the v2 picker, planned alongside
 * SearchableSelect in Tier 3.
 */
export const PhoneField = forwardRef<HTMLInputElement, PhoneFieldProps>(
  function PhoneField(
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
      defaultCountry = "OM",
      value,
      defaultValue,
      onValueChange,
      placeholder,
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

    const dialCode = useMemo(
      () => `+${getCountryCallingCode(defaultCountry)}`,
      [defaultCountry],
    );

    // Initial display: format the incoming value via AsYouType formatter.
    const initial = value ?? defaultValue ?? "";
    const [display, setDisplay] = useState(() => {
      if (!initial) return "";
      const parsed = parsePhoneNumberFromString(initial, defaultCountry);
      return parsed ? parsed.formatNational() : initial;
    });

    const formatAndEmit = useCallback(
      (raw: string) => {
        const formatter = new AsYouType(defaultCountry);
        const formatted = formatter.input(raw);
        setDisplay(formatted);
        const parsed = parsePhoneNumberFromString(raw, defaultCountry);
        const e164 =
          parsed && isValidPhoneNumber(raw, defaultCountry)
            ? parsed.number
            : null;
        onValueChange?.(e164);
      },
      [defaultCountry, onValueChange],
    );

    // Resolve canonical E.164 for the hidden field on uncontrolled forms.
    const canonical = useMemo(() => {
      if (value !== undefined) return value;
      if (!display) return "";
      const parsed = parsePhoneNumberFromString(display, defaultCountry);
      return parsed?.number ?? "";
    }, [value, display, defaultCountry]);

    const variantCls = hasError
      ? borderState.error
      : success
      ? borderState.success
      : borderState.default;

    const inputClasses = [
      controlBase,
      controlSize[size],
      variantCls,
      "ps-[64px] ltr-num text-start",
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
        <div className="relative" dir="ltr">
          <span
            className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-sm font-medium text-fg-secondary ltr-num"
            aria-hidden="true"
          >
            {dialCode}
          </span>
          <input
            ref={ref}
            // Visible input — uncontrolled at the React level so AsYouType
            // can drive formatting; the canonical E.164 ships via hidden.
            name={value !== undefined ? undefined : `${name ?? ""}__display`}
            type="tel"
            inputMode="tel"
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            placeholder={placeholder}
            value={display}
            onChange={(e) => formatAndEmit(e.target.value)}
            className={inputClasses}
            {...inputAriaProps}
            {...rest}
          />
          {value === undefined && name && (
            <input type="hidden" name={name} value={canonical} />
          )}
        </div>
      </FormField>
    );
  },
);
