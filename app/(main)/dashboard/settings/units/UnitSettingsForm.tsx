"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckIcon } from "@heroicons/react/24/outline";
import { updateUnitSettings } from "./actions";
import { Alert, Button } from "@/components/ui";

type FormState = {
  showReservedStatus: boolean;
};

export default function UnitSettingsForm({ settings }: { settings: FormState }) {
  const t      = useTranslations("settings.units");
  const tErr   = useTranslations("auth.onboarding.errors");
  const router = useRouter();
  const [form, setForm] = useState<FormState>(settings);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty = form.showReservedStatus !== settings.showReservedStatus;

  function handleSave() {
    setBannerError(null);
    startTransition(async () => {
      const fd = new FormData();
      if (form.showReservedStatus) fd.append("showReservedStatus", "on");

      let result;
      try {
        result = await updateUnitSettings(fd);
      } catch {
        setBannerError(tErr("generic"));
        return;
      }
      if (result.ok) {
        toast.success(t("savedToast"));
        router.refresh();
        return;
      }
      setBannerError(tErr("generic"));
    });
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5 space-y-5">
      {bannerError && <Alert variant="error" description={bannerError} />}

      {/* Include Reserved status */}
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={form.showReservedStatus}
          onChange={(e) => {
            setForm({ showReservedStatus: e.target.checked });
            setBannerError(null);
          }}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500/30"
        />
        <span className="flex flex-col">
          <span className="text-sm font-medium text-gray-800">{t("showReservedLabel")}</span>
          <span className="text-xs text-gray-500">{t("showReservedHint")}</span>
        </span>
      </label>

      {/* Save */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
        {dirty && (
          <button
            type="button"
            onClick={() => { setForm(settings); setBannerError(null); }}
            disabled={isPending}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {t("revert")}
          </button>
        )}
        <Button
          type="button"
          onClick={handleSave}
          loading={isPending}
          disabled={!dirty}
          leftIcon={<CheckIcon className="h-4 w-4" />}
        >
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
