"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  Checkbox,
} from "@/components/ui";
import { WHO_MET } from "../../_lib/crm-options";
import { logVisit } from "../actions";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function LogVisitModal({
  open,
  onClose,
  prospectId,
  stage,
}: {
  open: boolean;
  onClose: () => void;
  prospectId: string;
  stage: string;
}) {
  const router = useRouter();
  const t = useTranslations("admin");
  const [pending, startTransition] = useTransition();
  const [visitDate, setVisitDate] = useState(todayStr());
  const [whoMet, setWhoMet] = useState("OWNER");
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [objectionRaised, setObjectionRaised] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [advance, setAdvance] = useState(stage === "NOT_CONTACTED");
  const [seedRhythm, setSeedRhythm] = useState(true);

  const submit = () => {
    const fd = new FormData();
    fd.set("prospectId", prospectId);
    fd.set("visitDate", visitDate);
    fd.set("whoMet", whoMet);
    fd.set("outcomeNotes", outcomeNotes);
    fd.set("objectionRaised", objectionRaised);
    fd.set("nextAction", nextAction);
    fd.set("advanceToVisited", advance ? "true" : "false");
    fd.set("seedRhythm", seedRhythm ? "true" : "false");

    startTransition(async () => {
      const res = await logVisit(fd);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(t("visits.log.logged"));
      router.refresh();
      onClose();
    });
  };

  return (
    <Modal open={open} onClose={onClose} size="md" variant="centered">
      <ModalHeader title={t("visits.log.title")} subtitle={t("visits.log.subtitle")} />
      <ModalBody>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label={t("visits.log.visitDate")}
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
            />
            <Select
              label={t("visits.log.whoMet")}
              value={whoMet}
              onChange={(e) => setWhoMet(e.target.value)}
              options={WHO_MET.map((v) => ({ value: v, label: t(`enums.whoMet.${v}`) }))}
            />
          </div>
          <TextArea
            label={t("visits.log.outcome")}
            value={outcomeNotes}
            onChange={(e) => setOutcomeNotes(e.target.value)}
            rows={3}
            placeholder={t("visits.log.outcomePh")}
          />
          <TextArea
            label={t("visits.log.objection")}
            helperText={t("visits.log.objectionHelper")}
            value={objectionRaised}
            onChange={(e) => setObjectionRaised(e.target.value)}
            rows={2}
          />
          <TextField
            label={t("visits.log.nextAction")}
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            placeholder={t("visits.log.nextActionPh")}
          />
          <div className="space-y-2 rounded-lg bg-subtle p-3">
            {stage === "NOT_CONTACTED" && (
              <Checkbox
                label={t("visits.log.moveToVisited")}
                checked={advance}
                onChange={(e) => setAdvance(e.target.checked)}
              />
            )}
            <Checkbox
              label={t("visits.log.addRhythm")}
              description={t("visits.log.addRhythmDesc")}
              checked={seedRhythm}
              onChange={(e) => setSeedRhythm(e.target.checked)}
            />
          </div>
        </div>
      </ModalBody>
      <ModalFooter justify="between" sticky>
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" onClick={submit} loading={pending}>
          {t("visits.logVisit")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
