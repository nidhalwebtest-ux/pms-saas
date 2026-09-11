"use client";

import { useTranslations } from "next-intl";

const WHATSAPP_URL =
  "https://wa.me/96877804803?text=" +
  encodeURIComponent(
    "مرحبا نضال، جربت النظام التجريبي وأبغى أجهز حسابي الحقيقي",
  );

/**
 * Always-reachable floating exit CTA inside a Demo Tour sandbox. Stacked
 * above the other two dashboard FABs (AvailabilityCalendarButton at
 * bottom-6/start, AdminPanelButton at bottom-6/end) so it never overlaps
 * either regardless of which corner they occupy.
 */
export function DemoWhatsAppButton() {
  const t = useTranslations("dashboard.demoBanner");

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("cta")}
      className="group fixed bottom-24 end-6 z-40 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-[#1ea952] transition-all hover:scale-105 hover:bg-[#20bd5a] active:scale-95"
    >
      <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.642-.981z" />
      </svg>
      <span className="hidden sm:inline">{t("cta")}</span>
    </a>
  );
}
