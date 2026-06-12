"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { LanguageIcon } from "@heroicons/react/24/outline";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import { locales, type Locale } from "@/i18n/config";

type Variant = "toggle" | "dropdown";

interface Props {
  variant?: Variant;
  className?: string;
}

const LABELS: Record<Locale, { short: string; long: string }> = {
  en: { short: "EN", long: "English" },
  ar: { short: "AR", long: "العربية" },
};

export default function LanguageSwitcher({ variant = "dropdown", className = "" }: Props) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function setLocale(next: Locale) {
    if (next === locale) return;
    // Optimistic localStorage update for instant pre-render hint
    try { localStorage.setItem("locale", next); } catch {}

    await fetch("/api/me/language", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    });

    // Refresh server components so the new translations + dir flow through
    startTransition(() => router.refresh());
  }

  if (variant === "toggle") {
    return (
      <div
        className={`inline-flex items-center rounded-full bg-white/10 ring-1 ring-white/20 p-0.5 text-xs ${className}`}
        role="group"
        aria-label="Language"
      >
        {locales.map((l) => {
          const active = l === locale;
          return (
            <button
              key={l}
              type="button"
              disabled={pending}
              onClick={() => setLocale(l)}
              className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
                active
                  ? "bg-white text-slate-900"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {LABELS[l].short}
            </button>
          );
        })}
      </div>
    );
  }

  // dropdown variant
  // The visible label is a short 2-letter code on mobile and the full name on
  // desktop. A transparent native <select> overlays the whole control so the
  // OS-native option list (full names) still opens on tap/click.
  return (
    <div className={`relative inline-flex items-center gap-1 flex-shrink-0 ${className}`}>
      <LanguageIcon className="h-4 w-4 text-gray-400 hidden sm:block" aria-hidden="true" />
      <span className="text-xs font-medium text-gray-700 pointer-events-none">
        <span className="sm:hidden">{LABELS[locale].short}</span>
        <span className="hidden sm:inline">{LABELS[locale].long}</span>
      </span>
      <ChevronDownIcon className="h-3.5 w-3.5 text-gray-400 pointer-events-none" aria-hidden="true" />
      <select
        value={locale}
        disabled={pending}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="absolute inset-0 w-full cursor-pointer opacity-0"
        aria-label="Language"
      >
        {locales.map((l) => (
          <option key={l} value={l}>{LABELS[l].long}</option>
        ))}
      </select>
    </div>
  );
}
