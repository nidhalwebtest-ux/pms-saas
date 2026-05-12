"use client";

import {
  forwardRef,
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";
import { Badge } from "../Badge";
import {
  borderState,
  controlBase,
  controlSize,
} from "./inputStyles";
import { FormField } from "./FormField";
import type { BaseFieldProps } from "./types";
import { useFieldA11y } from "./useFieldA11y";

export interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface MultiSelectProps extends BaseFieldProps {
  /** Controlled value array. */
  value?: string[];

  /** Uncontrolled initial value array. */
  defaultValue?: string[];

  /** Fires on every selection change. */
  onValueChange?: (values: string[]) => void;

  /** Option list. */
  options: MultiSelectOption[];

  /** Maximum selectable items. Disables further selection at the cap. */
  maxItems?: number;

  /** Show a "Select all" row at the top of the listbox. */
  selectAll?: boolean;

  /** Empty-state placeholder in the trigger. */
  placeholder?: string;
}

export const MultiSelect = forwardRef<HTMLButtonElement, MultiSelectProps>(
  function MultiSelect(
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
      value,
      defaultValue,
      onValueChange,
      options,
      maxItems,
      selectAll,
      placeholder,
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
    const [internalValue, setInternalValue] = useState<string[]>(
      defaultValue ?? [],
    );
    const selectedValues = isControlled ? value ?? [] : internalValue;

    const selectedOptions = useMemo(
      () => options.filter((o) => selectedValues.includes(o.value)),
      [options, selectedValues],
    );

    const atCap = maxItems !== undefined && selectedValues.length >= maxItems;

    const commit = useCallback(
      (next: string[]) => {
        if (!isControlled) setInternalValue(next);
        onValueChange?.(next);
      },
      [isControlled, onValueChange],
    );

    const handleChange = useCallback(
      (next: string[]) => {
        // Honour maxItems by truncating only when growing past the cap.
        if (
          maxItems !== undefined &&
          next.length > maxItems &&
          next.length > selectedValues.length
        ) {
          return; // ignore the add
        }
        commit(next);
      },
      [maxItems, selectedValues.length, commit],
    );

    const handleRemove = useCallback(
      (val: string) => {
        commit(selectedValues.filter((v) => v !== val));
      },
      [commit, selectedValues],
    );

    const handleSelectAll = useCallback(() => {
      const enabled = options
        .filter((o) => !o.disabled)
        .map((o) => o.value);
      const all = enabled.every((v) => selectedValues.includes(v));
      commit(all ? [] : enabled.slice(0, maxItems));
    }, [options, selectedValues, commit, maxItems]);

    const variantCls = hasError
      ? borderState.error
      : success
      ? borderState.success
      : borderState.default;

    const triggerClasses = [
      controlBase,
      controlSize[size],
      variantCls,
      "appearance-none cursor-pointer text-start pe-9",
      "h-auto min-h-[38px] py-1.5 flex-wrap items-center gap-1.5 flex",
    ].join(" ");

    return (
      <FormField
        id={id}
        messageId={messageId}
        label={label}
        helperText={
          atCap && maxItems
            ? `Max ${maxItems} reached`
            : helperText
        }
        error={error}
        required={required}
        showOptional={showOptional}
        success={success}
        className={className}
        reserveMessageSpace={reserveMessageSpace}
      >
        <Listbox
          value={selectedValues}
          onChange={handleChange}
          multiple
          disabled={disabled}
        >
          <div className="relative">
            <ListboxButton
              ref={ref}
              className={triggerClasses}
              {...inputAriaProps}
            >
              {selectedOptions.length === 0 ? (
                <span className="text-fg-tertiary">{placeholder ?? "Select…"}</span>
              ) : (
                selectedOptions.map((opt) => (
                  <Badge
                    key={opt.value}
                    tone="brand"
                    appearance="subtle"
                    size="sm"
                    onClose={() => handleRemove(opt.value)}
                    closeLabel={`Remove ${opt.label}`}
                  >
                    {opt.label}
                  </Badge>
                ))
              )}
              <span
                className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-fg-tertiary"
                aria-hidden="true"
              >
                <ChevronUpDownIcon className="h-4 w-4" />
              </span>
            </ListboxButton>

            <ListboxOptions
              className="absolute z-50 mt-1 max-h-80 w-full overflow-auto rounded-md border border-border-default bg-surface py-1 shadow-lg focus:outline-none"
              transition
            >
              {selectAll && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="flex w-full items-center gap-2 border-b border-border-subtle px-3 py-2 text-sm text-fg hover:bg-subtle"
                >
                  <span className="flex-1 text-start font-medium">Select all</span>
                  <span className="text-xs text-fg-tertiary">
                    {selectedValues.length} / {options.length}
                  </span>
                </button>
              )}

              {options.map((opt) => {
                const isSelected = selectedValues.includes(opt.value);
                const isDisabled =
                  opt.disabled || (atCap && !isSelected);
                return (
                  <ListboxOption
                    key={opt.value}
                    value={opt.value}
                    disabled={isDisabled}
                    className="group flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-fg data-[focus]:bg-subtle data-[disabled]:cursor-not-allowed data-[disabled]:text-fg-disabled"
                  >
                    {({ selected }) => (
                      <>
                        <span className="flex-1">{opt.label}</span>
                        {selected && (
                          <CheckIcon className="h-4 w-4 text-brand-600 shrink-0" />
                        )}
                      </>
                    )}
                  </ListboxOption>
                );
              })}
            </ListboxOptions>
          </div>
        </Listbox>

        {/* Hidden fields — one per selected value. */}
        {!isControlled && name && (
          <>
            {selectedValues.map((v) => (
              <input key={v} type="hidden" name={`${name}[]`} value={v} />
            ))}
          </>
        )}
      </FormField>
    );
  },
);
