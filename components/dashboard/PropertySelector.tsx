"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BuildingOffice2Icon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { selectProperty } from "@/app/dashboard/actions/select-property";

interface Props {
  properties:        { id: string; name: string }[];
  currentPropertyId: string;
}

export default function PropertySelector({ properties, currentPropertyId }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const t = useTranslations("dashboard");

  const handleChange = (id: string) => {
    startTransition(async () => {
      await selectProperty(id);
      router.refresh();
    });
  };

  const isFiltered = Boolean(currentPropertyId);

  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-all ${
        isFiltered
          ? "border-blue-300 bg-blue-50 text-blue-700"
          : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
      } ${isPending ? "opacity-60 pointer-events-none" : ""}`}
    >
      <BuildingOffice2Icon
        className={`h-4 w-4 flex-shrink-0 ${isFiltered ? "text-blue-500" : "text-gray-400"}`}
      />
      <select
        value={currentPropertyId}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="appearance-none bg-transparent text-sm font-medium focus:outline-none cursor-pointer max-w-[160px] truncate"
      >
        <option value="">{t("allProperties")}</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="h-3 w-3 flex-shrink-0 text-gray-400 pointer-events-none" />
    </div>
  );
}
