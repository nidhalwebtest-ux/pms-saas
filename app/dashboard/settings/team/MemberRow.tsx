"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { PencilSquareIcon, TrashIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ROLE_BADGE, type Role } from "@/lib/permissions";
import { updateMemberRole, removeTeamMember } from "./actions";
import type { UserRole } from "@prisma/client";
import { Button } from "@/components/ui";

const ASSIGNABLE_ROLES: UserRole[] = ["MANAGER", "STAFF", "ACCOUNTANT"];

interface Member {
  id:        string;
  firstName: string | null;
  email:     string;
  role:      UserRole;
  createdAt: Date;
}

export default function MemberRow({
  member,
  currentUserId,
  callerRole,
}: {
  member:        Member;
  currentUserId: string;
  callerRole:    Role;
}) {
  const t      = useTranslations("settings.team.staff");
  const tRoles = useTranslations("settings.roles");

  const [editing, setEditing]     = useState(false);
  const [selected, setSelected]   = useState<UserRole>(member.role);
  const [confirming, setConfirming] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isCurrentUser = member.id === currentUserId;
  const isOwner       = member.role === "OWNER";
  const canEdit       = callerRole === "OWNER" && !isCurrentUser && !isOwner;
  const canDelete     = callerRole === "OWNER" && !isCurrentUser && !isOwner;

  const displayName = member.firstName || member.email.split("@")[0];

  function saveRole() {
    if (selected === member.role) { setEditing(false); return; }
    setError(null);
    startTransition(async () => {
      try {
        await updateMemberRole(member.id, selected);
        setEditing(false);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      try {
        await removeTeamMember(member.id);
      } catch (e: any) {
        setError(e.message);
        setConfirming(false);
      }
    });
  }

  return (
    <li className="px-6 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between hover:bg-gray-50 transition-colors">
      {/* Left — avatar + info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
          {displayName[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
            {isCurrentUser && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">{t("you")}</span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{member.email}</p>
        </div>
      </div>

      {/* Right — role + actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Role display / editor */}
        {editing ? (
          <div className="flex items-center gap-2">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value as UserRole)}
              disabled={isPending}
              className="rounded-md border border-gray-300 py-1 ps-2 pe-7 text-xs text-gray-900 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>{tRoles(r)}</option>
              ))}
            </select>
            <button
              onClick={saveRole}
              disabled={isPending}
              className="rounded bg-green-600 p-1 text-white hover:bg-green-500 disabled:opacity-50"
              title={t("saveTitle")}
            >
              <CheckIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => { setEditing(false); setSelected(member.role); setError(null); }}
              disabled={isPending}
              className="rounded bg-gray-200 p-1 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
              title={t("cancelTitle")}
            >
              <XMarkIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${ROLE_BADGE[member.role]}`}>
            {tRoles(member.role)}
          </span>
        )}

        {/* Edit role button */}
        {canEdit && !editing && (
          <button
            onClick={() => { setEditing(true); setError(null); }}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition-colors"
            title={t("changeRoleTitle")}
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
        )}

        {/* Remove button / confirm */}
        {canDelete && !editing && !confirming && (
          <button
            onClick={() => setConfirming(true)}
            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title={t("removeTitle")}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        )}

        {confirming && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-red-600 font-medium">{t("removeConfirm")}</span>
            <Button variant="destructive" size="sm" onClick={handleRemove} disabled={isPending}>
              {t("yes")}
            </Button>
            <button
              onClick={() => setConfirming(false)}
              disabled={isPending}
              className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300 disabled:opacity-50"
            >
              {t("no")}
            </button>
          </div>
        )}
      </div>

      {/* Inline error */}
      {error && (
        <p className="col-span-full text-xs text-red-600 mt-1">{error}</p>
      )}
    </li>
  );
}
