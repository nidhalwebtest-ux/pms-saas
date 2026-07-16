"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowTopRightOnSquareIcon, LinkIcon, PencilSquareIcon, EyeIcon, EyeSlashIcon,
  BuildingOffice2Icon, InboxArrowDownIcon,
} from "@heroicons/react/24/outline";
import { Button, Badge } from "@/components/ui";
import LivePreview from "./LivePreview";
import { setWebsiteStatus } from "./actions";
import type { WebsiteForm, WebsiteStatus } from "./types";

export default function WebsiteDashboard({
  form, status, rootDomain, stats, onEdit,
}: {
  form: WebsiteForm;
  status: WebsiteStatus;
  rootDomain: string;
  stats: { buildings: number; units: number };
  onEdit: () => void;
}) {
  const t = useTranslations("settings.website");
  const router = useRouter();
  const [pending, start] = useTransition();

  const host = `${form.slug}.${rootDomain}`;
  const url = `https://${host}`;
  const published = status === "PUBLISHED";

  const toggle = () =>
    start(async () => {
      const res = await setWebsiteStatus(published ? "DISABLED" : "PUBLISHED");
      if (res.ok) { toast.success(t(published ? "dash.disabledToast" : "dash.enabledToast")); router.refresh(); }
      else toast.error(t("errors.generic"));
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Left: status + URL + stats */}
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <Badge tone={published ? "success" : "neutral"} appearance="subtle">
              {t(published ? "dash.statusLive" : "dash.statusOffline")}
            </Badge>
            <span className="text-sm text-gray-500">{t(published ? "dash.liveDesc" : "dash.offlineDesc")}</span>
          </div>
          <Button
            variant={published ? "secondary" : "primary"}
            size="sm"
            loading={pending}
            onClick={toggle}
            leftIcon={published ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          >
            {t(published ? "dash.takeOffline" : "dash.goLive")}
          </Button>
        </div>

        {/* URL card */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-2 text-xs font-medium text-gray-500">{t("dash.yourUrl")}</p>
          <a href={url} target="_blank" rel="noreferrer" dir="ltr"
             className="block truncate text-lg font-bold text-blue-700 hover:underline">{host}</a>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => window.open(url, "_blank", "noreferrer")}
              leftIcon={<ArrowTopRightOnSquareIcon className="h-4 w-4" />}>{t("launch.open")}</Button>
            <Button variant="ghost" size="sm" leftIcon={<LinkIcon className="h-4 w-4" />}
              onClick={() => { navigator.clipboard?.writeText(url); toast.success(t("launch.copied")); }}>
              {t("launch.copy")}
            </Button>
            <Button variant="ghost" size="sm" onClick={onEdit} leftIcon={<PencilSquareIcon className="h-4 w-4" />}>
              {t("dash.edit")}
            </Button>
          </div>
        </div>

        {/* Stat placeholders */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-gray-400"><InboxArrowDownIcon className="h-5 w-5" /><span className="text-xs">{t("dash.requests")}</span></div>
            <div className="mt-1 text-2xl font-bold text-gray-900">—</div>
            <div className="text-xs text-gray-400">{t("dash.comingSoon")}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-gray-400"><BuildingOffice2Icon className="h-5 w-5" /><span className="text-xs">{t("dash.published")}</span></div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{stats.buildings}</div>
            <div className="text-xs text-gray-400">{t("dash.buildingsUnits", { units: stats.units })}</div>
          </div>
        </div>
      </div>

      {/* Right: live preview */}
      <div>
        <LivePreview form={form} template={form.templateKey} lang={form.defaultLanguage} />
        <p className="mt-2 text-center text-xs text-gray-400">{t("dash.previewNote")}</p>
      </div>
    </div>
  );
}
