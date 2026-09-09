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
      className={`flex items-center gap-1.5 rounded-lg border border-navbar-border bg-navbar-input-bg px-2 sm:px-2.5 py-1.5 text-sm transition-all min-w-0 hover:bg-navbar-input-bg-focus ${
        isFiltered ? "text-navbar-fg" : "text-navbar-fg-muted"
      } ${isPending ? "opacity-60 pointer-events-none" : ""}`}
    >
      <BuildingOffice2Icon
        className={`h-4 w-4 flex-shrink-0 ${isFiltered ? "text-navbar-active" : "text-navbar-fg-subtle"}`}
      />
      <select
        value={currentPropertyId}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="appearance-none bg-transparent text-sm font-medium focus:outline-none cursor-pointer truncate min-w-0 w-full max-w-[100px] sm:max-w-[160px]"
      >
        <option value="">{t("allProperties")}</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="h-3 w-3 flex-shrink-0 text-navbar-fg-subtle pointer-events-none" />
    </div>
  );
}
