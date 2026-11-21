"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeftIcon, LockClosedIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import {
  PERMISSION_GROUPS, PERMISSION_LEVELS, reportSlug,
  type PermissionLevel, type PermissionMap, type EntityDef,
} from "@/lib/rbac";
import { updateRole, duplicateRole } from "./actions";

interface RoleData {
  id: string; name: string; key: string | null; isSystem: boolean;
  description: string; members: number; permissions: PermissionMap;
}

export default function RoleEditor({ role, startDuplicate }: { role: RoleData; startDuplicate?: boolean }) {
  const t = useTranslations("settings.rolePermissions");
  const tReports = useTranslations("reports");
  const router = useRouter();

  // Reports use their own i18n namespace; actions/CRUD live under rolePermissions.
  const entityLabel = (e: EntityDef) => {
    if (e.kind === "toggle") {
      const slug = reportSlug(e.key);
      return slug ? tReports(`items.${slug}`) : t(`actions.${e.key}`);
    }
    return t(`entities.${e.key}`);
  };
  const subLabel = (e: EntityDef) =>
    reportSlug(e.key) ? tReports(`groups.${e.sub}`) : t(`actionGroups.${e.sub}`);
  const [pending, startTransition] = useTransition();

  const readOnly = role.isSystem;
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description);
  const [matrix, setMatrix] = useState<PermissionMap>(role.permissions);

  const [dupOpen, setDupOpen] = useState(!!startDuplicate);
  const [dupName, setDupName] = useState("");

  const displayName = role.isSystem && role.key && t.has(`systemNames.${role.key}`)
    ? t(`systemNames.${role.key}`) : role.name;

  const dirty =
    name !== role.name || description !== role.description ||
    PERMISSION_GROUPS.some((g) => g.entities.some((e) => matrix[e.key] !== role.permissions[e.key]));

  function setLevel(entity: string, level: PermissionLevel) {
    if (readOnly) return;
    setMatrix((m) => ({ ...m, [entity]: level }));
  }
  function setGroupAll(groupKey: string, level: PermissionLevel) {
    if (readOnly) return;
    const grp = PERMISSION_GROUPS.find((g) => g.key === groupKey);
    if (!grp) return;
    setMatrix((m) => {
      const next = { ...m };
      for (const e of grp.entities) next[e.key] = level;
      return next;
    });
  }

  function onSave() {
    startTransition(async () => {
      const res = await updateRole({ id: role.id, name: name.trim(), description, permissions: matrix });
      if (!res.ok) { toast.error(t.has(`errors.${res.error}`) ? t(`errors.${res.error}`) : t("errors.generic")); return; }
      toast.success(t("saved"));
      router.refresh();
    });
  }

  function onDuplicate() {
    const n = dupName.trim();
    if (!n) return;
    startTransition(async () => {
      const res = await duplicateRole(role.id, n);
      if (!res.ok) { toast.error(t.has(`errors.${res.error}`) ? t(`errors.${res.error}`) : t("errors.generic")); return; }
      toast.success(t("created"));
      if (res.id) router.push(`/dashboard/settings/roles/${res.id}`);
    });
  }

  const levelBtn = (entity: string, level: PermissionLevel) => {
    const active = matrix[entity] === level;
    const tone =
      level === "NONE" ? (active ? "bg-gray-200 text-gray-700" : "")
      : level === "FULL" ? (active ? "bg-blue-600 text-white" : "")
      : active ? "bg-blue-500 text-white" : "";
    return (
      <button
        key={level}
        type="button"
        disabled={readOnly}
        onClick={() => setLevel(entity, level)}
        className={`px-2.5 py-1 text-xs font-medium transition-colors ${tone || "text-gray-500 hover:bg-gray-100"} ${readOnly ? "cursor-not-allowed" : ""}`}
      >
        {t(`levels.${level}`)}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link href="/dashboard/settings/roles" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
        <ArrowLeftIcon className="h-3.5 w-3.5 rtl:rotate-180" />{t("backToList")}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-blue-100 rounded-lg"><ShieldCheckIcon className="h-6 w-6 text-blue-700" /></div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 truncate">{displayName}</h1>
              {role.isSystem && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                  <LockClosedIcon className="h-3 w-3" />{t("standard")}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">{t("memberCount", { count: role.members })}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setDupName(`${displayName} (${t("copy")})`); setDupOpen(true); }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          {t("saveAsCustom")}
        </button>
      </div>

      {/* Read-only notice for system roles */}
      {readOnly && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          {t("systemNotice")}
        </div>
      )}

      {/* Duplicate inline panel */}
      {dupOpen && (
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 space-y-3">
          <p className="text-sm font-medium text-gray-900">{t("saveAsTitle")}</p>
          <div className="flex items-center gap-3">
            <input autoFocus value={dupName} onChange={(e) => setDupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onDuplicate()}
              placeholder={t("namePlaceholder")}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            <button type="button" onClick={onDuplicate} disabled={pending || !dupName.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">{t("create")}</button>
            <button type="button" onClick={() => setDupOpen(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{t("cancel")}</button>
          </div>
        </div>
      )}

      {/* Name + description (custom only) */}
      {!readOnly && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("roleName")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("description")}</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
        </div>
      )}

      {/* Permission matrix */}
      <div className="space-y-5">
        {PERMISSION_GROUPS.map((g) => {
          const hasToggle = g.entities.some((e) => e.kind === "toggle");
          return (
          <div key={g.key} className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">{t(`groups.${g.key}`)}</h3>
              {!readOnly && (hasToggle ? (
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setGroupAll(g.key, "FULL")}
                    className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">{t("allOn")}</button>
                  <button type="button" onClick={() => setGroupAll(g.key, "NONE")}
                    className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">{t("allOff")}</button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">{t("setAll")}</span>
                  <select
                    defaultValue=""
                    onChange={(e) => { if (e.target.value) { setGroupAll(g.key, e.target.value as PermissionLevel); e.target.value = ""; } }}
                    className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="" disabled>—</option>
                    {PERMISSION_LEVELS.map((lv) => <option key={lv} value={lv}>{t(`levels.${lv}`)}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="divide-y divide-gray-100">
              {g.entities.map((e, idx) => {
                const prev = g.entities[idx - 1];
                const prevSub = prev?.kind === "toggle" ? prev.sub : undefined;
                const showSub = e.kind === "toggle" && !!e.sub && e.sub !== prevSub;
                const on = matrix[e.key] !== "NONE";
                return (
                  <div key={e.key}>
                    {showSub && (
                      <div className="px-5 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        {subLabel(e)}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-4 px-5 py-2.5">
                      <span className="text-sm text-gray-700">{entityLabel(e)}</span>
                      {e.kind === "toggle" ? (
                        <button
                          type="button" role="switch" aria-checked={on} disabled={readOnly}
                          onClick={() => setLevel(e.key, on ? "NONE" : "FULL")}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${on ? "bg-blue-600" : "bg-gray-200"} ${readOnly ? "cursor-not-allowed opacity-60" : ""}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0.5 rtl:-translate-x-0.5"}`} />
                        </button>
                      ) : (
                        <div className="inline-flex rounded-lg ring-1 ring-gray-200 overflow-hidden divide-x divide-gray-200">
                          {PERMISSION_LEVELS.map((lv) => levelBtn(e.key, lv))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          );
        })}
      </div>

      {/* Save bar (custom only) */}
      {!readOnly && (
        <div className="flex items-center justify-end gap-3 pt-2">
          {dirty && (
            <button type="button" onClick={() => { setName(role.name); setDescription(role.description); setMatrix(role.permissions); }}
              disabled={pending}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">{t("revert")}</button>
          )}
          <button type="button" onClick={onSave} disabled={pending || !dirty}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50">
            {pending ? t("saving") : t("save")}
          </button>
        </div>
      )}
    </div>
  );
}
