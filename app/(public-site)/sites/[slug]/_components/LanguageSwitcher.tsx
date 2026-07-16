"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LanguageIcon } from "@heroicons/react/24/outline";
import { useSite } from "@/lib/public-site/context";

export default function LanguageSwitcher() {
  const { dict, lang } = useSite();
  const router = useRouter();
  const [pending, start] = useTransition();

  const toggle = () => {
    const next = lang === "ar" ? "en" : "ar";
    document.cookie = `site_lang=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
    start(() => router.refresh());
  };

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
    >
      <LanguageIcon className="h-4 w-4" />
      {dict.lang.toggle}
    </button>
  );
}
