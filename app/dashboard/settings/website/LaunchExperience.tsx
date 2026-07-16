"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CheckCircleIcon, ArrowTopRightOnSquareIcon, LinkIcon, ExclamationTriangleIcon,
} from "@heroicons/react/24/solid";
import { Spinner, Button } from "@/components/ui";
import type { PublishResult } from "./actions";

const STEP_KEYS = ["reserve", "brand", "publish", "live"] as const;
const STEP_MS = 1300;
const MIN_MS = STEP_KEYS.length * STEP_MS + 400;

export default function LaunchExperience({
  run,
  onDone,
  onClose,
}: {
  run: () => Promise<PublishResult>;
  onDone: (r: PublishResult) => void;
  onClose: () => void;
}) {
  const t = useTranslations("settings.website");
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(0);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    let alive = true;
    const started = Date.now();

    const timers = STEP_KEYS.map((_, i) =>
      setTimeout(() => alive && setActive((a) => Math.max(a, i + 1)), (i + 1) * STEP_MS),
    );

    run().then((res) => {
      const wait = Math.max(0, MIN_MS - (Date.now() - started));
      setTimeout(async () => {
        if (!alive) return;
        setActive(STEP_KEYS.length);
        setResult(res);
        onDone(res);
        if (res.ok) {
          // Confetti 🎉
          try {
            const confetti = (await import("canvas-confetti")).default;
            confetti({ particleCount: 140, spread: 75, origin: { y: 0.6 } });
            setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.5 } }), 250);
          } catch { /* non-fatal */ }
          // QR of the live URL
          try {
            const QR = (await import("qrcode")).default;
            setQr(await QR.toDataURL(res.url, { width: 220, margin: 1 }));
          } catch { /* non-fatal */ }
        }
      }, wait);
    });

    return () => { alive = false; timers.forEach(clearTimeout); };
  }, [run, onDone]);

  if (!mounted) return null;

  const done = result?.ok === true;
  const failed = result != null && result.ok === false;

  const body = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* ── Provisioning ── */}
        {!result && (
          <div className="p-8">
            <div className="mb-6 flex flex-col items-center gap-2 text-center">
              <span className="text-blue-500"><Spinner size={32} /></span>
              <h2 className="text-lg font-bold text-gray-900">{t("launch.provisioning")}</h2>
              <p className="text-sm text-gray-500">{t("launch.provisioningSub")}</p>
            </div>
            <ul className="space-y-3">
              {STEP_KEYS.map((k, i) => {
                const state = i < active ? "done" : i === active ? "active" : "todo";
                return (
                  <li key={k} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center">
                      {state === "done" ? <CheckCircleIcon className="h-6 w-6 text-green-500" />
                        : state === "active" ? <span className="text-blue-500"><Spinner size={20} /></span>
                        : <span className="h-3 w-3 rounded-full bg-gray-200" />}
                    </span>
                    <span className={`text-sm ${state === "todo" ? "text-gray-400" : "text-gray-800"}`}>
                      {t(`launch.steps.${k}`)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* ── Celebration ── */}
        {done && result.ok && (
          <div className="p-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <CheckCircleIcon className="h-9 w-9 text-green-500" />
            </div>
            <h2 className="text-xl font-extrabold text-gray-900">{t("launch.liveTitle")}</h2>
            <p className="mt-1 text-sm text-gray-500">{t("launch.liveSub")}</p>

            <a
              href={result.url}
              target="_blank"
              rel="noreferrer"
              dir="ltr"
              className="mt-5 block truncate rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 px-4 py-3 text-base font-bold text-blue-700 transition hover:bg-blue-50"
            >
              {result.host}
            </a>

            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="QR" className="mx-auto mt-4 h-32 w-32 rounded-lg ring-1 ring-gray-200" />
            )}

            {result.domainWarning && (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-amber-600">
                <ExclamationTriangleIcon className="h-4 w-4" /> {t("launch.domainPending")}
              </p>
            )}

            <div className="mt-5 grid grid-cols-3 gap-2">
              <a href={result.url} target="_blank" rel="noreferrer"
                 className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 py-2.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50">
                <ArrowTopRightOnSquareIcon className="h-5 w-5 text-blue-500" /> {t("launch.open")}
              </a>
              <button type="button"
                onClick={() => { navigator.clipboard?.writeText(result.url); toast.success(t("launch.copied")); }}
                className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 py-2.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50">
                <LinkIcon className="h-5 w-5 text-blue-500" /> {t("launch.copy")}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(t("launch.shareMsg", { url: result.url }))}`}
                target="_blank" rel="noreferrer"
                className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 py-2.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-green-500"><path d="M12 2a10 10 0 00-8.6 15l-1.4 5 5.1-1.3A10 10 0 1012 2zm0 18a8 8 0 01-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1112 20zm4.4-6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.5 6.5 0 01-1.9-1.2 7.3 7.3 0 01-1.3-1.7c-.1-.2 0-.4.1-.5l.4-.4.3-.5c.1-.1 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a1 1 0 00-.7.3A2.8 2.8 0 006 9.3c0 1.7 1.2 3.3 1.4 3.5.2.2 2.4 3.7 5.8 5 .8.3 1.5.5 2 .7.8.2 1.6.2 2.2.1.7-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1 0-.1-.2-.2-.4-.3z"/></svg>
                {t("launch.whatsapp")}
              </a>
            </div>

            <Button variant="primary" fullWidth className="mt-4" onClick={onClose}>
              {t("launch.goDashboard")}
            </Button>
          </div>
        )}

        {/* ── Error ── */}
        {failed && (
          <div className="p-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">{t("launch.errorTitle")}</h2>
            <p className="mt-1 text-sm text-gray-500">{t("launch.errorSub")}</p>
            <Button variant="secondary" fullWidth className="mt-5" onClick={onClose}>{t("launch.errorBack")}</Button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
