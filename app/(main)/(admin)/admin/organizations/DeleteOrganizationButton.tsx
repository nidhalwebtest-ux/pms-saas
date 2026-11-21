"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { TrashIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, TextField, Alert } from "@/components/ui";
import { deleteOrganization } from "./actions";

/**
 * Danger-zone delete for an organization. Requires typing the exact name —
 * deliberately heavier than the ConfirmDialog used for single records, because
 * this wipes a whole customer account and cannot be undone.
 */
export default function DeleteOrganizationButton({
  org,
  variant = "button",
  redirectTo,
}: {
  org: { id: string; name: string; isDemo?: boolean; userCount?: number };
  /** "button" = labelled danger button (detail page); "icon" = compact (list card). */
  variant?: "button" | "icon";
  /** Where to go after deleting (detail page → back to the list). */
  redirectTo?: string;
}) {
  const t = useTranslations("admin.organizations.delete");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  const matches = typed.trim() === org.name.trim();

  const close = () => {
    if (pending) return;
    setOpen(false);
    setTyped("");
  };

  const submit = () => {
    if (!matches) return;
    startTransition(async () => {
      const res = await deleteOrganization(org.id, typed);
      if ("error" in res) {
        toast.error(t(`errors.${res.error}`));
        return;
      }
      if (res.authFailures > 0) toast.warning(t("authWarning", { count: res.authFailures }));
      toast.success(t("done", { name: org.name }));
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    });
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("button")}
          title={t("button")}
          className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-border-default text-fg-tertiary transition-colors hover:border-error-500 hover:bg-error-50 hover:text-error-600"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      ) : (
        <Button variant="destructive" size="sm" leftIcon={<TrashIcon className="h-4 w-4" />} onClick={() => setOpen(true)}>
          {t("button")}
        </Button>
      )}

      {open && (
        <Modal open onClose={close} size="md" variant="centered">
          <ModalHeader title={t("title")} subtitle={org.name} />
          <ModalBody>
            <div className="space-y-4">
              <Alert
                variant="error"
                icon={<ExclamationTriangleIcon className="h-5 w-5" />}
                title={t("warningTitle")}
                description={t("warningBody", { users: org.userCount ?? 0 })}
              />
              <TextField
                label={t("typeLabel", { name: org.name })}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={org.name}
                autoComplete="off"
                autoFocus
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={close} disabled={pending}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={submit} loading={pending} disabled={!matches}>
              {t("confirm")}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}
