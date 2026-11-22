"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { GlobeAltIcon, ClipboardDocumentIcon, ArrowPathIcon, CheckCircleIcon, ClockIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Button, Badge } from "@/components/ui";
import type { CustomDomainStatus } from "@/lib/public-site/custom-domain";
import type { DnsRecord } from "@/lib/public-site/custom-domain-shared";
import { saveCustomDomain, checkWebsiteCustomDomain, removeCustomDomain } from "./actions";

function Records({ records, title }: { records: DnsRecord[]; title: string }) {
  const t = useTranslations("settings.website.domain");
  const copy = (v: string) => { navigator.clipboard?.writeText(v); toast.success(t("copied")); };
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs font-medium text-gray-600">{title}</p>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[420px] text-start text-xs" dir="ltr">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-3 py-1.5 text-start font-medium">{t("recordType")}</th>
              <th className="px-3 py-1.5 text-start font-medium">{t("recordName")}</th>
              <th className="px-3 py-1.5 text-start font-medium">{t("recordValue")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-3 py-2 font-semibold text-gray-900">{r.type}</td>
                <td className="px-3 py-2 font-mono text-gray-800">{r.name}</td>
                <td className="break-all px-3 py-2 font-mono text-gray-800">{r.value}</td>
                <td className="px-2">
                  <button type="button" onClick={() => copy(r.value)} aria-label={t("copy")} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                    <ClipboardDocumentIcon className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Settings → Website: connect your own domain (www.yourhotel.com) to the booking site. */
export default function CustomDomainCard({ host, status }: { host: string | null; status: CustomDomainStatus | null }) {
  const t = useTranslations("settings.website.domain");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState("");

  const fail = (error: string, message?: string) => toast.error(message ?? t(`errors.${error}`));

  const connect = () =>
    start(async () => {
      const res = await saveCustomDomain(value);
      if (!res.ok) return void fail(res.error, res.message);
      toast.success(t("saved"));
      setValue("");
      router.refresh();
    });
  const recheck = () =>
    start(async () => {
      const res = await checkWebsiteCustomDomain();
      if (!res.ok) return void fail(res.error, res.message);
      if (res.status?.state === "active") toast.success(t("nowActive"));
      router.refresh();
    });
  const remove = () => {
    if (!window.confirm(t("removeConfirm"))) return;
    start(async () => {
      const res = await removeCustomDomain();
      if (!res.ok) return void fail(res.error, res.message);
      toast.success(t("removed"));
      router.refresh();
    });
  };

  const state = status?.state;
  const badge =
    state === "active" ? { tone: "success" as const, Icon: CheckCircleIcon, label: t("stateActive") }
    : state === "error" ? { tone: "danger" as const, Icon: ExclamationTriangleIcon, label: t("stateError") }
    : { tone: "warning" as const, Icon: ClockIcon, label: state === "pending_verification" ? t("stateVerify") : t("stateDns") };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-blue-50 p-2"><GlobeAltIcon className="h-5 w-5 text-blue-600" /></div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900">{t("title")}</h3>
          <p className="mt-0.5 text-xs text-gray-500">{t("hint")}</p>
        </div>
      </div>

      {!host ? (
        <div className="mt-4 flex flex-wrap items-start gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && value.trim() && connect()}
            placeholder="www.yourhotel.com"
            dir="ltr"
            className="min-w-[200px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            aria-label={t("title")}
          />
          <Button variant="primary" onClick={connect} loading={pending} disabled={!value.trim()}>{t("connect")}</Button>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-bold text-gray-900" dir="ltr">{host}</span>
            <Badge tone={badge.tone} appearance="subtle">{badge.label}</Badge>
          </div>

          {state === "active" && <p className="mt-2 text-xs text-green-700">{t("activeNote", { host })}</p>}

          {state === "pending_dns" && (
            <>
              <p className="mt-2 text-xs text-gray-600">{t("dnsNote")}</p>
              <Records records={status!.records} title={t("recordsTitle")} />
              <p className="mt-2 text-xs text-gray-400">{t("dnsWait")}</p>
            </>
          )}

          {state === "pending_verification" && (
            <>
              <p className="mt-2 text-xs text-gray-600">{t("verifyNote")}</p>
              <Records records={status!.verification ?? []} title={t("verifyTitle")} />
              <Records records={status!.records} title={t("recordsTitle")} />
            </>
          )}

          {state === "error" && status?.error && (
            <p className="mt-2 break-words rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" dir="ltr">{status.error}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {state !== "active" && (
              <Button variant="secondary" size="sm" onClick={recheck} loading={pending} leftIcon={<ArrowPathIcon className="h-4 w-4" />}>{t("checkAgain")}</Button>
            )}
            <Button variant="ghost" size="sm" onClick={remove} disabled={pending}>{t("remove")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
