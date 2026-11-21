"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteSeason, duplicateSeasonNextYear } from "../actions";

export default function SeasonRowActions({ id, canEdit }: { id: string; canEdit: boolean }) {
  const t = useTranslations("pricing.seasons");
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, start] = useTransition();
  if (!canEdit) return null;

  const btn = "rounded-md px-2 py-1 text-xs font-medium hover:bg-gray-100 disabled:opacity-50";
  return (
    <div className="flex justify-end gap-1 whitespace-nowrap">
      <Link href={`/dashboard/pricing/seasons/${id}`} className={`${btn} text-gray-700`}>{t("edit")}</Link>
      <button
        type="button"
        disabled={pending}
        className={`${btn} text-brand-600`}
        onClick={() =>
          start(async () => {
            const res = await duplicateSeasonNextYear(id);
            if (!res.ok) return void toast.error(res.error);
            toast.success(t("duplicated"));
            router.push(`/dashboard/pricing/seasons/${res.id}`);
          })
        }
      >
        {t("duplicate")}
      </button>
      <button
        type="button"
        disabled={pending}
        className={`${btn} text-red-600`}
        onClick={async () => {
          const { confirmed } = await confirm({ title: t("deleteConfirmTitle"), description: t("deleteConfirmBody"), tone: "destructive", confirmLabel: t("delete") });
          if (!confirmed) return;
          start(async () => {
            const res = await deleteSeason(id);
            if (!res.ok) return void toast.error(res.error);
            toast.success(t("deleted"));
            router.refresh();
          });
        }}
      >
        {t("delete")}
      </button>
    </div>
  );
}
