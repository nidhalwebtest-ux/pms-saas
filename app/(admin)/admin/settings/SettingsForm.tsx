"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  MapPinIcon,
  PresentationChartLineIcon,
  HandThumbUpIcon,
  TrophyIcon,
  BoltIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { NumberField, Button } from "@/components/ui";
import type { CrmTargets } from "../_lib/crm-settings";
import { updateCrmTargets } from "../prospects/actions";

type FieldKey =
  | "targetVisits"
  | "targetDemos"
  | "targetInterested"
  | "targetSigned"
  | "targetActive"
  | "foundingSpots";

const FIELDS: { key: FieldKey; icon: typeof MapPinIcon; accent: string }[] = [
  { key: "targetVisits", icon: MapPinIcon, accent: "bg-brand-50 text-brand-700" },
  { key: "targetDemos", icon: PresentationChartLineIcon, accent: "bg-info-50 text-info-700" },
  { key: "targetInterested", icon: HandThumbUpIcon, accent: "bg-warning-50 text-warning-700" },
  { key: "targetSigned", icon: TrophyIcon, accent: "bg-success-50 text-success-700" },
  { key: "targetActive", icon: BoltIcon, accent: "bg-brand-100 text-brand-700" },
  { key: "foundingSpots", icon: SparklesIcon, accent: "bg-brand-50 text-brand-700" },
];

export default function SettingsForm({ settings }: { settings: CrmTargets }) {
  const router = useRouter();
  const t = useTranslations("admin.settings");
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<FieldKey, number>>({
    targetVisits: settings.targetVisits,
    targetDemos: settings.targetDemos,
    targetInterested: settings.targetInterested,
    targetSigned: settings.targetSigned,
    targetActive: settings.targetActive,
    foundingSpots: settings.foundingSpots,
  });

  const set = (key: FieldKey, v: number | null) =>
    setValues((prev) => ({ ...prev, [key]: v == null || v < 0 ? 0 : Math.round(v) }));

  const save = () => {
    const fd = new FormData();
    (Object.keys(values) as FieldKey[]).forEach((k) => fd.set(k, String(values[k])));
    startTransition(async () => {
      const res = await updateCrmTargets(fd);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(t("saved"));
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border-default bg-surface p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-fg">{t("funnelTitle")}</h3>
        <p className="mt-0.5 text-xs text-fg-tertiary">{t("funnelHint")}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {FIELDS.filter((f) => f.key !== "foundingSpots").map(({ key, icon: Icon, accent }) => (
            <div key={key} className="flex items-center gap-3">
              <span className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${accent}`}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <NumberField
                  label={t(`fields.${key}`)}
                  value={values[key]}
                  min={0}
                  step={1}
                  stepper
                  onValueChange={(v) => set(key, v)}
                  reserveMessageSpace={false}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border-default bg-surface p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-fg">{t("scarcityTitle")}</h3>
        <p className="mt-0.5 text-xs text-fg-tertiary">{t("scarcityHint")}</p>
        <div className="mt-4 max-w-[12rem]">
          <NumberField
            label={t("fields.foundingSpots")}
            value={values.foundingSpots}
            min={0}
            step={1}
            stepper
            onValueChange={(v) => set("foundingSpots", v)}
            reserveMessageSpace={false}
          />
        </div>
      </section>

      <div className="flex justify-end">
        <Button variant="primary" onClick={save} loading={pending}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
