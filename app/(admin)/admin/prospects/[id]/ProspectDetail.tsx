"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  PencilSquareIcon,
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  GlobeAltIcon,
  MapPinIcon,
  BuildingOffice2Icon,
  FireIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { Badge, Button, useConfirmDialog } from "@/components/ui";
import {
  INTERESTS,
  stageBadge,
  interestBadge,
  tierBadge,
  tierLabel,
} from "../../_lib/crm-options";
import { fmtDate } from "../../_lib/format";
import type { AreaOption } from "../../_lib/area-label";
import { waLink } from "@/utils/whatsapp";
import { updateInterest, deleteProspect } from "../actions";
import ProspectFormModal from "../ProspectFormModal";
import StageControl from "./StageControl";
import ScoringCard from "./ScoringCard";
import VisitsTimeline from "./VisitsTimeline";
import FollowupsCard from "./FollowupsCard";
import NotesCard from "./NotesCard";
import BuildingPhoto from "./BuildingPhoto";
import LocationCard from "./LocationCard";
import type { ProspectDetailData } from "./page";

function InterestControl({ id, interest }: { id: string; interest: string }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const set = (v: string) =>
    startTransition(async () => {
      const res = await updateInterest(id, v);
      if ("error" in res) { toast.error(res.error); return; }
      router.refresh();
    });
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-fg-tertiary">{t("detail.interest.label")}</span>
      <div className="flex gap-1">
        {INTERESTS.map((v) => {
          const active = interest === v;
          return (
            <button
              key={v}
              type="button"
              disabled={pending}
              onClick={() => set(v)}
              aria-pressed={active}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                active
                  ? "bg-brand-500 text-white"
                  : "bg-subtle text-fg-secondary hover:bg-border-subtle"
              }`}
            >
              {t(`enums.interest.${v}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ icon: Icon, children }: { icon: typeof MapPinIcon; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-fg-secondary">
      <Icon className="h-3.5 w-3.5 text-fg-tertiary" />
      {children}
    </span>
  );
}

export default function ProspectDetail({
  prospect: p,
  areas,
}: {
  prospect: ProspectDetailData;
  areas: AreaOption[];
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [editOpen, setEditOpen] = useState(false);
  const [, startDelete] = useTransition();
  const wa = waLink(p.phone);

  const onDelete = async () => {
    const { confirmed } = await confirm({
      title: t("detail.delete.title"),
      description: t("detail.delete.message", { name: p.businessName }),
      confirmLabel: t("detail.delete.confirm"),
      tone: "destructive",
    });
    if (!confirmed) return;
    startDelete(async () => {
      const res = await deleteProspect(p.id);
      if ("error" in res) { toast.error(res.error); return; }
      toast.success(t("detail.delete.done"));
      router.push("/admin/prospects");
    });
  };

  return (
    <div className="space-y-4">
      <Link
        href="/admin/prospects"
        className="inline-flex items-center gap-1.5 text-sm text-fg-secondary hover:text-fg"
      >
        <ArrowLeftIcon className="h-4 w-4" /> {t("detail.allProspects")}
      </Link>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border-default bg-surface p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-fg sm:text-xl">{p.businessName}</h1>
              <Badge {...tierBadge(p.tier)} size="sm">{tierLabel(p.tier)}</Badge>
              <Badge {...stageBadge(p.stage)} size="sm">{t(`enums.stage.${p.stage}`)}</Badge>
              {p.interestLevel !== "UNKNOWN" && (
                <Badge {...interestBadge(p.interestLevel)} size="sm">
                  {t(`enums.interest.${p.interestLevel}`)}
                </Badge>
              )}
              {p.listedOnBooking && (
                <Badge tone="accent" appearance="subtle" size="sm">{t("detail.onBooking")}</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-fg-secondary">
              {p.contactPersonName
                ? `${p.contactPersonName} · ${t(`enums.contactRole.${p.roleOfContact}`)}`.replace(/ · $/, "")
                : t("detail.noContactName")}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
              <Chip icon={MapPinIcon}>
                <span className="inline-flex items-center gap-1.5">
                  {p.areaColor && (
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: p.areaColor }}
                    />
                  )}
                  {p.areaLabel}
                </span>
              </Chip>
              <Chip icon={BuildingOffice2Icon}>
                {p.estimatedUnits != null
                  ? t("detail.unitsCount", { count: p.estimatedUnits })
                  : t("detail.unitsUnknown")}
              </Chip>
              <Chip icon={FireIcon}>{t(`enums.source.${p.source}`)}</Chip>
              {p.nextFollowupDate && (
                <Chip icon={PhoneIcon}>{t("detail.next", { date: fmtDate(p.nextFollowupDate) })}</Chip>
              )}
              {p.websiteOrSocial && (
                <a
                  href={p.websiteOrSocial.startsWith("http") ? p.websiteOrSocial : `https://${p.websiteOrSocial}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:underline"
                >
                  <GlobeAltIcon className="h-3.5 w-3.5" /> {p.websiteOrSocial}
                </a>
              )}
            </div>
            {p.addressNotes && <p className="mt-2 text-xs text-fg-tertiary">{p.addressNotes}</p>}
          </div>

          {/* Actions */}
          <div className="flex flex-shrink-0 items-center gap-2">
            {wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer">
                <Button variant="primary" size="sm" leftIcon={<ChatBubbleLeftRightIcon className="h-4 w-4" />}>
                  {t("detail.whatsapp")}
                </Button>
              </a>
            ) : (
              <span className="text-xs text-fg-tertiary">{t("detail.noPhone")}</span>
            )}
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<PencilSquareIcon className="h-4 w-4" />}
              onClick={() => setEditOpen(true)}
            >
              {t("detail.edit")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              leftIcon={<TrashIcon className="h-4 w-4" />}
              className="text-error-600 hover:bg-error-50 hover:text-error-700"
              aria-label={t("detail.delete.confirm")}
            >
              <span className="hidden sm:inline">{t("detail.delete.button")}</span>
            </Button>
          </div>
        </div>

        {p.phone && (
          <div className="mt-3 flex items-center gap-3 border-t border-border-subtle pt-3">
            <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1.5 text-sm text-fg ltr-numbers">
              <PhoneIcon className="h-4 w-4 text-fg-tertiary" /> {p.phone}
            </a>
          </div>
        )}
      </div>

      {/* ── Main pain (prominent — drives the pitch) ───────────────── */}
      <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t("detail.mainPain.title")}</h3>
        <p className={`mt-1 ${p.mainPainNamed ? "text-sm text-fg" : "text-sm text-fg-tertiary"}`}>
          {p.mainPainNamed ?? t("detail.mainPain.empty")}
        </p>
      </div>

      {/* ── Stage + interest ───────────────────────────────────────── */}
      <StageControl prospectId={p.id} stage={p.stage} lostReason={p.lostReason} />
      <div className="rounded-2xl border border-border-default bg-surface px-4 py-3">
        <InterestControl id={p.id} interest={p.interestLevel} />
      </div>

      {/* ── Building photo + location ──────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BuildingPhoto prospectId={p.id} photo={p.buildingPhoto} />
        <LocationCard prospectId={p.id} latitude={p.latitude} longitude={p.longitude} />
      </div>

      {/* ── Working columns ────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <VisitsTimeline prospectId={p.id} stage={p.stage} visits={p.visits} />
          <ScoringCard prospect={p} />
        </div>
        <div className="space-y-4">
          <FollowupsCard prospectId={p.id} phone={p.phone} followups={p.followups} />
          <NotesCard prospectId={p.id} notes={p.notes} />
        </div>
      </div>

      {editOpen && (
        <ProspectFormModal key={p.id} open onClose={() => setEditOpen(false)} prospect={p} areas={areas} />
      )}
    </div>
  );
}
