"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckIcon } from "@heroicons/react/24/outline";
import { updateReservationSettings } from "./actions";
import { Alert, Button } from "@/components/ui";

type CheckInPolicy = "ALLOW_BACK_TO_BACK" | "REQUIRE_VACANT";

type FormState = {
  checkInPolicy: CheckInPolicy;
};

export default function ReservationSettingsForm({ settings }: { settings: FormState }) {
  const t      = useTranslations("settings.reservations");
  const tErr   = useTranslations("auth.onboarding.errors");
  const router = useRouter();
  const [form, setForm] = useState<FormState>(settings);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty = form.checkInPolicy !== settings.checkInPolicy;

  function handleSave() {
    setBannerError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("checkInPolicy", form.checkInPolicy);

      let result;
      try {
        result = await updateReservationSettings(fd);
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

      {/* Check-in policy */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t("checkInPolicyLabel")}
        </label>
        <p className="text-xs text-gray-500 mb-2">{t("checkInPolicyHint")}</p>
        <div className="space-y-2">
          {(["ALLOW_BACK_TO_BACK", "REQUIRE_VACANT"] as const).map((value) => (
            <label
              key={value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition ${
                form.checkInPolicy === value
                  ? "border-blue-500 bg-blue-50/40 ring-1 ring-blue-500/30"
                  : "border-gray-300 bg-white hover:border-gray-400"
              }`}
            >
              <input
                type="radio"
                name="checkInPolicy"
                value={value}
                checked={form.checkInPolicy === value}
                onChange={() => {
                  setForm((p) => ({ ...p, checkInPolicy: value }));
                  setBannerError(null);
                }}
                className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500/30"
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium text-gray-800">
                  {t(value === "ALLOW_BACK_TO_BACK" ? "checkInPolicyBackToBackTitle" : "checkInPolicyRequireVacantTitle")}
                </span>
                <span className="text-xs text-gray-500">
                  {t(value === "ALLOW_BACK_TO_BACK" ? "checkInPolicyBackToBackDesc" : "checkInPolicyRequireVacantDesc")}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
        {dirty && (
          <button
            type="button"
            onClick={() => {
              setForm(settings);
              setBannerError(null);
            }}
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
