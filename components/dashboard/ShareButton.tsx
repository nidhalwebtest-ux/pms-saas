"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ShareIcon,
  XMarkIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
  LinkIcon,
  ArrowDownTrayIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import type { ShareDocType } from "@/lib/share-token";

interface MintData {
  shareUrl: string;
  pdfUrl: string;
  fileName: string;
  title: string;
  message: string;
  tenantPhone: string | null;
  tenantEmail: string | null;
}

export default function ShareButton({
  type,
  id,
  label,
  className,
  iconOnly,
}: {
  type: ShareDocType;
  id: string;
  label?: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const t = useTranslations("share");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MintData | null>(null);
  const [busy, setBusy] = useState(false);

  async function openModal() {
    setOpen(true);
    if (data) return;
    setLoading(true);
    try {
      const res = await fetch("/api/share/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id }),
      });
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      toast.error(t("error"));
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  async function onWhatsApp() {
    if (!data) return;
    // Mobile: native share sheet with the actual PDF file attached.
    if (typeof navigator !== "undefined" && navigator.canShare) {
      setBusy(true);
      try {
        const r = await fetch(data.pdfUrl);
        if (r.ok) {
          const blob = await r.blob();
          const file = new File([blob], data.fileName, { type: "application/pdf" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share!({ files: [file], title: data.title, text: data.message });
            setOpen(false);
            return;
          }
        }
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return; // user cancelled
        // otherwise fall through to wa.me link
      } finally {
        setBusy(false);
      }
    }
    // Desktop / no file-share: open the tenant's chat with a ready message + link.
    const phone = (data.tenantPhone || "").replace(/\D/g, "");
    const text = encodeURIComponent(`${data.message}\n${data.shareUrl}`);
    const url = phone
      ? `https://wa.me/${phone}?text=${text}`
      : `https://api.whatsapp.com/send?text=${text}`;
    window.open(url, "_blank", "noopener");
    setOpen(false);
  }

  function onEmail() {
    if (!data) return;
    const subject = encodeURIComponent(t("emailSubject", { title: data.title }));
    const bodyText = encodeURIComponent(`${data.message}\n\n${data.shareUrl}`);
    window.location.href = `mailto:${data.tenantEmail ?? ""}?subject=${subject}&body=${bodyText}`;
    setOpen(false);
  }

  async function onCopy() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.shareUrl);
      toast.success(t("copied"));
    } catch {
      toast.error(t("error"));
    }
  }

  function onDownload() {
    if (!data) return;
    window.open(data.pdfUrl, "_blank", "noopener");
    setOpen(false);
  }

  const Option = ({
    icon, title: ot, desc, onClick, tone = "gray",
  }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void; tone?: "green" | "blue" | "gray" }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex w-full items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-start transition-colors hover:bg-gray-50 disabled:opacity-50"
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
        tone === "green" ? "bg-green-100 text-green-600"
        : tone === "blue" ? "bg-blue-100 text-blue-600"
        : "bg-gray-100 text-gray-600"
      }`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-gray-900">{ot}</span>
        <span className="block text-xs text-gray-500 truncate">{desc}</span>
      </span>
      <ChevronRightIcon className="h-4 w-4 text-gray-300 rtl:rotate-180" />
    </button>
  );

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={className ?? "inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"}
      >
        <ShareIcon className="h-4 w-4 text-gray-400" />
        {!iconOnly && (label ?? t("button"))}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
              <h3 className="text-base font-bold text-gray-900">{t("title")}</h3>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2.5 p-5">
              {loading || !data ? (
                <div className="py-8 text-center text-sm text-gray-400">{t("loading")}</div>
              ) : (
                <>
                  {data.title && <p className="mb-2 text-sm text-gray-500 truncate">{data.title}</p>}
                  <Option tone="green" icon={<ChatBubbleLeftRightIcon className="h-5 w-5" />} title={t("whatsapp")} desc={t("whatsappDesc")} onClick={onWhatsApp} />
                  <Option tone="blue" icon={<EnvelopeIcon className="h-5 w-5" />} title={t("email")} desc={t("emailDesc")} onClick={onEmail} />
                  <Option icon={<LinkIcon className="h-5 w-5" />} title={t("copyLink")} desc={t("copyDesc")} onClick={onCopy} />
                  <Option icon={<ArrowDownTrayIcon className="h-5 w-5" />} title={t("download")} desc={t("downloadDesc")} onClick={onDownload} />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
