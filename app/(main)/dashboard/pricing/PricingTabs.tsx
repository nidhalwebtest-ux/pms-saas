"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const TABS = [
  { key: "seasons", href: "/dashboard/pricing/seasons" },
  { key: "rates", href: "/dashboard/pricing/rates" },
  { key: "calendar", href: "/dashboard/pricing/calendar" },
  { key: "rules", href: "/dashboard/pricing/rules" },
] as const;

export default function PricingTabs() {
  const pathname = usePathname();
  const t = useTranslations("pricing.tabs");
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-gray-200" aria-label={t("seasons")}>
      {TABS.map(({ key, href }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              active ? "border-brand-500 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
