"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { addDays, format, isValid, parse } from "date-fns";
import type { Locale } from "date-fns";
import { CalendarIcon } from "@heroicons/react/24/outline";
import { DayPicker, type Matcher } from "react-day-picker";
import "react-day-picker/style.css";
import {
  borderState,
  controlBase,
  controlSize,
  controlPaddingWithRightIcon,
} from "./inputStyles";
import { FormField } from "./FormField";
import type { BaseFieldProps } from "./types";
import { useFieldA11y } from "./useFieldA11y";

export interface DatePickerProps extends BaseFieldProps {
  /** Controlled value. */
  value?: Date | null;
  /** Uncontrolled initial value. */
  defaultValue?: Date | null;
  /** Fires when the user selects or clears the date. */
  onValueChange?: (date: Date | null) => void;
  /**
   * date-fns format tokens for displaying / parsing typed input.
   * Default: `"dd MMM yyyy"` (e.g. `"12 May 2026"`).
   */
  displayFormat?: string;
  /** Earliest selectable date. */
  minDate?: Date;
  /** Latest selectable date. */
  maxDate?: Date;
  /** Show quick-preset buttons (Today / Tomorrow / Next Week). Default true. */
  showPresets?: boolean;
  /** Placeholder shown in the trigger when no value. */
  placeholder?: string;
  /**
   * date-fns locale for calendar weekday headers / month labels.
   * Pass `arLocale` to render Arabic-localized weekdays.
   */
  locale?: Locale;
}

const DEFAULT_FORMAT = "dd MMM yyyy";

function fmt(date: Date | null | undefined, pattern: string): string {
  if (!date) return "";
  try {
    return format(date, pattern);
  } catch {
    return "";
  }
}

function parseDisplay(input: string, pattern: string): Date | null {
  if (!input) return null;
  const parsed = parse(input, pattern, new Date());
  return isValid(parsed) ? parsed : null;
}

function toIsoDate(date: Date | null): string {
  return date ? format(date, "yyyy-MM-dd") : "";
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  function DatePicker(
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
      value,
      defaultValue,
      onValueChange,
      displayFormat = DEFAULT_FORMAT,
      minDate,
      maxDate,
      showPresets = true,
      placeholder,
      locale,
    },
    ref,
  ) {
    const { id, messageId, hasError, inputAriaProps } = useFieldA11y({
      id: idProp,
      error,
      helperText,
      required,
    });

    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = useState<Date | null>(
      defaultValue ?? null,
    );
    const selected = isControlled ? value ?? null : internalValue;

    // Display string in the trigger input (kept separately so user can type).
    const [display, setDisplay] = useState<string>(() =>
      fmt(selected, displayFormat),
    );

    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    // Re-sync display when the selected date changes from outside.
    useEffect(() => {
      setDisplay(fmt(selected, displayFormat));
    }, [selected, displayFormat]);

    // Click-outside to close.
    useEffect(() => {
      if (!open) return;
      const handle = (e: MouseEvent) => {
        if (
          rootRef.current &&
          !rootRef.current.contains(e.target as Node)
        ) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handle);
      return () => document.removeEventListener("mousedown", handle);
    }, [open]);

    const commit = useCallback(
      (next: Date | null) => {
        if (!isControlled) setInternalValue(next);
        onValueChange?.(next);
      },
      [isControlled, onValueChange],
    );

    const handleSelect = useCallback(
      (date: Date | undefined) => {
        const next = date ?? null;
        commit(next);
        setDisplay(fmt(next, displayFormat));
        setOpen(false);
      },
      [commit, displayFormat],
    );

    const handleBlur = useCallback(() => {
      // Try to parse what's in the field; if it parses, commit; else revert.
      const parsed = parseDisplay(display, displayFormat);
      if (parsed) {
        commit(parsed);
        setDisplay(fmt(parsed, displayFormat));
      } else if (!display) {
        commit(null);
      } else {
        setDisplay(fmt(selected, displayFormat));
      }
    }, [display, displayFormat, selected, commit]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleBlur();
          setOpen(false);
        } else if (e.key === "Escape") {
          setOpen(false);
        } else if (e.key === "ArrowDown" && !open) {
          setOpen(true);
        }
      },
      [handleBlur, open],
    );

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

    // Build the DayPicker disabled matchers from min/max bounds.
    const disabledMatchers: Matcher[] = [];
    if (minDate) disabledMatchers.push({ before: minDate });
    if (maxDate) disabledMatchers.push({ after: maxDate });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
        <div className="relative" ref={rootRef}>
          <input
            ref={ref}
            type="text"
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            placeholder={placeholder ?? displayFormat.toLowerCase()}
            value={display}
            onChange={(e) => setDisplay(e.target.value)}
            onFocus={() => !readOnly && !disabled && setOpen(true)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            className={inputClasses}
            {...inputAriaProps}
            aria-haspopup="dialog"
            aria-expanded={open}
          />
          <span
            className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-fg-tertiary"
            aria-hidden="true"
          >
            <CalendarIcon className="h-4 w-4" />
          </span>

          {/* Hidden ISO value for native form submission. */}
          {!isControlled && name && (
            <input
              type="hidden"
              name={name}
              value={toIsoDate(selected)}
            />
          )}

          {open && !disabled && !readOnly && (
            <div
              role="dialog"
              aria-label={typeof label === "string" ? label : "Date picker"}
              className="absolute z-50 mt-1 rounded-md border border-border-default bg-surface p-2 shadow-lg"
            >
              {showPresets && (
                <div className="flex gap-1 border-b border-border-subtle pb-2 mb-2">
                  <PresetButton
                    onClick={() => {
                      handleSelect(today);
                    }}
                    label="Today"
                  />
                  <PresetButton
                    onClick={() => handleSelect(addDays(today, 1))}
                    label="Tomorrow"
                  />
                  <PresetButton
                    onClick={() => handleSelect(addDays(today, 7))}
                    label="Next week"
                  />
                </div>
              )}
              <DayPicker
                mode="single"
                selected={selected ?? undefined}
                onSelect={handleSelect}
                disabled={disabledMatchers.length ? disabledMatchers : undefined}
                defaultMonth={selected ?? today}
                locale={locale}
              />
            </div>
          )}
        </div>
      </FormField>
    );
  },
);

function PresetButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-sm px-2 py-1 text-xs font-medium text-fg-secondary hover:bg-subtle hover:text-fg transition-colors duration-fast ease-out"
    >
      {label}
    </button>
  );
}
