"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  TextField,
  PhoneInput,
  Button,
  Spinner,
} from "@/components/ui";
import { startDemo, type DemoResult } from "@/app/demo/actions";

/**
 * The "Demo Tour" entry point (landing page hero + final CTA). Two fields,
 * no email/password — startDemo() creates a fully-seeded sandbox org and
 * signs the visitor straight into the dashboard. Seeding takes ~50s (real
 * invoice/pricing engine calls, not a shortcut — see scripts/_seed/demo-data.ts),
 * so the submitted state cycles through staged messages rather than a bare
 * spinner, both to set an honest expectation and to keep the wait feeling
 * like something is being built rather than stalled.
 */
export function DemoTourModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("marketing.demoTour");
  const [state, formAction, pending] = useActionState<DemoResult, FormData>(
    startDemo,
    { ok: true },
  );

  const stages = [t("stage1"), t("stage2"), t("stage3"), t("stage4")];
  const [stageIndex, setStageIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!pending) {
      setStageIndex(0);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, stages.length - 1));
    }, 3500);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const errorMessage =
    !pending && !state.ok
      ? state.error === "rate_limited"
        ? t("errorRateLimited")
        : state.error === "whatsapp_invalid"
        ? t("errorWhatsappInvalid")
        : state.error === "name_required"
        ? t("errorNameRequired")
        : t("errorGeneric")
      : null;

  return (
    <Modal open={open} onClose={pending ? () => {} : onClose} size="sm" closeOnBackdrop={!pending} closeOnEsc={!pending}>
      <ModalHeader title={t("title")} subtitle={pending ? undefined : t("subtitle")} hideClose={pending} />
      <ModalBody>
        {pending ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <Spinner size={32} />
            <p className="text-sm font-medium text-fg-secondary" role="status" aria-live="polite">
              {stages[stageIndex]}
            </p>
          </div>
        ) : (
          <form id="demo-tour-form" action={formAction} className="flex flex-col gap-4">
            <TextField
              label={t("nameLabel")}
              name="name"
              required
              placeholder={t("namePlaceholder")}
              autoFocus
            />
            <PhoneInput name="whatsapp" defaultCountry="OM" required />
            {errorMessage && (
              <p className="text-sm text-danger-600" role="alert">
                {errorMessage}
              </p>
            )}
          </form>
        )}
      </ModalBody>
      {!pending && (
        <ModalFooter justify="between">
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="demo-tour-form" variant="primary">
            {t("submit")}
          </Button>
        </ModalFooter>
      )}
    </Modal>
  );
}
