import type { BadgeVariantProps } from "@/components/ui";

/* ============================================================================
 *  CRM enum value lists + visual badge mappers.
 *
 *  Display LABELS are NOT here — they live in the i18n `admin.enums.*` keys
 *  (messages/en.json + ar.json) and are resolved at the call site with
 *  useTranslations/getTranslations, e.g. t(`enums.stage.${value}`).
 *
 *  NOTE: "area" is no longer an enum — it's a managed AreaClassification table
 *  (Admin → Settings). See _lib/areas.ts + _lib/area-label.ts.
 * ========================================================================= */

export const CONTACT_ROLES = ["OWNER", "MANAGER", "RECEPTIONIST", "UNKNOWN"] as const;
export const SOURCES = ["GOOGLE_MAPS", "BOOKING_COM", "AIRBNB", "INSTAGRAM", "REFERRAL", "OTHER"] as const;
export const STAGES = ["NOT_CONTACTED", "VISITED", "DEMO_DONE", "INTERESTED", "SIGNED", "ACTIVE", "LOST"] as const;
export const INTERESTS = ["HOT", "WARM", "COLD", "UNKNOWN"] as const;
export const WHO_MET = ["OWNER", "MANAGER", "RECEPTIONIST", "NOBODY"] as const;
export const CHANNELS = ["WHATSAPP", "CALL", "VISIT", "OTHER"] as const;

/** The funnel pipeline (LOST is excluded — it's a sink, not a stage). */
export const FUNNEL_STAGES = ["NOT_CONTACTED", "VISITED", "DEMO_DONE", "INTERESTED", "SIGNED", "ACTIVE"] as const;

/* ============================================================================
 *  Badge mappers — return <Badge> props only (caller supplies the label text).
 * ========================================================================= */

export function tierBadge(tier: number): BadgeVariantProps {
  switch (tier) {
    case 1:
      return { tone: "gold", appearance: "solid" };
    case 2:
      return { tone: "info", appearance: "subtle" };
    default:
      return { tone: "neutral", appearance: "subtle" };
  }
}

/** Short tier code — stays "T1/T2/T3" in both languages (it's an abbreviation). */
export function tierLabel(tier: number): string {
  return `T${tier}`;
}

export function stageBadge(stage: string): BadgeVariantProps {
  switch (stage) {
    case "NOT_CONTACTED":
      return { tone: "neutral", appearance: "subtle" };
    case "VISITED":
      return { tone: "info", appearance: "subtle", dot: true };
    case "DEMO_DONE":
      return { tone: "accent", appearance: "subtle", dot: true };
    case "INTERESTED":
      return { tone: "warning", appearance: "subtle", dot: true };
    case "SIGNED":
      return { tone: "success", appearance: "solid", dot: true };
    case "ACTIVE":
      return { tone: "success", appearance: "subtle", dot: true };
    case "LOST":
      return { tone: "neutral", appearance: "subtle", strikethrough: true };
    default:
      return { tone: "neutral", appearance: "subtle" };
  }
}

export function interestBadge(interest: string): BadgeVariantProps {
  switch (interest) {
    case "HOT":
      return { tone: "danger", appearance: "solid", dot: true };
    case "WARM":
      return { tone: "warning", appearance: "subtle", dot: true };
    case "COLD":
      return { tone: "info", appearance: "subtle", dot: true };
    default:
      return { tone: "neutral", appearance: "subtle" };
  }
}
