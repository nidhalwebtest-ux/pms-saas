"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  BuildingLibraryIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  ArrowsRightLeftIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolid } from "@heroicons/react/24/solid";
import { useFormatCurrency } from "@/lib/org-context";

interface Bank {
  id: string;
  bankName: string;
  label: string | null;
  accountNumber: string | null;
  currency: string;
  openingBalance: string;
  isActive: boolean;
  isDefault: boolean;
}

type FormState = {
  bankName: string;
  label: string;
  accountNumber: string;
  openingBalance: string;
  isDefault: boolean;
};

const EMPTY: FormState = { bankName: "", label: "", accountNumber: "", openingBalance: "", isDefault: false };

export default function BankManager({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const t      = useTranslations("settings.banks");
  const tToast = useTranslations("settings.banks.toasts");
  const omr    = useFormatCurrency();

  const [banks, setBanks]     = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  // Form panel: null = closed, "new" = adding, otherwise the id being edited.
  const [editorFor, setEditorFor] = useState<null | "new" | string>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  async function fetchBanks() {
    setLoading(true);
    try {
      const res = await fetch("/api/banks");
      const data = await res.json();
      if (data.success) setBanks(data.banks);
    } catch { toast.error(tToast("loadFailed")); }
    finally { setLoading(false); }
  }
  useEffect(() => { fetchBanks(); }, []);

  function openNew() { setForm(EMPTY); setEditorFor("new"); }
  function openEdit(b: Bank) {
    setForm({
      bankName: b.bankName,
      label: b.label ?? "",
      accountNumber: b.accountNumber ?? "",
      openingBalance: b.openingBalance ?? "0",
      isDefault: b.isDefault,
    });
    setEditorFor(b.id);
  }
  function closeEditor() { setEditorFor(null); setForm(EMPTY); }

  async function save() {
    if (!form.bankName.trim()) return toast.error(tToast("nameRequired"));
    setSaving(true);
    try {
      const isNew = editorFor === "new";
      const res = await fetch(isNew ? "/api/banks" : `/api/banks/${editorFor}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(isNew ? tToast("added") : tToast("updated"));
      closeEditor();
      fetchBanks();
    } catch { toast.error(tToast("saveFailed")); }
    finally { setSaving(false); }
  }

  async function toggle(b: Bank) {
    try {
      const res = await fetch(`/api/banks/${b.id}`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(data.bank.isActive ? tToast("activated") : tToast("deactivated"));
      fetchBanks();
    } catch { toast.error(tToast("toggleFailed")); }
  }

  async function remove(b: Bank) {
    if (!confirm(tToast("confirmDelete", { name: b.bankName }))) return;
    try {
      const res = await fetch(`/api/banks/${b.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(tToast("deleted"));
      fetchBanks();
    } catch { toast.error(tToast("deleteFailed")); }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 py-16 text-center">
        <ArrowPathIcon className="h-6 w-6 text-gray-300 animate-spin mx-auto mb-2" />
        <p className="text-sm text-gray-400">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Editor panel ── */}
      {editorFor && (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-900 mb-4">
            {editorFor === "new" ? t("newTitle") : t("editTitle")}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("bankNameLabel")} required>
              <input
                value={form.bankName}
                onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                placeholder={t("bankNamePlaceholder")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </Field>
            <Field label={t("labelLabel")}>
              <input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder={t("labelPlaceholder")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </Field>
            <Field label={t("accountNumberLabel")}>
              <input
                value={form.accountNumber}
                onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
                placeholder={t("accountNumberPlaceholder")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm ltr-numbers focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </Field>
            <Field label={t("openingBalanceLabel")}>
              <input
                inputMode="decimal"
                value={form.openingBalance}
                onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))}
                placeholder="0.000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-end ltr-numbers focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </Field>
          </div>
          <label className="mt-4 inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            {t("setDefault")}
          </label>
          <div className="mt-5 flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? t("saving") : t("saveButton")}
            </button>
            <button onClick={closeEditor} className="text-sm text-gray-500 hover:text-gray-700">
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      {/* ── List ── */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-gray-700">{t("listTitle")}</h3>
          {canEdit && !editorFor && (
            <button
              onClick={openNew}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              {t("addButton")}
            </button>
          )}
        </div>

        {banks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <BuildingLibraryIcon className="mb-2 h-10 w-10 text-gray-200" />
            <p className="text-sm text-gray-400">{t("empty")}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {banks.map((b) => (
              <div
                key={b.id}
                className={`flex items-center gap-4 px-5 py-4 transition-colors ${
                  !b.isActive ? "bg-gray-50 opacity-60" : "hover:bg-gray-50/50"
                }`}
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <BuildingLibraryIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{b.bankName}</p>
                    {b.isDefault && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        <StarSolid className="h-3 w-3" /> {t("defaultBadge")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {b.label && <span>{b.label}</span>}
                    {b.label && b.accountNumber && <span className="mx-1.5">·</span>}
                    {b.accountNumber && <span className="ltr-numbers">{b.accountNumber}</span>}
                  </p>
                </div>
                <div className="hidden sm:block text-end">
                  <p className="text-[11px] uppercase tracking-wide text-gray-400">{t("openingBalanceShort")}</p>
                  <p className="text-sm font-semibold text-gray-700 ltr-numbers">{omr(Number(b.openingBalance))}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/dashboard/settings/banks/${b.id}/statement`}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                    title={t("statementAction")}
                  >
                    <DocumentTextIcon className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`/dashboard/settings/banks/${b.id}/matching`}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                    title={t("matchAction")}
                  >
                    <ArrowsRightLeftIcon className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => toggle(b)}
                    disabled={!canEdit}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      b.isActive
                        ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700"
                        : "bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700"
                    }`}
                  >
                    {b.isActive ? t("active") : t("inactive")}
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => openEdit(b)}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                      title={t("editTitle")}
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => remove(b)}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      title={t("deleteTitle")}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
