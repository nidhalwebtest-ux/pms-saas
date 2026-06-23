"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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
  SOURCES,
  STAGES,
  INTERESTS,
  tierBadge,
  tierLabel,
} from "../_lib/crm-options";
import { pickAreaLabel, type AreaOption } from "../_lib/area-label";
import { createProspect, updateProspect } from "./actions";
import type { ProspectRow } from "./page";

/* ── Form state ───────────────────────────────────────────────────────────── */

type Values = {
  businessName: string;
  contactPersonName: string;
  roleOfContact: string;
  phone: string;
  areaId: string;
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
    areaId: p?.areaId ?? "",
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
  areas,
}: {
  open: boolean;
  onClose: () => void;
  prospect?: ProspectRow | null;
  areas: AreaOption[];
}) {
  const router = useRouter();
  const t = useTranslations("admin");
  const locale = useLocale();
  const isEdit = !!prospect;
  const [v, setV] = useState<Values>(() => initialValues(prospect));
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  const { scoreTotal, tier } = useMemo(() => computeScoring(v.scores), [v.scores]);

  const submit = () => {
    if (!v.businessName.trim()) {
      toast.error(t("form.requiredBusinessName"));
      return;
    }
    const fd = new FormData();
    if (prospect) fd.set("id", prospect.id);
    fd.set("businessName", v.businessName);
    fd.set("contactPersonName", v.contactPersonName);
    fd.set("roleOfContact", v.roleOfContact);
    fd.set("phone", v.phone);
    fd.set("areaId", v.areaId);
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
      toast.success(isEdit ? t("form.updated") : t("form.added"));
      router.refresh();
      onClose();
    });
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" variant="centered">
      <ModalHeader
        title={isEdit ? t("form.editTitle") : t("form.addTitle")}
        subtitle={isEdit ? prospect?.businessName : t("form.addSubtitle")}
      />
      <ModalBody>
        <div className="space-y-6">
          {/* ── Business ───────────────────────────────────────────── */}
          <section className="space-y-3">
            <SectionTitle>{t("form.sections.business")}</SectionTitle>
            <TextField
              label={t("form.businessName")}
              required
              value={v.businessName}
              onChange={(e) => set("businessName", e.target.value)}
              placeholder={t("form.businessNamePh")}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label={t("form.contactPerson")}
                value={v.contactPersonName}
                onChange={(e) => set("contactPersonName", e.target.value)}
                placeholder={t("form.contactPersonPh")}
              />
              <Select
                label={t("form.theirRole")}
                value={v.roleOfContact}
                onChange={(e) => set("roleOfContact", e.target.value)}
                options={CONTACT_ROLES.map((v) => ({ value: v, label: t(`enums.contactRole.${v}`) }))}
              />
              <TextField
                label={t("form.phone")}
                value={v.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder={t("form.phonePh")}
                inputMode="tel"
              />
              <Select
                label={t("form.area")}
                value={v.areaId}
                onChange={(e) => set("areaId", e.target.value)}
                options={[
                  { value: "", label: t("form.areaNone") },
                  ...areas.map((a) => ({ value: a.id, label: pickAreaLabel(locale, a.name, a.nameAr) })),
                ]}
              />
              <Select
                label={t("form.source")}
                value={v.source}
                onChange={(e) => set("source", e.target.value)}
                options={SOURCES.map((v) => ({ value: v, label: t(`enums.source.${v}`) }))}
              />
              <NumberField
                label={t("form.estimatedUnits")}
                value={v.estimatedUnits}
                onValueChange={(n) => set("estimatedUnits", n)}
                min={0}
                step={1}
                placeholder="—"
              />
            </div>
            <TextField
              label={t("form.websiteSocial")}
              value={v.websiteOrSocial}
              onChange={(e) => set("websiteOrSocial", e.target.value)}
              placeholder={t("form.websiteSocialPh")}
            />
            <TextArea
              label={t("form.addressNotes")}
              value={v.addressNotes}
              onChange={(e) => set("addressNotes", e.target.value)}
              rows={2}
              placeholder={t("form.addressNotesPh")}
            />
            <Toggle
              label={t("form.listedOnBooking")}
              description={t("form.listedOnBookingDesc")}
              checked={v.listedOnBooking}
              onCheckedChange={(c) => set("listedOnBooking", c)}
            />
          </section>

          {/* ── Qualification score ────────────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <SectionTitle>{t("form.sections.score")}</SectionTitle>
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
            <p className="text-[11px] text-fg-tertiary">{t("scoring.tierLegend")}</p>
          </section>

          {/* ── Pipeline ───────────────────────────────────────────── */}
          <section className="space-y-3">
            <SectionTitle>{t("form.sections.pipeline")}</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label={t("form.stage")}
                value={v.stage}
                onChange={(e) => set("stage", e.target.value)}
                options={STAGES.map((v) => ({ value: v, label: t(`enums.stage.${v}`) }))}
              />
              <Select
                label={t("form.interest")}
                value={v.interestLevel}
                onChange={(e) => set("interestLevel", e.target.value)}
                options={INTERESTS.map((v) => ({ value: v, label: t(`enums.interest.${v}`) }))}
              />
            </div>
            <TextArea
              label={t("form.mainPain")}
              helperText={t("form.mainPainHelper")}
              value={v.mainPainNamed}
              onChange={(e) => set("mainPainNamed", e.target.value)}
              rows={2}
            />
            <TextField
              label={t("form.nextFollowup")}
              type="date"
              value={v.nextFollowupDate}
              onChange={(e) => set("nextFollowupDate", e.target.value)}
            />
            {v.stage === "LOST" && (
              <TextArea
                label={t("form.lostReason")}
                helperText={t("form.lostReasonHelper")}
                value={v.lostReason}
                onChange={(e) => set("lostReason", e.target.value)}
                rows={2}
              />
            )}
          </section>

          {/* ── Notes ──────────────────────────────────────────────── */}
          <section className="space-y-3">
            <SectionTitle>{t("form.sections.notes")}</SectionTitle>
            <TextArea
              label={t("form.quickNotes")}
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
          {t("common.cancel")}
        </Button>
        <Button variant="primary" onClick={submit} loading={pending}>
          {isEdit ? t("common.save") : t("prospects.addProspect")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
