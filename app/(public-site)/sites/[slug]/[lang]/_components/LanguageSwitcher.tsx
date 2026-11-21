"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LanguageIcon } from "@heroicons/react/24/outline";
import { useSite } from "@/lib/public-site/context";
import { switchLangHref } from "@/lib/public-site/lang";

const cls = "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100";

/** Plain link to the same page in the other language (/en/… ↔ /…). */
function Switch() {
  const { dict, lang, defaultLanguage } = useSite();
  const pathname = usePathname() || "/";
  const qs = useSearchParams()?.toString();
  const href = switchLangHref(pathname, lang === "ar" ? "en" : "ar", defaultLanguage) + (qs ? `?${qs}` : "");
  return (
    <Link href={href} className={cls} hrefLang={lang === "ar" ? "en" : "ar"}>
      <LanguageIcon className="h-4 w-4" />
      {dict.lang.toggle}
    </Link>
  );
}

export default function LanguageSwitcher() {
  const { dict } = useSite();
  // useSearchParams needs a Suspense boundary on pre-rendered pages.
  return (
    <Suspense fallback={<span className={cls}><LanguageIcon className="h-4 w-4" />{dict.lang.toggle}</span>}>
      <Switch />
    </Suspense>
  );
}
