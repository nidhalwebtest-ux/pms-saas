"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

/** Building picker that navigates the cashier daybook to ?propertyId=… */
export default function BuildingField({
  propertyId,
  date,
  buildings,
}: {
  propertyId: string;
  date: string;
  buildings: { id: string; name: string }[];
}) {
  const router = useRouter();
  const t = useTranslations("settings.cashier");
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm text-gray-600">
      <span>{t("building")}</span>
      <select
        value={propertyId}
        disabled={pending}
        onChange={(e) => startTransition(() => router.push(`/dashboard/cashier?propertyId=${e.target.value}&date=${date}`))}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-60"
      >
        {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
    </label>
  );
}
