"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ShieldCheckIcon, PlusIcon, UsersIcon, LockClosedIcon, TrashIcon,
  DocumentDuplicateIcon, ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { createRole, deleteRole } from "./actions";

interface RoleItem {
  id: string; name: string; key: string | null; isSystem: boolean;
  description: string | null; members: number; granted: number; total: number;
}

export default function RolesList({ roles }: { roles: RoleItem[] }) {
  const t = useTranslations("settings.rolePermissions");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  // Localized display name for system roles; custom roles use their stored name.
  const displayName = (r: RoleItem) =>
    r.isSystem && r.key && t.has(`systemNames.${r.key}`) ? t(`systemNames.${r.key}`) : r.name;

  function onCreate() {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      const res = await createRole({ name });
      if (!res.ok) { toast.error(t.has(`errors.${res.error}`) ? t(`errors.${res.error}`) : t("errors.generic")); return; }
      toast.success(t("created"));
      setCreating(false); setNewName("");
      if (res.id) router.push(`/dashboard/settings/roles/${res.id}`);
    });
  }

  function onDelete(r: RoleItem) {
    if (!confirm(t("confirmDelete", { name: displayName(r) }))) return;
    startTransition(async () => {
      const res = await deleteRole(r.id);
      if (!res.ok) { toast.error(t.has(`errors.${res.error}`) ? t(`errors.${res.error}`) : t("errors.generic")); return; }
      toast.success(t("deleted"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <ShieldCheckIcon className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-sm text-gray-500">{t("subtitle")}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          {t("newRole")}
        </button>
      </div>

      {/* Inline create */}
      {creating && (
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 flex items-center gap-3">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onCreate()}
            placeholder={t("namePlaceholder")}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <button type="button" onClick={onCreate} disabled={pending || !newName.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
            {t("create")}
          </button>
          <button type="button" onClick={() => { setCreating(false); setNewName(""); }}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {t("cancel")}
          </button>
        </div>
      )}

      {/* Roles list */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 divide-y divide-gray-100">
        {roles.map((r) => (
          <div key={r.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors">
            <Link href={`/dashboard/settings/roles/${r.id}`} className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{displayName(r)}</span>
                {r.isSystem ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                    <LockClosedIcon className="h-3 w-3" />{t("standard")}
                  </span>
                ) : (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">{t("custom")}</span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1"><UsersIcon className="h-3.5 w-3.5" />{t("memberCount", { count: r.members })}</span>
                <span className="ltr-numbers">{t("accessSummary", { granted: r.granted, total: r.total })}</span>
              </div>
            </Link>

            <button type="button" title={t("duplicate")} onClick={() => router.push(`/dashboard/settings/roles/${r.id}?duplicate=1`)}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
              <DocumentDuplicateIcon className="h-4 w-4" />
            </button>
            {!r.isSystem && (
              <button type="button" title={t("delete")} onClick={() => onDelete(r)} disabled={pending}
                className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50">
                <TrashIcon className="h-4 w-4" />
              </button>
            )}
            <Link href={`/dashboard/settings/roles/${r.id}`} className="rounded-lg p-2 text-gray-300 hover:text-gray-600">
              <ChevronRightIcon className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
