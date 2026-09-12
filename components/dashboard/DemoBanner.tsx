"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FeatureAnnouncement, Button } from "@/components/ui";
import { useTourState } from "@/hooks/useTourState";

const WHATSAPP_URL =
  "https://wa.me/96877804803?text=" +
  encodeURIComponent(
    "مرحبا نضال، جربت النظام التجريبي وأبغى أجهز حسابي الحقيقي",
  );

/**
 * Persistent top-of-app banner shown only inside a Demo Tour sandbox org
 * (Organization.isDemo). Dismiss state is plain in-memory React state, not
 * persisted anywhere — this layout component stays mounted across
 * client-side navigation within the dashboard, so dismissing it holds for
 * the rest of that visit, but any full page load (reload, fresh tab,
 * returning later) remounts the component and the banner is back. dir is
 * set once on <html> based on locale, so this needs no RTL-specific code.
 */
export function DemoBanner() {
  const t = useTranslations("dashboard.demoBanner");
  const [dismissed, setDismissed] = useState(false);
  const tour = useTourState();

  if (dismissed) return null;

  return (
    <div className="border-b-2 border-brand-300 bg-brand-50">
      <FeatureAnnouncement
        title={t("title")}
        actionLabel={t("cta")}
        onAction={() => window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer")}
        onDismiss={() => setDismissed(true)}
        className="rounded-none border-none bg-transparent"
      />
      <div className="px-4 pb-2.5 -mt-1">
        <Button variant="ghost" size="sm" onClick={() => tour.start()}>
          {t("showMeAround")}
        </Button>
      </div>
    </div>
  );
}
