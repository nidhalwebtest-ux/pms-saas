"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Modal, ModalBody } from "@/components/ui";

interface Props {
  images: string[];
  onClose: () => void;
}

export default function ReceiptLightbox({ images, onClose }: Props) {
  const t = useTranslations("expenses.lightbox");
  const tDet = useTranslations("expenses.detail");
  const [idx, setIdx] = useState(0);

  // Arrow-key navigation (Modal handles Escape on its own).
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" && idx < images.length - 1) setIdx(idx + 1);
      if (e.key === "ArrowLeft" && idx > 0) setIdx(idx - 1);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [idx, images.length]);

  if (images.length === 0) return null;

  return (
    <Modal
      open
      onClose={onClose}
      size="full"
      variant="centered"
      backdropBlur
      fullScreenOnMobile={false}
      className="!shadow-none !bg-transparent"
    >
      <ModalBody noPadding className="!overflow-visible">
        <div className="relative flex h-full w-full items-center justify-center p-12 max-sm:p-4">
          {/* Top bar */}
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 py-4 text-white">
            <p className="text-sm font-medium ltr-num">
              {t("counter", { current: idx + 1, total: images.length })}
            </p>
            <div className="flex items-center gap-2">
              <a
                href={images[idx]}
                download
                target="_blank"
                rel="noreferrer"
                className="rounded-sm p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                title={t("download")}
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
              </a>
              <button
                type="button"
                onClick={onClose}
                className="rounded-sm p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                title={t("closeHint")}
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[idx]}
            alt={`${tDet("receiptHeading")} ${idx + 1}`}
            className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
          />

          {/* Nav arrows */}
          {images.length > 1 && (
            <>
              {idx > 0 && (
                <button
                  type="button"
                  onClick={() => setIdx(idx - 1)}
                  className="absolute start-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
                >
                  <ChevronLeftIcon className="h-6 w-6 rtl:rotate-180" />
                </button>
              )}
              {idx < images.length - 1 && (
                <button
                  type="button"
                  onClick={() => setIdx(idx + 1)}
                  className="absolute end-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
                >
                  <ChevronRightIcon className="h-6 w-6 rtl:rotate-180" />
                </button>
              )}
            </>
          )}
        </div>
      </ModalBody>
    </Modal>
  );
}
