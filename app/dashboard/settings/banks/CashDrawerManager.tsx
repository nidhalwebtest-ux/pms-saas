"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  PlusIcon,
  PencilSquareIcon,
  BanknotesIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { useFormatCurrency } from "@/lib/org-context";

interface Drawer {
  id: string;
  propertyId: string | null;
  propertyName: string;
  openingBalance: string;
  balance: string;
  txnCount: number;
  isActive: boolean;
}
interface PropertyOpt { id: string; name: string }

type FormState = { propertyId: string; label: string; openingBalance: string };
const EMPTY: FormState = { propertyId: "", label: "", openingBalance: "" };

export default function CashDrawerManager({ canEdit }: { canEdit: boolean }) {
  const t      = useTranslations("settings.cashDrawers");
  const omr    = useFormatCurrency();

  const [drawers, setDrawers]   = useState<Drawer[]>([]);
  const [available, setAvailable] = useState<PropertyOpt[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  const [editorFor, setEditorFor] = useState<null | "new" | string>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  async function fetchDrawers() {
    setLoading(true);
    try {
      const res = await fetch("/api/cash-drawers");
      const data = await res.json();
      if (data.success) { setDrawers(data.drawers); setAvailable(data.availableProperties); }
    } catch { toast.error(t("loadFailed")); }
    finally { setLoading(false); }
  }
  useEffect(() => { fetchDrawers(); }, []);

  function openNew() { setForm(EMPTY); setEditorFor("new"); }
  function openEdit(d: Drawer) {
    setForm({ propertyId: d.propertyId ?? "", label: "", openingBalance: Number(d.openingBalance).toFixed(3) });
    setEditorFor(d.id);
  }
  function closeEditor() { setEditorFor(null); setForm(EMPTY); }

  async function save() {
    const isNew = editorFor === "new";
    if (isNew && !form.propertyId) return toast.error(t("buildingRequired"));
    setSaving(true);
    try {
      const res = await fetch(isNew ? "/api/cash-drawers" : `/api/cash-drawers/${editorFor}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(isNew ? t("added") : t("updated"));
      closeEditor();
      fetchDrawers();
    } catch { toast.error(t("saveFailed")); }
    finally { setSaving(false); }
  }

  async function toggle(d: Drawer) {
    try {
      const res = await fetch(`/api/cash-drawers/${d.id}`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      fetchDrawers();
    } catch { toast.error(t("toggleFailed")); }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 py-12 text-center">
        <ArrowPathIcon className="h-6 w-6 text-gray-300 animate-spin mx-auto mb-2" />
        <p className="text-sm text-gray-400">{t("loading")}</p>
      </div>
    );
  }

  const editingDrawer = typeof editorFor === "string" && editorFor !== "new"
    ? drawers.find((d) => d.id === editorFor)
    : null;
  const floatLocked = !!editingDrawer && editingDrawer.txnCount > 0;

  return (
    <div className="space-y-4">
      {/* ── Editor panel ── */}
      {editorFor && (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-900 mb-1">
            {editorFor === "new" ? t("newTitle") : t("editTitle")}
          </p>
          <p className="text-xs text-gray-500 mb-4">{t("floatHint")}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {editorFor === "new" && (
              <Field label={t("buildingLabel")} required>
                <select
                  value={form.propertyId}
                  onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">{t("buildingPlaceholder")}</option>
                  {available.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            )}
            <Field label={t("openingFloatLabel")}>
              <input
                inputMode="decimal"
                value={form.openingBalance}
                disabled={floatLocked}
                onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))}
                placeholder="0.000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-end ltr-numbers focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
              />
              {floatLocked && <p className="mt-1 text-[11px] text-amber-600">{t("floatLocked")}</p>}
            </Field>
          </div>
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
          <div>
            <h3 className="text-sm font-semibold text-gray-700">{t("listTitle")}</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">{t("listSubtitle")}</p>
          </div>
          {canEdit && !editorFor && available.length > 0 && (
            <button
              onClick={openNew}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              {t("addButton")}
            </button>
          )}
        </div>

        {drawers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <BanknotesIcon className="mb-2 h-10 w-10 text-gray-200" />
            <p className="text-sm text-gray-400">{t("empty")}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {drawers.map((d) => (
              <div
                key={d.id}
                className={`flex items-center gap-4 px-5 py-4 transition-colors ${!d.isActive ? "bg-gray-50 opacity-60" : "hover:bg-gray-50/50"}`}
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600">
                  <BanknotesIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{d.propertyName}</p>
                  <p className="text-xs text-gray-500">
                    {t("openingFloatShort")}: <span className="ltr-numbers">{omr(Number(d.openingBalance))}</span>
                    <span className="mx-1.5">·</span>
                    {t("txns", { count: d.txnCount })}
                  </p>
                </div>
                <div className="hidden sm:block text-end">
                  <p className="text-[11px] uppercase tracking-wide text-gray-400">{t("balanceShort")}</p>
                  <p className="text-sm font-semibold text-gray-700 ltr-numbers">{omr(Number(d.balance))}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => toggle(d)}
                    disabled={!canEdit}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      d.isActive
                        ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700"
                        : "bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700"
                    }`}
                  >
                    {d.isActive ? t("active") : t("inactive")}
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => openEdit(d)}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                      title={t("editTitle")}
                    >
                      <PencilSquareIcon className="h-4 w-4" />
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
