"use client";

import { useActionState } from "react";
import { CheckCircleIcon, ExclamationCircleIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";

interface Props {
  action:          (prev: { error?: string; success?: string }, fd: FormData) => Promise<{ error?: string; success?: string }>;
  canAssignAdmin:  boolean;
}

export default function InviteForm({ action, canAssignAdmin }: Props) {
  const [state, formAction, isPending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-5">
      {state.success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />
          {state.success}
        </div>
      )}
      {state.error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <ExclamationCircleIcon className="h-4 w-4 flex-shrink-0" />
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Email */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            name="email"
            required
            autoComplete="off"
            placeholder="colleague@example.com"
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Role <span className="text-red-500">*</span>
          </label>
          <select
            name="role"
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {canAssignAdmin && (
              <option value="MANAGER">Admin</option>
            )}
            <option value="STAFF">Receptionist</option>
            <option value="ACCOUNTANT">Accountant</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          An invitation link valid for <span className="font-medium text-gray-500">72 hours</span> will be sent to their email.
        </p>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          <PaperAirplaneIcon className="h-4 w-4" />
          {isPending ? "Sending…" : "Send Invite"}
        </button>
      </div>
    </form>
  );
}
