"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/form/TextField";
import { TextArea } from "@/components/ui/form/TextArea";
import { NumberField } from "@/components/ui/form/NumberField";
import { Toggle } from "@/components/ui/form/Toggle";
import { savePlan, type PlanInput } from "../../actions";

export type PlanFormValues = PlanInput;

const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-border-default bg-surface p-4 sm:p-5">
    <h3 className="text-sm font-semibold text-fg">{title}</h3>
    {hint && <p className="mt-0.5 text-xs text-fg-tertiary">{hint}</p>}
    <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
  </section>
);

export default function PlanForm({ initial }: { initial: PlanFormValues }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState<PlanFormValues>(initial);
  const set = <K extends keyof PlanFormValues>(k: K, val: PlanFormValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const text = (k: keyof PlanFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never);
  const limitField = (k: "maxBuildings" | "maxUnits" | "maxUsers", label: string) => (
    <NumberField
      label={label}
      value={v[k]}
      min={0}
      step={1}
      onValueChange={(n) => set(k, n == null ? null : Math.round(n))}
      helperText="Empty = unlimited"
    />
  );

  const save = () =>
    start(async () => {
      const res = await savePlan(v);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Plan saved");
      router.push("/admin/subscriptions");
      router.refresh();
    });

  return (
    <div className="space-y-5">
      <Section title="Name">
        <TextField label="Key (used in code & URLs)" value={v.key} onChange={text("key")} helperText="e.g. starter, founder-deal" dir="ltr" />
        <NumberField label="Sort order" value={v.sortOrder} step={1} onValueChange={(n) => set("sortOrder", n ?? 0)} helperText="Lower shows first" />
        <TextField label="Name (English)" value={v.nameEn} onChange={text("nameEn")} />
        <TextField label="Name (Arabic)" value={v.nameAr} onChange={text("nameAr")} dir="rtl" />
        <TextField label="Description (English)" value={v.descriptionEn} onChange={text("descriptionEn")} />
        <TextField label="Description (Arabic)" value={v.descriptionAr} onChange={text("descriptionAr")} dir="rtl" />
      </Section>

      <Section title="Price per month (OMR)" hint="Per month for each billing cycle, up to 3 decimals. All 0 = a free plan (never expires).">
        <TextField label="Monthly billing" value={v.priceMonthly} onChange={text("priceMonthly")} inputMode="decimal" dir="ltr" />
        <TextField label="6-month billing" value={v.priceSemiannual} onChange={text("priceSemiannual")} inputMode="decimal" dir="ltr" />
        <TextField label="Yearly billing" value={v.priceYearly} onChange={text("priceYearly")} inputMode="decimal" dir="ltr" />
      </Section>

      <Section title="Limits" hint="Archived buildings don't count. Users include pending invitations.">
        {limitField("maxBuildings", "Max buildings")}
        {limitField("maxUnits", "Max units")}
        {limitField("maxUsers", "Max users")}
      </Section>

      <Section title="Features">
        <Toggle label="Booking website" checked={v.featureWebsite} onCheckedChange={(c) => set("featureWebsite", c)} />
        <Toggle label="WhatsApp" checked={v.featureWhatsapp} onCheckedChange={(c) => set("featureWhatsapp", c)} />
        <Toggle label="Online payments" description="Roadmap item 5" checked={v.featureOnlinePayments} onCheckedChange={(c) => set("featureOnlinePayments", c)} />
        <Toggle label="AI assistant" description="Roadmap item 15" checked={v.featureAiAssistant} onCheckedChange={(c) => set("featureAiAssistant", c)} />
      </Section>

      <Section title="Pricing card bullets" hint="One per line — shown on the landing page and the in-app plans page.">
        <TextArea label="English" value={v.bulletsEn} onChange={text("bulletsEn")} minRows={6} dir="ltr" />
        <TextArea label="Arabic" value={v.bulletsAr} onChange={text("bulletsAr")} minRows={6} dir="rtl" />
      </Section>

      <Section title="Visibility">
        <Toggle label="Public" description="Shown on the landing page and the upgrade page" checked={v.isPublic} onCheckedChange={(c) => set("isPublic", c)} />
        <Toggle label="Featured" description="“Most popular” highlight" checked={v.isFeatured} onCheckedChange={(c) => set("isFeatured", c)} />
        <Toggle label="Active" description="Inactive plans can't be newly assigned" checked={v.isActive} onCheckedChange={(c) => set("isActive", c)} />
      </Section>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => router.push("/admin/subscriptions")}>Cancel</Button>
        <Button variant="primary" onClick={save} loading={pending}>Save plan</Button>
      </div>
    </div>
  );
}
