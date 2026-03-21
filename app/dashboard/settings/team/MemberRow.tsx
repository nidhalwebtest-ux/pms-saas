"use client";

import { useState, useTransition } from "react";
import { PencilSquareIcon, TrashIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ROLE_LABELS, ROLE_BADGE, type Role } from "@/lib/permissions";
import { updateMemberRole, removeTeamMember } from "./actions";
import type { UserRole } from "@prisma/client";

const ASSIGNABLE_ROLES: { value: UserRole; label: string }[] = [
  { value: "MANAGER",    label: "Admin" },
  { value: "STAFF",      label: "Receptionist" },
  { value: "ACCOUNTANT", label: "Accountant" },
];

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
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">You</span>
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
              className="rounded-md border border-gray-300 py-1 pl-2 pr-7 text-xs text-gray-900 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <button
              onClick={saveRole}
              disabled={isPending}
              className="rounded bg-green-600 p-1 text-white hover:bg-green-500 disabled:opacity-50"
              title="Save"
            >
              <CheckIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => { setEditing(false); setSelected(member.role); setError(null); }}
              disabled={isPending}
              className="rounded bg-gray-200 p-1 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
              title="Cancel"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${ROLE_BADGE[member.role]}`}>
            {ROLE_LABELS[member.role]}
          </span>
        )}

        {/* Edit role button */}
        {canEdit && !editing && (
          <button
            onClick={() => { setEditing(true); setError(null); }}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition-colors"
            title="Change role"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
        )}

        {/* Remove button / confirm */}
        {canDelete && !editing && !confirming && (
          <button
            onClick={() => setConfirming(true)}
            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Remove member"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        )}

        {confirming && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-red-600 font-medium">Remove?</span>
            <button
              onClick={handleRemove}
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

      {/* Inline error */}
      {error && (
        <p className="col-span-full text-xs text-red-600 mt-1">{error}</p>
      )}
    </li>
  );
}
