"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  TextField,
  TextArea,
  Select,
  NumberField,
  Toggle,
  Badge,
} from "@/components/ui";
import {
  SCORE_FACTORS,
  computeScoring,
  type ScoreFactor,
  type ScoreValue,
} from "@/utils/crm-scoring";
import { ScoreSelector } from "../_lib/ScoreSelector";
import {
  CONTACT_ROLES,
  AREAS,
  SOURCES,
  STAGES,
  INTERESTS,
  CONTACT_ROLE_LABELS,
  AREA_LABELS,
  SOURCE_LABELS,
  STAGE_LABELS,
  INTEREST_LABELS,
  toOptions,
  tierBadge,
  tierLabel,
} from "../_lib/crm-options";
import { createProspect, updateProspect } from "./actions";
import type { ProspectRow } from "./page";

/* ── Form state ───────────────────────────────────────────────────────────── */

type Values = {
  businessName: string;
  contactPersonName: string;
  roleOfContact: string;
  phone: string;
  area: string;
  addressNotes: string;
  source: string;
  estimatedUnits: number | null;
  listedOnBooking: boolean;
  websiteOrSocial: string;
  scores: Record<ScoreFactor, ScoreValue>;
  stage: string;
  interestLevel: string;
  mainPainNamed: string;
  nextFollowupDate: string; // yyyy-mm-dd
  lostReason: string;
  notes: string;
};

function initialValues(p?: ProspectRow | null): Values {
  return {
    businessName: p?.businessName ?? "",
    contactPersonName: p?.contactPersonName ?? "",
    roleOfContact: p?.roleOfContact ?? "UNKNOWN",
    phone: p?.phone ?? "",
    area: p?.area ?? "OTHER",
    addressNotes: p?.addressNotes ?? "",
    source: p?.source ?? "OTHER",
    estimatedUnits: p?.estimatedUnits ?? null,
    listedOnBooking: p?.listedOnBooking ?? false,
    websiteOrSocial: p?.websiteOrSocial ?? "",
    scores: {
      scoreSize: (p?.scoreSize as ScoreValue) ?? 1,
      scoreKhareefActivity: (p?.scoreKhareefActivity as ScoreValue) ?? 1,
      scorePainSignals: (p?.scorePainSignals as ScoreValue) ?? 1,
      scoreDigitalComfort: (p?.scoreDigitalComfort as ScoreValue) ?? 1,
      scoreReachability: (p?.scoreReachability as ScoreValue) ?? 1,
    },
    stage: p?.stage ?? "NOT_CONTACTED",
    interestLevel: p?.interestLevel ?? "UNKNOWN",
    mainPainNamed: p?.mainPainNamed ?? "",
    nextFollowupDate: p?.nextFollowupDate ? p.nextFollowupDate.slice(0, 10) : "",
    lostReason: p?.lostReason ?? "",
    notes: p?.notes ?? "",
  };
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-tertiary">{children}</h3>
);

