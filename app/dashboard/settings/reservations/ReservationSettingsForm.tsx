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
  allowEarlyCheckIn: boolean;
  autoCheckout: boolean;
  reservationNumberPrefix: string;
  reservationNumberPadding: number;
  reservationNumberResetYearly: boolean;
};

export default function ReservationSettingsForm({ settings }: { settings: FormState }) {
  const t      = useTranslations("settings.reservations");
  const tErr   = useTranslations("auth.onboarding.errors");
  const router = useRouter();
  const [form, setForm] = useState<FormState>(settings);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty =
    form.checkInPolicy !== settings.checkInPolicy ||
    form.allowEarlyCheckIn !== settings.allowEarlyCheckIn ||
    form.autoCheckout !== settings.autoCheckout ||
    form.reservationNumberPrefix !== settings.reservationNumberPrefix ||
    form.reservationNumberPadding !== settings.reservationNumberPadding ||
    form.reservationNumberResetYearly !== settings.reservationNumberResetYearly;

  // Live preview of the first reservation number for the current settings.
  const previewNumber =
    `${(form.reservationNumberPrefix || "RES")}` +
    `${form.reservationNumberResetYearly ? `-${new Date().getFullYear()}` : ""}` +
    `-${"1".padStart(Math.min(Math.max(form.reservationNumberPadding || 1, 1), 10), "0")}`;

  function handleSave() {
    setBannerError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("checkInPolicy", form.checkInPolicy);
      if (form.allowEarlyCheckIn) fd.append("allowEarlyCheckIn", "on");
      if (form.autoCheckout) fd.append("autoCheckout", "on");
      fd.append("reservationNumberPrefix", form.reservationNumberPrefix);
      fd.append("reservationNumberPadding", String(form.reservationNumberPadding));
      if (form.reservationNumberResetYearly) fd.append("reservationNumberResetYearly", "on");

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

      {/* Early check-in */}
      <label className="flex cursor-pointer items-start gap-3 border-t border-gray-100 pt-4">
        <input
          type="checkbox"
          checked={form.allowEarlyCheckIn}
          onChange={(e) => { setForm((p) => ({ ...p, allowEarlyCheckIn: e.target.checked })); setBannerError(null); }}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500/30"
        />
        <span className="flex flex-col">
          <span className="text-sm font-medium text-gray-800">{t("allowEarlyCheckInLabel")}</span>
          <span className="text-xs text-gray-500">{t("allowEarlyCheckInHint")}</span>
        </span>
      </label>

      {/* Automatic checkout */}
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={form.autoCheckout}
          onChange={(e) => { setForm((p) => ({ ...p, autoCheckout: e.target.checked })); setBannerError(null); }}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500/30"
        />
        <span className="flex flex-col">
          <span className="text-sm font-medium text-gray-800">{t("autoCheckoutLabel")}</span>
          <span className="text-xs text-gray-500">{t("autoCheckoutHint")}</span>
        </span>
      </label>

      {/* Reservation numbering (QA #29) */}
      <div className="border-t border-gray-100 pt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t("numberFormatLabel")}
        </label>
        <p className="text-xs text-gray-500 mb-3">{t("numberFormatHint")}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t("prefixLabel")}</label>
            <input
              type="text"
              value={form.reservationNumberPrefix}
              maxLength={8}
              onChange={(e) => {
                const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                setForm((p) => ({ ...p, reservationNumberPrefix: v }));
                setBannerError(null);
              }}
              placeholder="RES"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase ltr-numbers focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t("paddingLabel")}</label>
            <input
              type="number"
              min={1}
              max={10}
              value={form.reservationNumberPadding}
              onChange={(e) => {
                setForm((p) => ({ ...p, reservationNumberPadding: parseInt(e.target.value, 10) || 1 }));
                setBannerError(null);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm ltr-numbers focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <label className="mt-3 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={form.reservationNumberResetYearly}
            onChange={(e) => { setForm((p) => ({ ...p, reservationNumberResetYearly: e.target.checked })); setBannerError(null); }}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500/30"
          />
          <span className="flex flex-col">
            <span className="text-sm font-medium text-gray-800">{t("resetYearlyLabel")}</span>
            <span className="text-xs text-gray-500">{t("resetYearlyHint")}</span>
          </span>
        </label>

        <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-sm">
          <span className="text-xs text-gray-500">{t("previewLabel")} </span>
          <span className="font-semibold text-gray-900 ltr-numbers">{previewNumber}</span>
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
