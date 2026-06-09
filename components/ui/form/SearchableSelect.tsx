"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import {
  CheckIcon,
  ChevronUpDownIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { Spinner } from "../Spinner";
import {
  borderState,
  controlBase,
  controlSize,
  controlPaddingWithRightIcon,
} from "./inputStyles";
import { FormField } from "./FormField";
import type { BaseFieldProps } from "./types";
import { useFieldA11y } from "./useFieldA11y";

export interface SearchableSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  /** Optional description shown under the label. */
  description?: string;
}

export interface SearchableSelectProps extends BaseFieldProps {
  /** Controlled value. */
  value?: string | null;

  /** Uncontrolled initial value. */
  defaultValue?: string | null;

  /** Fires on selection change. */
  onValueChange?: (value: string | null) => void;

  /** Static option list for client-side filtering. */
  options?: SearchableSelectOption[];

  /** Async loader for server-driven options. */
  loadOptions?: (query: string) => Promise<SearchableSelectOption[]>;

  /** Debounce window in ms for `loadOptions` calls. Default 250. */
  debounceMs?: number;

  /** Recent options shown above results when the query is empty. Max 5 rendered. */
  recentOptions?: SearchableSelectOption[];

  /**
   * When set, a "+ Create new: '{query}'" row appears at the bottom of the
   * listbox whenever the user has typed at least one character.
   */
  onCreate?: (query: string) => void;

  /** Text shown when no results match. Default: "No matches". */
  emptyText?: string;

  /** Placeholder in the trigger when no value is selected. */
  placeholder?: string;

  /**
   * For controlled async usage: pass the resolved option so its label can
   * be rendered in the trigger without a fresh fetch. Optional for static
   * `options` mode (lookup happens client-side).
   */
  selectedOption?: SearchableSelectOption | null;

  /**
   * Custom renderer for each option row in the listbox. When omitted, the
   * default rendering (label + highlighted match + optional description +
   * selected-check) is used. Useful for rich rows (avatar + badge + name +
   * meta) like the tenant search in the reservation booking flow.
   *
   * The renderer receives the raw option and a context object with the
   * current `query` (for match highlighting) and `selected` flag.
   */
  renderOption?: (
    option: SearchableSelectOption,
    ctx: { selected: boolean; query: string },
  ) => ReactNode;
}

/** Highlights the matched substring within a label, case-insensitive. */
function highlightMatch(label: string, query: string): ReactNode {
  if (!query) return label;
  const idx = label.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return label;
  return (
    <>
      {label.slice(0, idx)}
      <mark className="bg-brand-50 text-brand-700 px-0 rounded-sm">
        {label.slice(idx, idx + query.length)}
      </mark>
      {label.slice(idx + query.length)}
    </>
  );
}

