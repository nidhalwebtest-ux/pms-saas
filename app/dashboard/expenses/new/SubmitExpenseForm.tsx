"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import {
  CameraIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
  CheckCircleIcon,
  BuildingOffice2Icon,
  DocumentTextIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui";

interface Property { id: string; name: string }
interface Category {
  id: string;
  name: string;
  nameAr: string | null;
  icon: string | null;
  isActive: boolean;
}

interface Props {
  properties: Property[];
  defaultPropertyId: string;
}

const LAST_PROPERTY_KEY = "expense:lastPropertyId";

export default function SubmitExpenseForm({ properties, defaultPropertyId }: Props) {
  const router = useRouter();
  const t = useTranslations("expenses.submit");
  const tErr = useTranslations("expenses.submit.errors");
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // ── Form state ────────────────────────────────────────────────────────
  const [propertyId, setPropertyId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount]         = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes]           = useState("");

  // Receipt images
  const [receipts, setReceipts] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);

  const [submitting, setSubmitting] = useState(false);

  // Hydrate property selection: query param > localStorage > first property
  useEffect(() => {
    if (defaultPropertyId && properties.some((p) => p.id === defaultPropertyId)) {
      setPropertyId(defaultPropertyId);
      return;
    }
    const stored = typeof window !== "undefined" ? localStorage.getItem(LAST_PROPERTY_KEY) : null;
    if (stored && properties.some((p) => p.id === stored)) {
      setPropertyId(stored);
    } else if (properties.length === 1) {
      setPropertyId(properties[0].id);
    }
  }, [defaultPropertyId, properties]);

  // Fetch categories
  useEffect(() => {
    fetch("/api/expense-categories")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCategories(d.categories.filter((c: Category) => c.isActive));
      })
      .catch(() => toast.error(tErr("loadCategoriesFailed")))
      .finally(() => setCatsLoading(false));
  }, [tErr]);

  // ── Upload receipts ────────────────────────────────────────────────────
  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (receipts.length + files.length > 2) {
      toast.error(tErr("maxReceipts"));
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(tErr("fileTooLarge", { name: file.name }));
          continue;
        }
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `expenses/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage
          .from("pms-media")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (error) {
          toast.error(tErr("uploadFailed", { message: error.message }));
          continue;
        }
        const { data } = supabase.storage.from("pms-media").getPublicUrl(path);
        setReceipts((prev) => [...prev, data.publicUrl]);
      }
    } finally {
      setUploading(false);
    }
  }

  function removeReceipt(url: string) {
    const path = url.split("/pms-media/")[1];
    if (path) supabase.storage.from("pms-media").remove([path]);
    setReceipts((prev) => prev.filter((u) => u !== url));
  }

  // ── Submit ─────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!propertyId) return toast.error(tErr("buildingRequired"));
    if (!categoryId) return toast.error(tErr("categoryRequired"));
    if (!description.trim()) return toast.error(tErr("descriptionRequired"));
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return toast.error(tErr("amountInvalid"));
    if (receipts.length === 0) return toast.error(tErr("receiptRequired"));

    setSubmitting(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          categoryId,
          amount: amt,
          description,
          notes: notes || undefined,
          receiptImage: receipts[0],
          receiptImage2: receipts[1] || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? tErr("submitFailed")); return; }

      toast.success(tErr("submittedSuccess"));
      // Save the building selection for next time
      if (typeof window !== "undefined") localStorage.setItem(LAST_PROPERTY_KEY, propertyId);
      router.push("/dashboard/expenses");
      router.refresh();
    } catch {
      toast.error(tErr("networkError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitAndAnother(e: React.MouseEvent) {
    e.preventDefault();
    if (!propertyId) return toast.error(tErr("buildingRequired"));
    if (!categoryId) return toast.error(tErr("categoryRequired"));
    if (!description.trim()) return toast.error(tErr("descriptionRequired"));
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return toast.error(tErr("amountPositive"));
    if (receipts.length === 0) return toast.error(tErr("receiptRequiredShort"));

    setSubmitting(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId, categoryId, amount: amt, description,
          notes: notes || undefined,
          receiptImage: receipts[0],
          receiptImage2: receipts[1] || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(tErr("submittedNumber", { number: data.expense.expenseNumber }));
      if (typeof window !== "undefined") localStorage.setItem(LAST_PROPERTY_KEY, propertyId);
      // Reset form fields except property
      setCategoryId(""); setAmount(""); setDescription(""); setNotes(""); setReceipts([]);
    } catch { toast.error(tErr("networkError")); }
    finally { setSubmitting(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* ── Building ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
          <BuildingOffice2Icon className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">{t("buildingHeading")}</h3>
          <span className="text-xs text-red-500 font-medium">*</span>
        </div>
        <div className="px-5 py-4">
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            required
            className="w-full rounded-lg border-0 bg-white py-2.5 ps-3 pe-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
          >
            <option value="">{t("buildingPlaceholder")}</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Category Grid ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
          <span className="text-base">🏷️</span>
          <h3 className="text-sm font-semibold text-gray-700">{t("categoryHeading")}</h3>
          <span className="text-xs text-red-500 font-medium">*</span>
        </div>
        <div className="px-5 py-4">
          {catsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">{t("categoryEmpty")}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {categories.map((cat) => {
                const sel = categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={`relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                      sel
                        ? "border-blue-600 bg-blue-50 shadow-sm"
                        : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30"
                    }`}
                  >
                    {sel && (
                      <CheckCircleIcon className="absolute top-1.5 end-1.5 h-4 w-4 text-blue-600" />
                    )}
                    <span className="text-2xl">{cat.icon || "📋"}</span>
                    <span className={`text-xs font-medium text-center leading-tight ${
                      sel ? "text-blue-700" : "text-gray-700"
                    }`}>
                      {cat.name}
                    </span>
                    {cat.nameAr && (
                      <span className="text-[10px] text-gray-400" dir="rtl">{cat.nameAr}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Amount & Description ──────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
          <DocumentTextIcon className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">{t("detailsHeading")}</h3>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              {t("amountLabel")} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.001"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder={t("amountPlaceholder")}
                className="w-full rounded-lg border-0 bg-white py-2.5 ps-3 pe-16 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm tabular-nums ltr-numbers"
              />
              <span className="absolute inset-y-0 end-3 flex items-center text-sm text-gray-500 font-semibold">OMR</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              {t("descriptionLabel")} <span className="text-red-500">*</span>
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder={t("descriptionPlaceholder")}
              className="w-full rounded-lg border-0 bg-white py-2.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              {t("notesLabel")} <span className="text-gray-400 font-normal">{t("notesOptional")}</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={t("notesPlaceholder")}
              className="w-full rounded-lg border-0 bg-white py-2.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm resize-none"
            />
          </div>
        </div>
      </div>

      {/* ── Receipt ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
          <CameraIcon className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">{t("receiptHeading")}</h3>
          <span className="text-xs text-red-500 font-medium">*</span>
          <span className="ms-auto text-xs text-gray-400 ltr-numbers">{t("receiptCount", { count: receipts.length, max: 2 })}</span>
        </div>

        <div className="px-5 py-4 space-y-3">
          {receipts.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {receipts.map((url) => (
                <div
                  key={url}
                  className="relative h-32 w-32 overflow-hidden rounded-xl ring-1 ring-gray-200 shadow-sm"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={t("receiptHeading")} className="object-cover w-full h-full" />
                  <button
                    type="button"
                    onClick={() => removeReceipt(url)}
                    className="absolute end-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-600 transition-colors"
                  >
                    <XMarkIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {receipts.length < 2 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100 hover:border-blue-400 disabled:opacity-50 transition-colors"
              >
                <CameraIcon className="h-4 w-4" />
                {t("takePhoto")}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:border-gray-400 disabled:opacity-50 transition-colors"
              >
                <ArrowUpTrayIcon className="h-4 w-4" />
                {t("uploadFile")}
              </button>
              {uploading && (
                <span className="inline-flex items-center text-xs text-blue-600 font-medium">
                  {t("uploading")}
                </span>
              )}
            </div>
          )}

          <p className="text-xs text-gray-400">
            {t("fileTypesHint")} {receipts.length === 0 ? t("atLeastOne") : ""}
          </p>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      {/* ── Submit Buttons ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.push("/dashboard/expenses")}
          className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
        >
          {t("cancel")}
        </button>
        <button
          type="button"
          onClick={handleSubmitAndAnother}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50 transition-colors"
        >
          {t("submitAndAnother")}
        </button>
        <Button
          type="submit"
          loading={submitting}
          leftIcon={<PaperAirplaneIcon className="h-4 w-4" />}
        >
          {t("submitBtn")}
        </Button>
      </div>
    </form>
  );
}
