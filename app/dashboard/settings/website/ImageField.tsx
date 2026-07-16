"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { PhotoIcon, XMarkIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { Spinner } from "@/components/ui";
import { uploadMedia } from "@/app/dashboard/actions/upload-media";

export default function ImageField({
  value,
  onChange,
  folder,
  label,
  hint,
  aspect = "square",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  folder: string; // must start with "sites/"
  label: string;
  hint?: string;
  aspect?: "square" | "wide";
}) {
  const t = useTranslations("settings.website");
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);

  const pick = () => inputRef.current?.click();

  const onFile = (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error(t("upload.tooLarge")); return; }
    if (!file.type.startsWith("image/")) { toast.error(t("upload.notImage")); return; }
    setBusy(true);
    start(async () => {
      const fd = new FormData();
      fd.append("folder", folder);
      fd.append("file", file);
      const res = await uploadMedia(fd);
      setBusy(false);
      if (res.ok) { onChange(res.url); toast.success(t("upload.done")); }
      else toast.error(t("upload.failed"));
    });
  };

  const box = aspect === "wide" ? "h-24 w-40" : "h-16 w-16";

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div
        onClick={pick}
        className="relative flex cursor-pointer items-center gap-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 transition hover:border-blue-400 hover:bg-blue-50/30"
      >
        <div className={`flex ${box} flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-gray-200`}>
          {busy || pending ? (
            <span className="text-gray-400"><Spinner size={24} /></span>
          ) : value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-contain" />
          ) : (
            <PhotoIcon className="h-7 w-7 text-gray-300" />
          )}
        </div>
        <div className="flex-1">
          <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
            <ArrowUpTrayIcon className="h-4 w-4" />
            {value ? t("upload.change") : t("upload.cta")}
          </p>
          {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
        </div>
        {value && !busy && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="rounded-full bg-white p-1.5 text-gray-400 ring-1 ring-gray-200 transition hover:bg-red-50 hover:text-red-600"
            title={t("upload.remove")}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
