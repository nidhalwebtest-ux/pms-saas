"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  PlusIcon,
  PencilSquareIcon,
  XMarkIcon,
  CheckIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

interface Category {
  id: string;
  name: string;
  nameAr: string | null;
  icon: string | null;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
}

export default function ExpenseCategoryManager() {
  const t      = useTranslations("settings.categories");
  const tToast = useTranslations("settings.categories.toasts");

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addNameAr, setAddNameAr] = useState("");
  const [addIcon, setAddIcon] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNameAr, setEditNameAr] = useState("");
  const [editIcon, setEditIcon] = useState("");

  async function fetchCategories() {
    setLoading(true);
    try {
      const res = await fetch("/api/expense-categories");
      const data = await res.json();
      if (data.success) setCategories(data.categories);
    } catch {
      toast.error(tToast("loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchCategories(); }, []);

  async function handleAdd() {
    if (!addName.trim()) return toast.error(tToast("nameRequired"));
    setSaving(true);
    try {
      const res = await fetch("/api/expense-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName, nameAr: addNameAr, icon: addIcon }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(tToast("added"));
      setShowAdd(false);
      setAddName(""); setAddNameAr(""); setAddIcon("");
      fetchCategories();
    } catch { toast.error(tToast("addFailed")); }
    finally { setSaving(false); }
  }

  async function handleEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/expense-categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, nameAr: editNameAr, icon: editIcon }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(tToast("updated"));
      setEditId(null);
      fetchCategories();
    } catch { toast.error(tToast("updateFailed")); }
    finally { setSaving(false); }
  }

  async function handleToggle(id: string) {
    try {
      const res = await fetch(`/api/expense-categories/${id}`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(data.category.isActive ? tToast("activated") : tToast("deactivated"));
      fetchCategories();
    } catch { toast.error(tToast("toggleFailed")); }
  }

  function startEdit(cat: Category) {
    setEditId(cat.id);
    setEditName(cat.name);
    setEditNameAr(cat.nameAr || "");
    setEditIcon(cat.icon || "");
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
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
        <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">{t("listTitle")}</h3>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            {t("addButton")}
          </button>
        </div>

        <div className="divide-y divide-gray-100">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className={`px-5 py-3.5 flex items-center gap-4 transition-colors ${
                !cat.isActive ? "bg-gray-50 opacity-60" : "hover:bg-gray-50/50"
              }`}
            >
              {editId === cat.id ? (
                /* ── Edit mode ── */
                <div className="flex-1 flex items-center gap-3 flex-wrap">
                  <input
                    value={editIcon}
                    onChange={(e) => setEditIcon(e.target.value)}
                    placeholder={t("iconPlaceholder")}
                    className="w-12 rounded-lg border border-gray-300 px-2 py-1.5 text-center text-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder={t("namePlaceholderEn")}
                    className="flex-1 min-w-[120px] rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                  <input
                    value={editNameAr}
                    onChange={(e) => setEditNameAr(e.target.value)}
                    placeholder={t("namePlaceholderAr")}
                    dir="rtl"
                    className="flex-1 min-w-[120px] rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(cat.id)}
                      disabled={saving}
                      className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      <CheckIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                /* ── View mode ── */
                <>
                  <span className="text-xl w-8 text-center flex-shrink-0">{cat.icon || "📋"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{cat.name}</p>
                    {cat.nameAr && (
                      <p className="text-xs text-gray-500" dir="rtl">{cat.nameAr}</p>
                    )}
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    cat.isSystem ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {cat.isSystem ? t("system") : t("custom")}
                  </span>
                  <div className="flex items-center gap-2">
                    {!cat.isSystem && (
                      <button
                        onClick={() => startEdit(cat)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title={t("editTitle")}
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleToggle(cat.id)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                        cat.isActive
                          ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700"
                          : "bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700"
                      }`}
                    >
                      {cat.isActive ? t("active") : t("inactive")}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add form at the bottom */}
        {showAdd && (
          <div className="px-5 py-4 border-t-2 border-blue-100 bg-blue-50/50">
            <p className="text-xs font-semibold text-blue-700 mb-3">{t("newSectionTitle")}</p>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                value={addIcon}
                onChange={(e) => setAddIcon(e.target.value)}
                placeholder="🏷️"
                className="w-12 rounded-lg border border-blue-200 bg-white px-2 py-1.5 text-center text-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder={t("namePlaceholderEn")}
                className="flex-1 min-w-[120px] rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <input
                value={addNameAr}
                onChange={(e) => setAddNameAr(e.target.value)}
                placeholder={t("namePlaceholderAr")}
                dir="rtl"
                className="flex-1 min-w-[120px] rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAdd}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {saving ? t("saving") : t("addLabel")}
                </button>
                <button
                  onClick={() => { setShowAdd(false); setAddName(""); setAddNameAr(""); setAddIcon(""); }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
