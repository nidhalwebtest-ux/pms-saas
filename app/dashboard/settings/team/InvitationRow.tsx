"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { ClockIcon, ArrowPathIcon, XMarkIcon, EnvelopeIcon } from "@heroicons/react/24/outline";
import { type Role } from "@/lib/permissions";
import { cancelInvitation, resendInvitation } from "./actions";
import type { UserRole } from "@prisma/client";
import { Badge, getUserRoleBadge, useConfirmDialog } from "@/components/ui";

interface Invitation {
  id:        string;
  email:     string;
  role:      UserRole;
  expiresAt: Date;
  createdAt: Date;
  invitedBy: { firstName: string | null; email: string };
}

export default function InvitationRow({ invite }: { invite: Invitation }) {
  const t      = useTranslations("settings.team.pending");
  const tRoles = useTranslations("settings.roles");
  const confirm = useConfirmDialog();

  const [isPending, startTransition] = useTransition();

  function timeLeftLabel(expiresAt: Date): { label: string; expired: boolean } {
    const diff = expiresAt.getTime() - Date.now();
    if (diff <= 0) return { label: t("expired"), expired: true };
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    if (h > 0) return { label: t("hoursMinutesLeft", { hours: h, minutes: m }), expired: false };
    return { label: t("minutesLeft", { minutes: m }), expired: false };
  }

  const { label, expired } = timeLeftLabel(invite.expiresAt);
  const inviterName = invite.invitedBy.firstName ?? invite.invitedBy.email.split("@")[0];

  async function handleCancel() {
    const { confirmed } = await confirm({
      title: t("cancelDialogTitle"),
      description: t("cancelDialogDescription", { email: invite.email }),
      tone: "destructive",
      confirmLabel: t("cancelDialogConfirm"),
      cancelLabel: t("cancelDialogKeep"),
    });
    if (!confirmed) return;
    startTransition(async () => {
      await cancelInvitation(invite.id);
    });
  }

  function handleResend() {
    startTransition(async () => {
      await resendInvitation(invite.id);
    });
  }

  return (
    <li className="px-6 py-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between hover:bg-gray-50 transition-colors">
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
          <EnvelopeIcon className="h-4 w-4 text-gray-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{invite.email}</p>
          <p className="text-xs text-gray-400">
            {t("invitedBy", { name: inviterName })}
          </p>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Role */}
        <Badge {...getUserRoleBadge(invite.role as Role)} size="sm">
          {tRoles(invite.role)}
        </Badge>

        {/* Expiry */}
        <span className={`flex items-center gap-1 text-xs font-medium ${expired ? "text-red-500" : "text-amber-600"}`}>
          <ClockIcon className="h-3.5 w-3.5 flex-shrink-0" />
          {label}
        </span>

        {/* Resend */}
        <button
          onClick={handleResend}
          disabled={isPending}
          title={t("resendTitle")}
          className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
        </button>

        {/* Cancel */}
        <button
          onClick={handleCancel}
          disabled={isPending}
          title={t("cancelTitle")}
          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
