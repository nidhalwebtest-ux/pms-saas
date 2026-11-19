"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { XMarkIcon, SparklesIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

/**
 * Thin banner under the header for owners/admins (Roadmap item 4):
 *   trial      — last 7 days of the free trial
 *   expired    — trial / paid period ended → Free plan limits apply
 *   paidEnding — last 7 days of a paid period
 * Dismissable for 3 days (localStorage; falls back to always-shown if storage is blocked).
 * The kind + day count are part of the key, so a new state shows again.
 */
export type SubscriptionBannerProps = { kind: "trial" | "expired" | "paidEnding"; days: number; planName: string };

const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

export default function SubscriptionBanner({ kind, days, planName }: SubscriptionBannerProps) {
  const t = useTranslations("subscription.banner");
  const key = `binaya_sub_banner_${kind}_${kind === "expired" ? "x" : days}`;
  const [hidden, setHidden] = useState(true); // avoid a flash before storage is read

  useEffect(() => {
    try {
      const until = Number(localStorage.getItem(key) ?? 0);
      setHidden(until > Date.now());
    } catch {
      setHidden(false);
    }
  }, [key]);

  if (hidden) return null;
  const urgent = kind === "expired" || days <= 1;
  const Icon = urgent ? ExclamationTriangleIcon : SparklesIcon;

  return (
    <div className={`${urgent ? "bg-warning-50 text-warning-800 border-warning-200" : "bg-brand-50 text-brand-800 border-brand-100"} border-b`}>
      <div className="flex items-center gap-3 px-3 py-2 text-sm sm:px-6 lg:px-8">
        <Icon className="h-5 w-5 flex-none" />
        <p className="min-w-0 flex-1">
          {kind === "trial" && t("trial", { days })}
          {kind === "expired" && t("expired", { plan: planName })}
          {kind === "paidEnding" && t("paidEnding", { days })}{" "}
          <Link href="/dashboard/settings/billing" className="font-semibold underline underline-offset-2">
            {t("cta")}
          </Link>
        </p>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            try { localStorage.setItem(key, String(Date.now() + SNOOZE_MS)); } catch { /* storage blocked */ }
            setHidden(true);
          }}
          className="flex-none rounded p-1 hover:bg-black/5"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
