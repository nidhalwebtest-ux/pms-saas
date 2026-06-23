"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowUpTrayIcon,
  CameraIcon,
  TrashIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui";
import { uploadBuildingPhoto, removeBuildingPhoto } from "../actions";

const MAX_BYTES = 5 * 1024 * 1024;

export default function BuildingPhoto({
  prospectId,
  photo,
}: {
  prospectId: string;
  photo: string | null;
}) {
  const router = useRouter();
  const t = useTranslations("admin");
  const [current, setCurrent] = useState<string | null>(photo);
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Keep local state in sync with the server after router.refresh().
  useEffect(() => setCurrent(photo), [photo]);

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("building.chooseImage"));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("building.maxSize"));
      return;
    }

    // Upload server-side (service-role client) — the browser client is blocked
    // by storage RLS for the prospects/ prefix.
    setUploading(true);
    const fd = new FormData();
    fd.set("prospectId", prospectId);
    fd.set("file", file);
    const res = await uploadBuildingPhoto(fd);
    setUploading(false);

    if ("error" in res) {
      toast.error(t("building.uploadFailed", { message: res.error }));
      return;
    }
    toast.success(t("building.saved"));
    router.refresh();
  };

  const remove = () => {
    const previous = current;
    setCurrent(null);
    startTransition(async () => {
      const res = await removeBuildingPhoto(prospectId);
      if ("error" in res) {
        setCurrent(previous);
        toast.error(res.error);
        return;
      }
      toast.success(t("building.removed"));
      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl border border-border-default bg-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-fg">{t("building.title")}</h3>

      {current ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg ring-1 ring-border-default">
          <Image src={current} alt="Building" fill className="object-cover" unoptimized />
          <button
            type="button"
            onClick={remove}
            className="absolute end-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-error-600"
            aria-label={t("building.remove")}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border-default bg-canvas text-center">
          {uploading ? (
            <>
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              <p className="text-sm text-brand-600">{t("building.uploading")}</p>
            </>
          ) : (
            <>
              <BuildingOffice2Icon className="h-9 w-9 text-fg-tertiary/50" />
              <p className="text-xs text-fg-tertiary">{t("building.noPhoto")}</p>
            </>
          )}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          leftIcon={<ArrowUpTrayIcon className="h-4 w-4" />}
          onClick={() => uploadRef.current?.click()}
          disabled={uploading}
        >
          {t("building.upload")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          leftIcon={<CameraIcon className="h-4 w-4" />}
          onClick={() => cameraRef.current?.click()}
          disabled={uploading}
        >
          {t("building.takePhoto")}
        </Button>
      </div>

      {/* Upload from library */}
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {/* Take photo — capture opens the rear camera on mobile */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
