"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { LockClosedIcon, LockOpenIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui";
import { reconcileAndLock, unlockCashierSession } from "./actions";

export interface LockedInfo {
  id: string;
  countedCash: number;
  variance: number;
  closingBalance: number;
  lockedByName: string | null;
  lockedAtText: string | null;
  hasAdjustment: boolean;
}

export default function ReconcileForm({
  businessDate,
  propertyId,
  closingBalance,
  locked,
  canManage,
}: {
  businessDate: string;
  propertyId: string;
  closingBalance: number;
  locked: LockedInfo | null;
  canManage: boolean;
}) {
  const t = useTranslations("settings.cashier");
  const router = useRouter();

  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const countedNum = parseFloat(counted);
  const variance = Number.isFinite(countedNum) ? countedNum - closingBalance : null;
  const money = (n: number) => `${n.toFixed(3)} OMR`;
  const signed = (n: number) => `${n > 0 ? "+" : ""}${money(n)}`;

  async function submit() {
    if (!counted || !Number.isFinite(countedNum) || countedNum < 0) {
      toast.error(t("errors.counted"));
      return;
    }
    const fd = new FormData();
    fd.set("businessDate", businessDate);
    fd.set("propertyId", propertyId);
    fd.set("countedCash", counted);
    fd.set("notes", notes);

    setSaving(true);
    const res = await reconcileAndLock(fd);
    setSaving(false);
    if (res.error) { toast.error(t(`errors.${res.error}`) ?? t("errors.generic")); return; }
    toast.success(t("lockedToast"));
    setCounted(""); setNotes("");
    router.refresh();
  }

  async function unlock() {
    if (!locked) return;
    if (!confirm(t("unlockConfirm"))) return;
    setUnlocking(true);
    const res = await unlockCashierSession(locked.id);
    setUnlocking(false);
    if (res.error) { toast.error(t(`errors.${res.error}`) ?? t("errors.generic")); return; }
    toast.success(t("unlockedToast"));
    router.refresh();
  }

  // ── Locked state ──
  if (locked) {
    const balanced = Math.abs(locked.variance) < 0.001;
    return (
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
            <LockClosedIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-900">{t("lockedTitle")}</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {locked.lockedByName && <>{t("lockedBy", { name: locked.lockedByName })}</>}
              {locked.lockedAtText && <> · {locked.lockedAtText}</>}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label={t("closingBalance")} value={money(locked.closingBalance)} />
              <Stat label={t("countedCash")} value={money(locked.countedCash)} />
              <Stat
                label={t("variance")}
                value={signed(locked.variance)}
                tone={balanced ? "green" : "red"}
              />
            </div>
            {locked.hasAdjustment && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700 ring-1 ring-amber-200">
                {t("adjustmentPosted")}
              </p>
            )}
            {canManage && (
              <div className="mt-4">
                <button
                  onClick={unlock}
                  disabled={unlocking}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50"
                >
                  <LockOpenIcon className="h-3.5 w-3.5" />
                  {unlocking ? t("unlocking") : t("unlockBtn")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Reconcile (open) state ──
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <h3 className="text-sm font-semibold text-gray-900">{t("lockTitle")}</h3>
      <p className="mt-0.5 mb-4 text-xs text-gray-500">{t("lockSubtitle")}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={t("closingBalance")}>
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 ltr-numbers">{money(closingBalance)}</div>
        </Field>
        <Field label={t("countedCash")} required>
          <input
            inputMode="decimal" value={counted}
            onChange={(e) => setCounted(e.target.value)}
            placeholder="0.000"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-end ltr-numbers focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </Field>
        <Field label={t("variance")}>
          <div className={`rounded-lg px-3 py-2 text-sm font-semibold ltr-numbers ${variance === null ? "bg-gray-50 text-gray-400" : Math.abs(variance) < 0.001 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {variance === null ? "—" : signed(variance)}
          </div>
        </Field>
      </div>

      <div className="mt-4">
        <Field label={t("notes")}>
          <input
            value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder={t("notesPlaceholder")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </Field>
      </div>

      {variance !== null && Math.abs(variance) >= 0.001 && (
        <p className="mt-3 text-[11px] text-gray-500">{t("varianceWillAdjust")}</p>
      )}

      <div className="mt-5">
        <Button onClick={submit} loading={saving}>
          <LockClosedIcon className="h-4 w-4" />
          {saving ? t("locking") : t("reconcileLockBtn")}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" }) {
  const cls = tone === "green" ? "text-green-700" : tone === "red" ? "text-red-600" : "text-gray-900";
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ltr-numbers ${cls}`}>{value}</p>
    </div>
  );
}
