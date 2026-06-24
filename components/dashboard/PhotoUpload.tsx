"use client";

/**
 * PhotoUpload – drag-and-drop / click-to-browse image uploader.
 *
 * Prerequisites:
 *   • Create a Supabase Storage bucket named "pms-media" with public read access.
 *     In Supabase dashboard → Storage → New bucket → name: pms-media → Public: ON.
 *   • Row-Level-Security policy: allow authenticated users to INSERT/DELETE under
 *     their own org folder.
 */

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpTrayIcon, XMarkIcon, PhotoIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import { compressImage } from "@/utils/compress-image";
import { uploadMedia, deleteMedia } from "@/app/dashboard/actions/upload-media";

interface Props {
  /** Pre-existing photo URLs loaded from the DB (edit mode). */
  initialPhotos?: string[];
  /** Storage sub-folder, e.g. "properties/abc123" or "units/xyz456". */
  folder: string;
  /** Hidden input name submitted with the form. Default: "photos". */
  name?: string;
}

export default function PhotoUpload({ initialPhotos = [], folder, name = "photos" }: Props) {
  const t = useTranslations("photoUpload");
  const [photos, setPhotos] = useState<string[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);

    const added: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        setUploadError(t("onlyImages"));
        continue;
      }

      // Downscale + re-encode in the browser so big camera photos upload fast.
      const optimized = await compressImage(file, { maxDim: 1600, quality: 0.8 });
      if (optimized.size > 5 * 1024 * 1024) {
        setUploadError(t("sizeLimit"));
        continue;
      }

      // Upload server-side (service-role) — the browser client is RLS-blocked.
      const fd = new FormData();
      fd.set("folder", folder);
      fd.set("file", optimized);
      const res = await uploadMedia(fd);

      if (!res.ok) {
        setUploadError(t("uploadFailed", { message: res.error }));
        continue;
      }
      added.push(res.url);
    }

    setPhotos((prev) => [...prev, ...added]);
    setUploading(false);
  };

  const removePhoto = async (url: string) => {
    await deleteMedia(url);
    setPhotos((prev) => prev.filter((p) => p !== url));
  };

  return (
    <div className="col-span-full space-y-3">
      {/* Hidden input carries the JSON array on form submit */}
      <input type="hidden" name={name} value={JSON.stringify(photos)} />

      {/* Thumbnail grid */}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {photos.map((url) => (
            <div
              key={url}
              className="relative h-24 w-24 overflow-hidden rounded-xl ring-1 ring-gray-200 shadow-sm"
            >
              <Image src={url} alt={t("photoAlt")} fill className="object-cover" unoptimized />
              <button
                type="button"
                onClick={() => removePhoto(url)}
                className="absolute end-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-red-600"
                aria-label={t("removePhoto")}
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-6 py-8 text-center transition-colors hover:border-blue-400 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {uploading ? (
          <>
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <p className="text-sm text-blue-600 font-medium">{t("uploading")}</p>
          </>
        ) : (
          <>
            {photos.length > 0 ? (
              <ArrowUpTrayIcon className="h-7 w-7 text-gray-400" />
            ) : (
              <PhotoIcon className="h-10 w-10 text-gray-300" />
            )}
            <p className="text-sm font-medium text-gray-700">
              {t("browsePrefix")}
              <span className="text-blue-600">{t("browse")}</span>
            </p>
            <p className="text-xs text-gray-400">{t("constraints")}</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {uploadError && (
        <p className="text-xs text-red-600">{uploadError}</p>
      )}
    </div>
  );
}
