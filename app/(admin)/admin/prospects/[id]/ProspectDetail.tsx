"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
} from "@heroicons/react/24/outline";
import { Badge, Button } from "@/components/ui";
import {
  AREA_LABELS,
  SOURCE_LABELS,
  CONTACT_ROLE_LABELS,
  INTERESTS,
  INTEREST_LABELS,
  stageBadge,
  interestBadge,
  tierBadge,
  tierLabel,
  STAGE_LABELS,
} from "../../_lib/crm-options";
import { fmtDate } from "../../_lib/format";
import { waLink } from "@/utils/whatsapp";
import { updateInterest } from "../actions";
import ProspectFormModal from "../ProspectFormModal";
import StageControl from "./StageControl";
import ScoringCard from "./ScoringCard";
import VisitsTimeline from "./VisitsTimeline";
import FollowupsCard from "./FollowupsCard";
import NotesCard from "./NotesCard";
import type { ProspectDetailData } from "./page";

function InterestControl({ id, interest }: { id: string; interest: string }) {
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
      <span className="text-xs font-medium text-fg-tertiary">Interest</span>
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
              {INTEREST_LABELS[v]}
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

export default function ProspectDetail({ prospect: p }: { prospect: ProspectDetailData }) {
  const [editOpen, setEditOpen] = useState(false);
  const wa = waLink(p.phone);

  return (
    <div className="space-y-4">
      <Link
        href="/admin/prospects"
        className="inline-flex items-center gap-1.5 text-sm text-fg-secondary hover:text-fg"
      >
        <ArrowLeftIcon className="h-4 w-4" /> All prospects
      </Link>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border-default bg-surface p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-fg sm:text-xl">{p.businessName}</h1>
              <Badge {...tierBadge(p.tier)} size="sm">{tierLabel(p.tier)}</Badge>
              <Badge {...stageBadge(p.stage)} size="sm">{STAGE_LABELS[p.stage] ?? p.stage}</Badge>
              {p.interestLevel !== "UNKNOWN" && (
                <Badge {...interestBadge(p.interestLevel)} size="sm">
                  {INTEREST_LABELS[p.interestLevel]}
                </Badge>
              )}
              {p.listedOnBooking && (
                <Badge tone="accent" appearance="subtle" size="sm">On Booking.com</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-fg-secondary">
              {p.contactPersonName
                ? `${p.contactPersonName} · ${CONTACT_ROLE_LABELS[p.roleOfContact] ?? ""}`.replace(/ · $/, "")
                : "No contact name yet"}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
              <Chip icon={MapPinIcon}>{AREA_LABELS[p.area] ?? "—"}</Chip>
              <Chip icon={BuildingOffice2Icon}>
                {p.estimatedUnits != null ? `${p.estimatedUnits} units` : "Units unknown"}
              </Chip>
              <Chip icon={FireIcon}>{SOURCE_LABELS[p.source] ?? "—"}</Chip>
              {p.nextFollowupDate && <Chip icon={PhoneIcon}>Next: {fmtDate(p.nextFollowupDate)}</Chip>}
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
                  WhatsApp
                </Button>
              </a>
            ) : (
              <span className="text-xs text-fg-tertiary">No phone</span>
            )}
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<PencilSquareIcon className="h-4 w-4" />}
              onClick={() => setEditOpen(true)}
            >
              Edit
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
        <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-700">Main pain</h3>
        <p className={`mt-1 ${p.mainPainNamed ? "text-sm text-fg" : "text-sm text-fg-tertiary"}`}>
          {p.mainPainNamed ?? "Not captured yet — name their pain (Edit) so it can drive your pitch."}
        </p>
      </div>

      {/* ── Stage + interest ───────────────────────────────────────── */}
      <StageControl prospectId={p.id} stage={p.stage} lostReason={p.lostReason} />
      <div className="rounded-2xl border border-border-default bg-surface px-4 py-3">
        <InterestControl id={p.id} interest={p.interestLevel} />
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

      <ProspectFormModal open={editOpen} onClose={() => setEditOpen(false)} prospect={p} />
    </div>
  );
}