export default function ProspectFormModal({
  open,
  onClose,
  prospect,
}: {
  open: boolean;
  onClose: () => void;
  prospect?: ProspectRow | null;
}) {
  const router = useRouter();
  const isEdit = !!prospect;
  const [v, setV] = useState<Values>(() => initialValues(prospect));
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  const { scoreTotal, tier } = useMemo(() => computeScoring(v.scores), [v.scores]);

  const submit = () => {
    if (!v.businessName.trim()) {
      toast.error("Business name is required");
      return;
    }
    const fd = new FormData();
    if (prospect) fd.set("id", prospect.id);
    fd.set("businessName", v.businessName);
    fd.set("contactPersonName", v.contactPersonName);
    fd.set("roleOfContact", v.roleOfContact);
    fd.set("phone", v.phone);
    fd.set("area", v.area);
    fd.set("addressNotes", v.addressNotes);
    fd.set("source", v.source);
    if (v.estimatedUnits != null) fd.set("estimatedUnits", String(v.estimatedUnits));
    fd.set("listedOnBooking", v.listedOnBooking ? "true" : "false");
    fd.set("websiteOrSocial", v.websiteOrSocial);
    SCORE_FACTORS.forEach((f) => fd.set(f, String(v.scores[f])));
    fd.set("stage", v.stage);
    fd.set("interestLevel", v.interestLevel);
    fd.set("mainPainNamed", v.mainPainNamed);
    fd.set("nextFollowupDate", v.nextFollowupDate);
    fd.set("lostReason", v.lostReason);
    fd.set("notes", v.notes);

    startTransition(async () => {
      const res = isEdit ? await updateProspect(fd) : await createProspect(fd);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(isEdit ? "Prospect updated" : "Prospect added");
      router.refresh();
      onClose();
    });
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" variant="centered">
      <ModalHeader
        title={isEdit ? "Edit prospect" : "Add prospect"}
        subtitle={isEdit ? prospect?.businessName : "Score them into a tier as you fill this in"}
      />
      <ModalBody>
        <div className="space-y-6">
          {/* ── Business ───────────────────────────────────────────── */}
          <section className="space-y-3">
            <SectionTitle>Business</SectionTitle>
            <TextField
              label="Business name"
              required
              value={v.businessName}
              onChange={(e) => set("businessName", e.target.value)}
              placeholder="e.g. Salalah Bay Apartments"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Contact person"
                value={v.contactPersonName}
                onChange={(e) => set("contactPersonName", e.target.value)}
                placeholder="Name"
              />
              <Select
                label="Their role"
                value={v.roleOfContact}
                onChange={(e) => set("roleOfContact", e.target.value)}
                options={toOptions(CONTACT_ROLES, CONTACT_ROLE_LABELS)}
              />
              <TextField
                label="Phone (WhatsApp)"
                value={v.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="9XXXXXXX"
                inputMode="tel"
              />
              <Select
                label="Area"
                value={v.area}
                onChange={(e) => set("area", e.target.value)}
                options={toOptions(AREAS, AREA_LABELS)}
              />
              <Select
                label="Source"
                value={v.source}
                onChange={(e) => set("source", e.target.value)}
                options={toOptions(SOURCES, SOURCE_LABELS)}
              />
              <NumberField
                label="Estimated units"
                value={v.estimatedUnits}
                onValueChange={(n) => set("estimatedUnits", n)}
                min={0}
                step={1}
                placeholder="—"
              />
            </div>
            <TextField
              label="Website / social"
              value={v.websiteOrSocial}
              onChange={(e) => set("websiteOrSocial", e.target.value)}
              placeholder="instagram.com/… or website"
            />
            <TextArea
              label="Address notes"
              value={v.addressNotes}
              onChange={(e) => set("addressNotes", e.target.value)}
              rows={2}
              placeholder="Landmark, building, how to find them…"
            />
            <Toggle
              label="Listed on Booking.com"
              description="Priority signal — they already run short-term lets online"
              checked={v.listedOnBooking}
              onCheckedChange={(c) => set("listedOnBooking", c)}
            />
          </section>

          {/* ── Qualification score ────────────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <SectionTitle>Qualification score</SectionTitle>
              <div className="flex items-center gap-2 rounded-lg bg-subtle px-3 py-1.5">
                <span className="text-sm font-bold tabular-nums text-fg">{scoreTotal}</span>
                <span className="text-xs text-fg-tertiary">/ 25</span>
                <Badge {...tierBadge(tier)} size="sm">
                  {tierLabel(tier)}
                </Badge>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {SCORE_FACTORS.map((f) => (
                <ScoreSelector
                  key={f}
                  factor={f}
                  value={v.scores[f]}
                  onChange={(val) => set("scores", { ...v.scores, [f]: val })}
                />
              ))}
            </div>
            <p className="text-[11px] text-fg-tertiary">
              Tier 1 = score 20+ (go now) · Tier 2 = 13–19 (nurture) · Tier 3 = under 13 (later)
            </p>
          </section>

          {/* ── Pipeline ───────────────────────────────────────────── */}
          <section className="space-y-3">
            <SectionTitle>Pipeline</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Stage"
                value={v.stage}
                onChange={(e) => set("stage", e.target.value)}
                options={toOptions(STAGES, STAGE_LABELS)}
              />
              <Select
                label="Interest level"
                value={v.interestLevel}
                onChange={(e) => set("interestLevel", e.target.value)}
                options={toOptions(INTERESTS, INTEREST_LABELS)}
              />
            </div>
            <TextArea
              label="Main pain named"
              helperText="What they told you hurts — this drives your pitch"
              value={v.mainPainNamed}
              onChange={(e) => set("mainPainNamed", e.target.value)}
              rows={2}
            />
            <TextField
              label="Next follow-up date"
              type="date"
              value={v.nextFollowupDate}
              onChange={(e) => set("nextFollowupDate", e.target.value)}
            />
            {v.stage === "LOST" && (
              <TextArea
                label="Lost reason"
                helperText="For pattern analysis across lost deals"
                value={v.lostReason}
                onChange={(e) => set("lostReason", e.target.value)}
                rows={2}
              />
            )}
          </section>

          {/* ── Notes ──────────────────────────────────────────────── */}
          <section className="space-y-3">
            <SectionTitle>Notes</SectionTitle>
            <TextArea
              label="Quick notes"
              value={v.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              reserveMessageSpace={false}
            />
          </section>
        </div>
      </ModalBody>
      <ModalFooter justify="between" sticky>
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit} loading={pending}>
          {isEdit ? "Save changes" : "Add prospect"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
