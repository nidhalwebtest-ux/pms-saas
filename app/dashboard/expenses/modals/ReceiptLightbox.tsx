"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";

interface Props {
  images: string[];
  onClose: () => void;
}

export default function ReceiptLightbox({ images, onClose }: Props) {
  const t = useTranslations("expenses.lightbox");
  const tDet = useTranslations("expenses.detail");
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && idx < images.length - 1) setIdx(idx + 1);
      if (e.key === "ArrowLeft" && idx > 0) setIdx(idx - 1);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [idx, images.length, onClose]);

  if (images.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 px-5 py-4 flex items-center justify-between text-white z-10">
        <p className="text-sm font-medium ltr-numbers">
          {t("counter", { current: idx + 1, total: images.length })}
        </p>
        <div className="flex items-center gap-2">
          <a
            href={images[idx]}
            download
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            title={t("download")}
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            title={t("closeHint")}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="max-w-5xl max-h-[85vh] mx-auto px-12" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[idx]}
          alt={`${tDet("receiptHeading")} ${idx + 1}`}
          className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl"
        />
      </div>

      {/* Nav arrows */}
      {images.length > 1 && (
        <>
          {idx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setIdx(idx - 1); }}
              className="absolute start-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ChevronLeftIcon className="h-6 w-6 rtl:rotate-180" />
            </button>
          )}
          {idx < images.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setIdx(idx + 1); }}
              className="absolute end-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ChevronRightIcon className="h-6 w-6 rtl:rotate-180" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
