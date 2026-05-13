"use client";

import { useEffect, useState } from "react";
import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../modal";
import { Button } from "../Button";
import { Select, TextArea, TextField } from "../form";
import type {
  ConfirmDialogOptions,
  ConfirmDialogResult,
  ConfirmDialogTone,
} from "./types";

export interface ConfirmDialogProps {
  /** Current options. When null, the dialog is hidden (and may be animating out). */
  options: ConfirmDialogOptions | null;
  onConfirm: (result: ConfirmDialogResult) => void;
  onCancel: () => void;
}

/* ----------------------------------------------------------------------------
 *  Tone → presentation mapping
 * ------------------------------------------------------------------------- */

function toneIcon(tone: ConfirmDialogTone) {
  switch (tone) {
    case "destructive":
      return (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-error-100">
          <ExclamationTriangleIcon className="h-5 w-5 text-error-600" />
        </div>
      );
    case "warning":
      return (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-50">
          <ExclamationTriangleIcon className="h-5 w-5 text-warning-600" />
        </div>
      );
    case "info":
      return (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50">
          <InformationCircleIcon className="h-5 w-5 text-brand-600" />
        </div>
      );
    default:
      return undefined;
  }
}

function toneModalTone(tone: ConfirmDialogTone) {
  return tone === "destructive" ? ("destructive" as const) : ("default" as const);
}

function toneButtonVariant(tone: ConfirmDialogTone) {
  return tone === "destructive" || tone === "warning"
    ? ("destructive" as const)
    : ("primary" as const);
}

/* ----------------------------------------------------------------------------
 *  Component
 * ------------------------------------------------------------------------- */

export function ConfirmDialog({ options, onConfirm, onCancel }: ConfirmDialogProps) {
  const open = options !== null;

  // Keep the last-shown options around so close animations don't render an
  // empty panel.
  const [lastOptions, setLastOptions] = useState<ConfirmDialogOptions | null>(null);
  useEffect(() => {
    if (options) setLastOptions(options);
  }, [options]);
  const view = options ?? lastOptions;

  // Local form state — reset whenever the dialog re-opens with new options.
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [typedValue, setTypedValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (options) {
      setReason("");
      setNotes("");
      setTypedValue("");
      setSubmitting(false);
    }
  }, [options]);

  if (!view) {
    // First render before any dialog has ever opened — nothing to mount.
    return null;
  }

  const tone: ConfirmDialogTone = view.tone ?? "default";
  const reasonConfig = view.reason;
  const typeToConfirmConfig = view.typeToConfirm;

  const notesRequiredFor = reasonConfig?.notesRequiredFor ?? [];
  const notesFor = [...(reasonConfig?.notesFor ?? []), ...notesRequiredFor];

  const reasonValid = !reasonConfig || reason.length > 0;
  const notesShown = Boolean(reasonConfig && reason && notesFor.includes(reason));
  const notesRequired = Boolean(reasonConfig && reason && notesRequiredFor.includes(reason));
  const notesValid = !notesRequired || notes.trim().length > 0;
  const typeToConfirmValid =
    !typeToConfirmConfig || typedValue === typeToConfirmConfig.value;
  const canSubmit = reasonValid && notesValid && typeToConfirmValid && !submitting;

  async function handleConfirm() {
    if (!canSubmit || !options) return;
    const result: ConfirmDialogResult = {
      confirmed: true,
      reason: reasonConfig ? reason : undefined,
      notes: notesShown ? notes.trim() : undefined,
    };

    if (!options.onConfirm) {
      onConfirm(result);
      return;
    }

    setSubmitting(true);
    try {
      await options.onConfirm({ reason: result.reason, notes: result.notes });
      onConfirm(result);
    } catch (err) {
      // Caller is expected to surface errors inside onConfirm (e.g. toast).
      // We close to keep the UX moving and resolve as cancelled.
      if (process.env.NODE_ENV !== "production") {
        console.error("[ConfirmDialog] onConfirm threw:", err);
      }
      setSubmitting(false);
      onCancel();
    }
  }

  function handleClose() {
    if (submitting) return;
    onCancel();
  }

  const typeLabel =
    typeToConfirmConfig?.label ??
    (typeToConfirmConfig
      ? `Type ${typeToConfirmConfig.value} to confirm`
      : undefined);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="sm"
      tone={toneModalTone(tone)}
      closeOnBackdrop={!submitting}
      closeOnEsc={!submitting}
    >
      <ModalHeader title={view.title} icon={toneIcon(tone)} hideClose />
      <ModalBody>
        {view.description && (
          <p className="text-sm text-fg-secondary">{view.description}</p>
        )}
        {view.body && (
          <div className={view.description ? "mt-4" : ""}>{view.body}</div>
        )}

        {reasonConfig && (
          <div className={view.description || view.body ? "mt-4" : ""}>
            <Select
              label={reasonConfig.label ?? "Reason"}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonConfig.placeholder ?? "Select a reason…"}
              options={reasonConfig.options}
              disabled={submitting}
            />
          </div>
        )}

        {notesShown && (
          <TextArea
            label={reasonConfig?.notesLabel ?? "Notes"}
            placeholder={reasonConfig?.notesPlaceholder}
            required={notesRequired}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            minRows={3}
            disabled={submitting}
          />
        )}

        {typeToConfirmConfig && (
          <div
            className={
              view.description || view.body || reasonConfig ? "mt-4" : ""
            }
          >
            <TextField
              label={typeLabel}
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={submitting}
            />
          </div>
        )}
      </ModalBody>
      <ModalFooter justify="end">
        {!view.hideCancel && (
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            {view.cancelLabel ?? "Cancel"}
          </Button>
        )}
        <Button
          variant={toneButtonVariant(tone)}
          onClick={handleConfirm}
          disabled={!canSubmit}
          loading={submitting}
        >
          {view.confirmLabel ?? "Confirm"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
