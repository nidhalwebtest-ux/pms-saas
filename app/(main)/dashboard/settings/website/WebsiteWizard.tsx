"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { GlobeAltIcon, CheckIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui";
import { StepBasics, StepContact, StepTemplates, StepReview } from "./steps";
import type { SlugStatus } from "./SlugField";
import WebsiteDashboard from "./WebsiteDashboard";
import LaunchExperience from "./LaunchExperience";
import { saveWebsite, publishWebsite, type PublishResult } from "./actions";
import type { WebsiteForm, WebsiteStatus } from "./types";

const STEPS = ["basics", "contact", "templates", "review"] as const;

export default function WebsiteWizard({
  initialForm, status, rootDomain, stats,
}: {
  initialForm: WebsiteForm;
  status: WebsiteStatus | null;
  publishedAt: string | null;
  rootDomain: string;
  stats: { buildings: number; units: number };
}) {
  const t = useTranslations("settings.website");
  const router = useRouter();

  const [form, setForm] = useState<WebsiteForm>(initialForm);
  const [step, setStep] = useState(0);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>(initialForm.slug ? "available" : "idle");
  const [previewLang, setPreviewLang] = useState<"ar" | "en">(initialForm.defaultLanguage);
  const [launching, setLaunching] = useState(false);
  const [saving, startSaving] = useTransition();

  // Live sites show the dashboard; "Edit" drops back into the wizard.
  const [editing, setEditing] = useState(false);
  const isLive = status === "PUBLISHED" || status === "DISABLED";
  const showDashboard = isLive && !editing;

  const update = useCallback((patch: Partial<WebsiteForm>) => setForm((f) => ({ ...f, ...patch })), []);

  // ── Per-step validation ──
  const slugOk = slugStatus === "available" || (slugStatus === "idle" && !!initialForm.slug && form.slug === initialForm.slug);
  const nameOk = !!form.siteNameEn.trim() || !!form.siteNameAr.trim();
  const stepValid = useMemo(() => {
    switch (STEPS[step]) {
      case "basics": return slugOk && nameOk && !!form.slug.trim();
      case "contact": return !!form.whatsappNumber.trim();
      default: return true;
    }
  }, [step, slugOk, nameOk, form.slug, form.whatsappNumber]);

  const persist = (extra?: Partial<WebsiteForm>) =>
    new Promise<boolean>((resolve) => {
      startSaving(async () => {
        const res = await saveWebsite({ ...form, ...extra });
        if (!res.ok) {
          toast.error(res.error === "slug_taken" ? t("slug.taken") : t("errors.generic"));
          resolve(false);
          return;
        }
        resolve(true);
      });
    });

  const next = async () => {
    if (!stepValid) return;
    await persist();
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const runLaunch = useCallback((): Promise<PublishResult> => publishWebsite(form), [form]);

  const onLaunchDone = useCallback((r: PublishResult) => { if (r.ok) router.refresh(); }, [router]);

  if (showDashboard && status) {
    return (
      <Shell t={t}>
        <WebsiteDashboard
          form={form}
          status={status}
          rootDomain={rootDomain}
          stats={stats}
          onEdit={() => { setEditing(true); setStep(0); }}
        />
      </Shell>
    );
  }

  return (
    <Shell t={t}>
      {/* Stepper */}
      <ol className="mb-8 flex items-center gap-2">
        {STEPS.map((key, i) => {
          const state = i < step ? "done" : i === step ? "active" : "todo";
          return (
            <li key={key} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => i <= step && setStep(i)}
                disabled={i > step}
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold transition ${
                  state === "done" ? "bg-green-500 text-white"
                  : state === "active" ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-400"
                }`}
              >
                {state === "done" ? <CheckIcon className="h-4 w-4" /> : i + 1}
              </button>
              <span className={`hidden truncate text-sm sm:block ${state === "active" ? "font-semibold text-gray-900" : "text-gray-500"}`}>
                {t(`steps.${key}`)}
              </span>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-gray-200" />}
            </li>
          );
        })}
      </ol>

      {/* Step body */}
      <div className="min-h-[320px]">
        {STEPS[step] === "basics" && (
          <StepBasics form={form} update={update} rootDomain={rootDomain} onSlugStatus={setSlugStatus} />
        )}
        {STEPS[step] === "contact" && <StepContact form={form} update={update} />}
        {STEPS[step] === "templates" && (
          <StepTemplates form={form} update={update} previewLang={previewLang} setPreviewLang={setPreviewLang} />
        )}
        {STEPS[step] === "review" && <StepReview form={form} rootDomain={rootDomain} />}
      </div>

      {/* Footer nav */}
      <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-5">
        <div className="flex gap-2">
          {step > 0 && <Button variant="ghost" onClick={back}>{t("nav.back")}</Button>}
          {editing && <Button variant="ghost" onClick={() => setEditing(false)}>{t("nav.cancel")}</Button>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" loading={saving} onClick={() => persist().then((ok) => ok && toast.success(t("draftSaved")))}>
            {t("nav.saveDraft")}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button variant="primary" disabled={!stepValid} loading={saving} onClick={next}>
              {t("nav.next")}
            </Button>
          ) : (
            <Button variant="primary" onClick={() => persist().then((ok) => ok && setLaunching(true))} loading={saving}>
              {t("nav.launch")}
            </Button>
          )}
        </div>
      </div>

      {launching && (
        <LaunchExperience
          run={runLaunch}
          onDone={onLaunchDone}
          onClose={() => { setLaunching(false); setEditing(false); router.refresh(); }}
        />
      )}
    </Shell>
  );
}

function Shell({ t, children }: { t: ReturnType<typeof useTranslations>; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-lg bg-blue-100 p-2">
          <GlobeAltIcon className="h-6 w-6 text-blue-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">{children}</div>
    </div>
  );
}
