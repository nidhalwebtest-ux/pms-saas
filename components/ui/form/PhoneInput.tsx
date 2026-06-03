"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import {
  ChevronUpDownIcon,
  MagnifyingGlassIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

/**
 * PhoneInput — phone field with an integrated, searchable country-code picker
 * (the v2 picker that the single-country PhoneField deferred — QA #2 / #10).
 *
 * - Pick a country → the dial-code prefix + validation country update.
 * - The visible input formats as-you-type for the selected country.
 * - `onValueChange` emits canonical E.164 ("+96898765432") when the number is
 *   valid, otherwise the raw typed string (so partial input stays editable and
 *   submittable). `value` seeds the initial display/country only (uncontrolled
 *   display internally — avoids cursor jumps); on E.164 seeds it detects the
 *   country automatically.
 * - Renders only the control group (no label) so it slots into existing form
 *   markup. Pass `variant="dark"` for dark surfaces (e.g. the onboarding wizard).
 */

// Shown at the top of the list: GCC + common expat origins for the Oman market.
const PRIORITY: CountryCode[] = [
  "OM", "AE", "SA", "BH", "KW", "QA", "IN", "PK", "BD", "PH", "EG",
];

/** ISO 3166-1 alpha-2 → regional-indicator flag emoji. */
function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export interface PhoneInputProps {
  /** Initial value (E.164 or local). Seeds display + country on mount only. */
  value?: string;
  /** Default selected country when `value` carries no country. Default "OM". */
  defaultCountry?: CountryCode;
  /** Emits E.164 when valid, else the raw typed string. */
  onValueChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  /** When set, a hidden input ships the canonical E.164 for native submission. */
  name?: string;
  variant?: "light" | "dark";
  className?: string;
}

export function PhoneInput({
  value,
  defaultCountry = "OM",
  onValueChange,
  required,
  disabled,
  placeholder,
  id,
  name,
  variant = "light",
  className = "",
}: PhoneInputProps) {
  const locale = useLocale();
  const t = useTranslations("phoneInput");

  const regionNames = useMemo(() => {
    try {
      return new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      return new Intl.DisplayNames(["en"], { type: "region" });
    }
  }, [locale]);

  const countries = useMemo(() => {
    const list = getCountries().map((code) => ({
      code,
      name: regionNames.of(code) ?? code,
      dial: `+${getCountryCallingCode(code)}`,
      flag: flagEmoji(code),
    }));
    const rank = (c: CountryCode) => {
      const i = PRIORITY.indexOf(c);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return list.sort((a, b) => {
      const ra = rank(a.code);
      const rb = rank(b.code);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name, locale);
    });
  }, [regionNames, locale]);

  // Seed country + display from the initial value once.
  const seed = value ?? "";
  const [country, setCountry] = useState<CountryCode>(() => {
    const parsed = seed ? parsePhoneNumberFromString(seed) : null;
    return parsed?.country ?? defaultCountry;
  });
  const [display, setDisplay] = useState(() => {
    if (!seed) return "";
    const parsed = parsePhoneNumberFromString(seed, defaultCountry);
    return parsed ? parsed.formatNational() : seed;
  });
  const [filter, setFilter] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const dialCode = `+${getCountryCallingCode(country)}`;

  const emit = useCallback(
    (nextDisplay: string, nextCountry: CountryCode) => {
      const parsed = parsePhoneNumberFromString(nextDisplay, nextCountry);
      if (parsed && isValidPhoneNumber(nextDisplay, nextCountry)) {
        onValueChange?.(parsed.number); // canonical E.164
      } else {
        onValueChange?.(nextDisplay); // raw — still editable/submittable
      }
    },
    [onValueChange],
  );

  const onInput = (raw: string) => {
    const formatted = new AsYouType(country).input(raw);
    setDisplay(formatted);
    emit(formatted, country);
  };

  const chooseCountry = (code: CountryCode) => {
    setCountry(code);
    emit(display, code);
    setFilter("");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const canonical = useMemo(() => {
    const parsed = parsePhoneNumberFromString(display, country);
    return parsed?.number ?? "";
  }, [display, country]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }, [countries, filter]);

  // ── Theming ──────────────────────────────────────────────────────────────
  const dark = variant === "dark";
  const group = dark
    ? "border-slate-600 bg-slate-800/60 focus-within:border-blue-500 focus-within:ring-blue-500/30"
    : "border-gray-300 bg-white focus-within:border-blue-500 focus-within:ring-blue-500/20";
  const txt = dark ? "text-white placeholder:text-slate-500" : "text-gray-900";
  const trigger = dark
    ? "text-slate-200 hover:bg-slate-700/60 border-slate-600"
    : "text-gray-700 hover:bg-gray-50 border-gray-300";
  const panelCls = dark
    ? "border-slate-700 bg-slate-800 text-slate-100"
    : "border-gray-200 bg-white text-gray-900";
  const searchCls = dark
    ? "border-slate-700 bg-slate-900/60 text-white placeholder:text-slate-500"
    : "border-gray-200 bg-gray-50 text-gray-900";
  const optHover = dark ? "hover:bg-slate-700/60" : "hover:bg-gray-50";

  return (
    <div className={className} dir="ltr">
      <div
        className={`flex items-stretch rounded-xl border transition focus-within:ring-2 ${group} ${
          disabled ? "opacity-60" : ""
        }`}
      >
        <Popover className="relative">
          <PopoverButton
            type="button"
            disabled={disabled}
            className={`flex h-full items-center gap-1.5 rounded-s-xl border-e px-3 text-sm font-medium transition focus:outline-none ${trigger}`}
          >
            <span className="text-base leading-none">{flagEmoji(country)}</span>
            <span className="ltr-numbers">{dialCode}</span>
            <ChevronUpDownIcon className="h-4 w-4 opacity-60" />
          </PopoverButton>
          <PopoverPanel
            className={`absolute z-50 mt-1 w-72 overflow-hidden rounded-xl border shadow-lg ${panelCls}`}
          >
            {({ close }) => (
              <>
                <div className="p-2">
                  <div className="relative">
                    <MagnifyingGlassIcon className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
                    <input
                      autoFocus
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      placeholder={t("searchCountry")}
                      className={`w-full rounded-lg border py-2 ps-8 pe-3 text-sm focus:outline-none ${searchCls}`}
                    />
                  </div>
                </div>
                <ul className="max-h-64 overflow-auto pb-2">
                  {filtered.map((c) => (
                    <li key={c.code}>
                      <button
                        type="button"
                        onClick={() => {
                          chooseCountry(c.code);
                          close();
                        }}
                        className={`flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm transition ${optHover}`}
                      >
                        <span className="text-base leading-none">{c.flag}</span>
                        <span className="flex-1 truncate">{c.name}</span>
                        <span className="ltr-numbers opacity-60">{c.dial}</span>
                        {c.code === country && (
                          <CheckIcon className="h-4 w-4 text-blue-500" />
                        )}
                      </button>
                    </li>
                  ))}
                  {filtered.length === 0 && (
                    <li className="px-3 py-6 text-center text-sm opacity-60">
                      {t("noMatches")}
                    </li>
                  )}
                </ul>
              </>
            )}
          </PopoverPanel>
        </Popover>

        <input
          ref={inputRef}
          id={id}
          type="tel"
          inputMode="tel"
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          value={display}
          onChange={(e) => onInput(e.target.value)}
          className={`ltr-numbers flex-1 rounded-e-xl border-0 bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:ring-0 ${txt}`}
        />
        {name && <input type="hidden" name={name} value={canonical} />}
      </div>
    </div>
  );
}