export const SearchableSelect = forwardRef<HTMLInputElement, SearchableSelectProps>(
  function SearchableSelect(
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
      options,
      loadOptions,
      debounceMs = 250,
      recentOptions,
      onCreate,
      emptyText = "No matches",
      placeholder,
      selectedOption: selectedOptionProp,
      renderOption,
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
    const [internalValue, setInternalValue] = useState<string | null>(
      defaultValue ?? null,
    );
    const currentValue = isControlled ? value ?? null : internalValue;

    // Resolved option (label/description) for the current value.
    // Static-options mode resolves on-the-fly; async mode trusts the caller.
    const resolved = useMemo<SearchableSelectOption | null>(() => {
      if (selectedOptionProp !== undefined) return selectedOptionProp;
      if (!currentValue) return null;
      return options?.find((o) => o.value === currentValue) ?? null;
    }, [selectedOptionProp, currentValue, options]);

    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchableSelectOption[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Run the loader against the current query (debounced).
    const requestIdRef = useRef(0);
    useEffect(() => {
      if (!loadOptions) return;
      const myId = ++requestIdRef.current;
      const t = setTimeout(() => {
        setIsLoading(true);
        loadOptions(query)
          .then((opts) => {
            if (requestIdRef.current !== myId) return;
            setResults(opts);
          })
          .catch(() => {
            if (requestIdRef.current !== myId) return;
            setResults([]);
          })
          .finally(() => {
            if (requestIdRef.current === myId) setIsLoading(false);
          });
      }, debounceMs);
      return () => clearTimeout(t);
    }, [loadOptions, query, debounceMs]);

    const handleChange = useCallback(
      (next: string | null) => {
        if (!isControlled) setInternalValue(next);
        onValueChange?.(next);
      },
      [isControlled, onValueChange],
    );

    // Compute the list to show in the dropdown.
    const showRecent =
      !query && (recentOptions?.length ?? 0) > 0;
    const filteredStatic = useMemo<SearchableSelectOption[]>(() => {
      if (!options) return [];
      if (!query) return options;
      const q = query.toLowerCase();
      return options.filter((o) => o.label.toLowerCase().includes(q));
    }, [options, query]);
    const items: SearchableSelectOption[] = loadOptions
      ? results
      : filteredStatic;

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
        <Combobox
          value={currentValue}
          onChange={(v: string | null) => handleChange(v)}
          disabled={disabled}
        >
          <div className="relative">
            <ComboboxInput
              ref={ref}
              className={inputClasses}
              displayValue={(v: string | null) => {
                if (!v) return "";
                return resolved?.label ?? "";
              }}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              readOnly={readOnly}
              required={required}
              {...inputAriaProps}
            />
            <ComboboxButton
              className="absolute inset-y-0 end-0 flex items-center pe-3 text-fg-tertiary disabled:cursor-not-allowed"
              aria-label="Toggle options"
            >
              {isLoading ? (
                <Spinner size={16} />
              ) : (
                <ChevronUpDownIcon className="h-4 w-4" />
              )}
            </ComboboxButton>

            <ComboboxOptions
              className="absolute z-50 mt-1 max-h-80 w-full overflow-auto rounded-md border border-border-default bg-surface py-1 shadow-lg focus:outline-none"
              transition
            >
              {showRecent && (
                <>
                  <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-fg-tertiary">
                    Recent
                  </div>
                  {recentOptions!.slice(0, 5).map((opt) => (
                    <ComboboxOption
                      key={`recent-${opt.value}`}
                      value={opt.value}
                      disabled={opt.disabled}
                      className="group flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-fg data-[focus]:bg-subtle data-[disabled]:cursor-not-allowed data-[disabled]:text-fg-disabled"
                    >
                      <span className="flex-1">{opt.label}</span>
                    </ComboboxOption>
                  ))}
                  {items.length > 0 && (
                    <div className="my-1 border-t border-border-subtle" />
                  )}
                </>
              )}

              {items.length === 0 && !isLoading && !showRecent && (
                <div className="px-3 py-6 text-center text-sm text-fg-tertiary">
                  {emptyText}
                </div>
              )}

              {items.map((opt) => (
                <ComboboxOption
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                  className="group flex cursor-pointer items-start gap-2 px-3 py-2 text-sm text-fg data-[focus]:bg-subtle data-[disabled]:cursor-not-allowed data-[disabled]:text-fg-disabled"
                >
                  {({ selected }) => (
                    <>
                      {renderOption ? (
                        renderOption(opt, { selected, query })
                      ) : (
                        <>
                          <span className="flex flex-1 flex-col">
                            <span className="leading-tight">
                              {highlightMatch(opt.label, query)}
                            </span>
                            {opt.description && (
                              <span className="text-xs text-fg-tertiary mt-0.5">
                                {opt.description}
                              </span>
                            )}
                          </span>
                          {selected && (
                            <CheckIcon className="mt-0.5 h-4 w-4 text-brand-600 shrink-0" />
                          )}
                        </>
                      )}
                    </>
                  )}
                </ComboboxOption>
              ))}

              {onCreate && query && (
                <button
                  type="button"
                  onClick={() => {
                    onCreate(query);
                    setQuery("");
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 border-t border-border-subtle px-3 py-2 text-sm text-brand-600 hover:bg-subtle"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>
                    Create new:{" "}
                    <strong className="font-semibold">&ldquo;{query}&rdquo;</strong>
                  </span>
                </button>
              )}
            </ComboboxOptions>
          </div>
        </Combobox>

        {/* Hidden field for native form submission. */}
        {!isControlled && name && (
          <input type="hidden" name={name} value={currentValue ?? ""} />
        )}
      </FormField>
    );
  },
);
