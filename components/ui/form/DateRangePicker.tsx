"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  addDays,
  endOfMonth,
  format,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import type { Locale } from "date-fns";
import { CalendarIcon } from "@heroicons/react/24/outline";
import {
  DayPicker,
  type DateRange,
  type Matcher,
} from "react-day-picker";
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

export interface DateRangeValue {
  from: Date;
  to: Date;
}

export interface DateRangePickerProps extends BaseFieldProps {
  /** Controlled value. */
  value?: DateRangeValue | null;
  /** Uncontrolled initial value. */
  defaultValue?: DateRangeValue | null;
  /** Fires when both ends of the range are picked or the value is cleared. */
  onValueChange?: (range: DateRangeValue | null) => void;
  /** Display format tokens for each end of the range. Default `"dd MMM yyyy"`. */
  displayFormat?: string;
  /** Earliest selectable date. */
  minDate?: Date;
  /** Latest selectable date. */
  maxDate?: Date;
  /** Show preset shortcuts on the start side of the popover. Default true. */
  showPresets?: boolean;
  /** Placeholder for the trigger when empty. */
  placeholder?: string;
  /**
   * date-fns locale for calendar weekday headers / month labels.
   * Pass `arLocale` to render Arabic-localized weekdays.
   */
  locale?: Locale;
}

const DEFAULT_FORMAT = "dd MMM yyyy";

function toIsoDate(date: Date | undefined | null): string {
  if (!date) return "";
  return format(date, "yyyy-MM-dd");
}

function fmtRange(
  range: DateRangeValue | null,
  pattern: string,
): string {
  if (!range) return "";
  return `${format(range.from, pattern)} → ${format(range.to, pattern)}`;
}

/** Normalize a partial DateRange from react-day-picker into our shape. */
function normalize(r: DateRange | undefined): DateRangeValue | null {
  if (!r?.from) return null;
  if (!r.to) {
    return { from: r.from, to: r.from };
  }
  return r.from <= r.to ? { from: r.from, to: r.to } : { from: r.to, to: r.from };
}

/** Compute Khareef Season for a given year (Oman: June 21 → September 21). */
function khareefRange(today: Date = new Date()): DateRangeValue {
  const year = today.getFullYear();
  return {
    from: new Date(year, 5, 21), // June 21
    to: new Date(year, 8, 21),   // September 21
  };
}

export const DateRangePicker = forwardRef<HTMLInputElement, DateRangePickerProps>(
  function DateRangePicker(
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
    const [internalValue, setInternalValue] = useState<DateRangeValue | null>(
      defaultValue ?? null,
    );
    const selected = isControlled ? value ?? null : internalValue;

    // Buffer for the in-progress selection inside the popover.
    const [buffer, setBuffer] = useState<DateRange | undefined>(
      selected ? { from: selected.from, to: selected.to } : undefined,
    );

    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    // Re-sync buffer with selected when it changes from outside.
    useEffect(() => {
      setBuffer(selected ? { from: selected.from, to: selected.to } : undefined);
    }, [selected]);

    // Click-outside.
    useEffect(() => {
      if (!open) return;
      const handle = (e: MouseEvent) => {
        if (
          rootRef.current &&
          !rootRef.current.contains(e.target as Node)
        ) {
          setOpen(false);
          // Commit whatever's in the buffer on outside-close.
          const next = normalize(buffer);
          if (next || selected) {
            if (!isControlled) setInternalValue(next);
            onValueChange?.(next);
          }
        }
      };
      document.addEventListener("mousedown", handle);
      return () => document.removeEventListener("mousedown", handle);
    }, [open, buffer, selected, isControlled, onValueChange]);

    const commit = useCallback(
      (next: DateRangeValue | null) => {
        if (!isControlled) setInternalValue(next);
        onValueChange?.(next);
      },
      [isControlled, onValueChange],
    );

    const handleSelect = useCallback(
      (r: DateRange | undefined) => {
        setBuffer(r);
        // Auto-commit + close once both ends are present.
        if (r?.from && r.to) {
          const next = normalize(r);
          commit(next);
          setOpen(false);
        }
      },
      [commit],
    );

    const applyPreset = useCallback(
      (range: DateRangeValue) => {
        setBuffer(range);
        commit(range);
        setOpen(false);
      },
      [commit],
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
      "ltr-num",
    ].join(" ");

    const disabledMatchers: Matcher[] = [];
    if (minDate) disabledMatchers.push({ before: minDate });
    if (maxDate) disabledMatchers.push({ after: maxDate });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = subDays(today, 1);
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const lastMonthStart = startOfMonth(subMonths(today, 1));
    const lastMonthEnd = endOfMonth(subMonths(today, 1));
    const khareef = khareefRange(today);

    const display = fmtRange(selected, displayFormat);

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
          {/* Trigger — read-only display (range editing is via the popover). */}
          <input
            ref={ref}
            type="text"
            disabled={disabled}
            readOnly
            required={required}
            placeholder={placeholder ?? `${displayFormat.toLowerCase()} → ${displayFormat.toLowerCase()}`}
            value={display}
            onFocus={() => !disabled && !readOnly && setOpen(true)}
            onClick={() => !disabled && !readOnly && setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
                e.preventDefault();
                setOpen(true);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
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

          {/* Hidden fields for native form submission. */}
          {!isControlled && name && (
            <>
              <input
                type="hidden"
                name={`${name}_from`}
                value={toIsoDate(selected?.from)}
              />
              <input
                type="hidden"
                name={`${name}_to`}
                value={toIsoDate(selected?.to)}
              />
            </>
          )}

          {open && !disabled && !readOnly && (
            <div
              role="dialog"
              aria-label={typeof label === "string" ? label : "Date range picker"}
              className="absolute z-50 mt-1 rounded-md border border-border-default bg-surface p-2 shadow-lg flex gap-2"
            >
              {showPresets && (
                <div className="flex flex-col gap-1 border-e border-border-subtle pe-2 min-w-[140px]">
                  <Preset label="Today"        onClick={() => applyPreset({ from: today, to: today })} />
                  <Preset label="Yesterday"    onClick={() => applyPreset({ from: yesterday, to: yesterday })} />
                  <Preset label="Last 7 days"  onClick={() => applyPreset({ from: subDays(today, 6), to: today })} />
                  <Preset label="This month"   onClick={() => applyPreset({ from: monthStart, to: monthEnd })} />
                  <Preset label="Last month"   onClick={() => applyPreset({ from: lastMonthStart, to: lastMonthEnd })} />
                  <Preset
                    label="Khareef season"
                    onClick={() => applyPreset(khareef)}
                  />
                </div>
              )}
              <DayPicker
                mode="range"
                selected={buffer}
                onSelect={handleSelect}
                disabled={disabledMatchers.length ? disabledMatchers : undefined}
                defaultMonth={selected?.from ?? today}
                numberOfMonths={2}
                locale={locale}
              />
            </div>
          )}
        </div>
      </FormField>
    );
  },
);

function Preset({
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
      className="rounded-sm px-2 py-1 text-start text-xs font-medium text-fg-secondary hover:bg-subtle hover:text-fg transition-colors duration-fast ease-out"
    >
      {label}
    </button>
  );
}
