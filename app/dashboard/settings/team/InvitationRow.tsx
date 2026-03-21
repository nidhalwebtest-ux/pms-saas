"use client";

import { useState, useTransition } from "react";
import { ClockIcon, ArrowPathIcon, XMarkIcon, EnvelopeIcon } from "@heroicons/react/24/outline";
import { ROLE_LABELS, ROLE_BADGE, type Role } from "@/lib/permissions";
import { cancelInvitation, resendInvitation } from "./actions";
import type { UserRole } from "@prisma/client";

interface Invitation {
  id:        string;
  email:     string;
  role:      UserRole;
  expiresAt: Date;
  createdAt: Date;
  invitedBy: { firstName: string | null; email: string };
}

function timeLeft(expiresAt: Date): { label: string; expired: boolean } {
  const diff = expiresAt.getTime() - Date.now();
  if (diff <= 0) return { label: "Expired", expired: true };
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return { label: `${h}h ${m}m left`, expired: false };
  return { label: `${m}m left`, expired: false };
}

export default function InvitationRow({ invite }: { invite: Invitation }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { label, expired } = timeLeft(invite.expiresAt);
  const inviterName = invite.invitedBy.firstName ?? invite.invitedBy.email.split("@")[0];

  function handleCancel() {
    startTransition(async () => {
      await cancelInvitation(invite.id);
    });
  }

  function handleResend() {
    startTransition(async () => {
      await resendInvitation(invite.id);
      setConfirming(false);
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
            Invited by {inviterName}
          </p>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Role */}
        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${ROLE_BADGE[invite.role as Role]}`}>
          {ROLE_LABELS[invite.role as Role]}
        </span>

        {/* Expiry */}
        <span className={`flex items-center gap-1 text-xs font-medium ${expired ? "text-red-500" : "text-amber-600"}`}>
          <ClockIcon className="h-3.5 w-3.5 flex-shrink-0" />
          {label}
        </span>

        {/* Resend */}
        {!confirming && (
          <button
            onClick={handleResend}
            disabled={isPending}
            title="Resend invitation"
            className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
          </button>
        )}

        {/* Cancel */}
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            disabled={isPending}
            title="Cancel invitation"
            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-red-600 font-medium">Cancel?</span>
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-500 disabled:opacity-50"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={isPending}
              className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300 disabled:opacity-50"
            >
              No
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
