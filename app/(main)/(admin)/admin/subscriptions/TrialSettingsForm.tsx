"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { NumberField } from "@/components/ui/form/NumberField";
import { Select } from "@/components/ui/form/Select";
import { updatePlatformSettings } from "./actions";

type Settings = { trialDays: number; trialPlanKey: string; freePlanKey: string };

export default function TrialSettingsForm({ settings, plans }: { settings: Settings; plans: { key: string; name: string; free: boolean }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState(settings);
  const dirty = v.trialDays !== settings.trialDays || v.trialPlanKey !== settings.trialPlanKey || v.freePlanKey !== settings.freePlanKey;

  const save = () =>
    start(async () => {
      const res = await updatePlatformSettings(v);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Trial settings saved");
      router.refresh();
    });

  return (
    <section className="rounded-2xl border border-border-default bg-surface p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-fg">Free trial for new sign-ups</h3>
      <p className="mt-0.5 text-xs text-fg-tertiary">
        Applies to organizations created from now on. When a trial or paid period ends, the organization falls back to the
        fallback plan&apos;s limits — nothing is deleted, they just can&apos;t add beyond the limits.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <NumberField
          label="Trial length (days)"
          value={v.trialDays}
          min={0}
          max={365}
          step={1}
          stepper
          onValueChange={(n) => setV((s) => ({ ...s, trialDays: n == null ? 0 : Math.round(n) }))}
          helperText="0 = no trial"
        />
        <Select
          label="Trial plan"
          value={v.trialPlanKey}
          onChange={(e) => setV((s) => ({ ...s, trialPlanKey: e.target.value }))}
          options={plans.map((p) => ({ value: p.key, label: p.name }))}
        />
        <Select
          label="Fallback plan (must be free)"
          value={v.freePlanKey}
          onChange={(e) => setV((s) => ({ ...s, freePlanKey: e.target.value }))}
          options={plans.filter((p) => p.free).map((p) => ({ value: p.key, label: p.name }))}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="primary" onClick={save} loading={pending} disabled={!dirty}>
          Save
        </Button>
      </div>
    </section>
  );
}
