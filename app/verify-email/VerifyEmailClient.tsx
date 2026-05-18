"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { resendVerificationEmail } from "./actions";
import {
  EnvelopeIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { Alert } from "@/components/ui";

const RESEND_COOLDOWN = 60; // seconds

export default function VerifyEmailClient({
  email,
  showDeliveryWarning = false,
}: {
  email: string;
  showDeliveryWarning?: boolean;
}) {
  const t       = useTranslations("auth.verify");
  const tCommon = useTranslations("auth.common");
  const [countdown, setCountdown] = useState(0);
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  // Tick the countdown
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  const handleResend = () => {
    setStatus("idle");
    setErrorMsg("");
    startTransition(async () => {
      const result = await resendVerificationEmail(email);
      if (result.error) {
        setStatus("error");
        setErrorMsg(result.error);
      } else {
        setStatus("sent");
        setCountdown(RESEND_COOLDOWN);
      }
    });
  };

  // Mask email: user@example.com → u***@example.com
  const maskedEmail = email
    ? email.replace(/^(.)(.*)(@.*)$/, (_, a, _b, domain) => `${a}${"*".repeat(4)}${domain}`)
    : "";

  return (
    <div
      className="w-full max-w-md"
      style={{ animation: "heroFadeUp 0.6s cubic-bezier(.4,0,.2,1) 0.1s both" }}
    >
      {/* Card */}
      <div className="rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-white/5">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
            <EnvelopeIcon className="h-10 w-10 text-blue-600" />
            {/* Pulse ring */}
            <span className="absolute inset-0 animate-ping rounded-full bg-blue-200 opacity-40" />
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {t("sentTo")}
          </p>
          {email && (
            <p className="mt-1 text-sm font-semibold text-slate-700">{maskedEmail}</p>
          )}
          <p className="mt-3 text-xs text-slate-400">
            {t("instructions")}
          </p>
        </div>

        <div className="mt-6 space-y-3">
          {showDeliveryWarning && status === "idle" && (
            <Alert variant="warning" description={t("warnEmailFailed")} />
          )}

          {status === "sent" && (
            <Alert variant="success" description={t("successResent")} />
          )}

          {status === "error" && (
            <Alert variant="error" description={errorMsg} />
          )}

          {/* Resend button */}
          <button
            type="button"
            onClick={handleResend}
            disabled={isPending || countdown > 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
            {isPending
              ? t("sending")
              : countdown > 0
                ? t("resendIn", { seconds: countdown })
                : t("resendButton")}
          </button>
        </div>
      </div>

      {/* Back link */}
      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-slate-200"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          {tCommon("backToSignIn")}
        </Link>
      </div>
    </div>
  );
}