"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

/** Date selector that navigates the cashier page to ?date=… (server recomputes). */
export default function DateField({ date, propertyId }: { date: string; propertyId: string }) {
  const router = useRouter();
  const t = useTranslations("settings.cashier");
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm text-gray-600">
      <span>{t("businessDate")}</span>
      <input
        type="date"
        value={date}
        disabled={pending}
        onChange={(e) => startTransition(() => router.push(`/dashboard/cashier?propertyId=${propertyId}&date=${e.target.value}`))}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm ltr-numbers focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-60"
      />
    </label>
  );
}
