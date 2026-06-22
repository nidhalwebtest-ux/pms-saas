import type { BadgeVariantProps } from "@/components/ui";

/* ============================================================================
 *  Enum labels (English — internal founder tool). Keyed by the Prisma enum
 *  values so DB ⇄ UI mapping is trivial everywhere.
 * ========================================================================= */

export const CONTACT_ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  RECEPTIONIST: "Receptionist",
  UNKNOWN: "Unknown",
};

export const AREA_LABELS: Record<string, string> = {
  AL_HAFFA: "Al Haffa",
  AL_DAHARIZ: "Al Dahariz",
  CITY_CENTER: "City Center",
  OTHER: "Other",
};

export const SOURCE_LABELS: Record<string, string> = {
  GOOGLE_MAPS: "Google Maps",
  BOOKING_COM: "Booking.com",
  AIRBNB: "Airbnb",
  INSTAGRAM: "Instagram",
  REFERRAL: "Referral",
  OTHER: "Other",
};

export const STAGE_LABELS: Record<string, string> = {
  NOT_CONTACTED: "Not Contacted",
  VISITED: "Visited",
  DEMO_DONE: "Demo Done",
  INTERESTED: "Interested",
  SIGNED: "Signed",
  ACTIVE: "Active",
  LOST: "Lost",
};

export const INTEREST_LABELS: Record<string, string> = {
  HOT: "Hot",
  WARM: "Warm",
  COLD: "Cold",
  UNKNOWN: "Unknown",
};

export const WHO_MET_LABELS: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  RECEPTIONIST: "Receptionist",
  NOBODY: "Nobody",
};

export const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  CALL: "Call",
  VISIT: "Visit",
  OTHER: "Other",
};

/* ============================================================================
 *  Ordered value lists (for selects + funnel ordering)
 * ========================================================================= */

export const CONTACT_ROLES = ["OWNER", "MANAGER", "RECEPTIONIST", "UNKNOWN"] as const;
export const AREAS = ["AL_HAFFA", "AL_DAHARIZ", "CITY_CENTER", "OTHER"] as const;
export const SOURCES = ["GOOGLE_MAPS", "BOOKING_COM", "AIRBNB", "INSTAGRAM", "REFERRAL", "OTHER"] as const;
export const STAGES = ["NOT_CONTACTED", "VISITED", "DEMO_DONE", "INTERESTED", "SIGNED", "ACTIVE", "LOST"] as const;
export const INTERESTS = ["HOT", "WARM", "COLD", "UNKNOWN"] as const;
export const WHO_MET = ["OWNER", "MANAGER", "RECEPTIONIST", "NOBODY"] as const;
export const CHANNELS = ["WHATSAPP", "CALL", "VISIT", "OTHER"] as const;

/** The funnel pipeline (LOST is excluded — it's a sink, not a stage). */
export const FUNNEL_STAGES = ["NOT_CONTACTED", "VISITED", "DEMO_DONE", "INTERESTED", "SIGNED", "ACTIVE"] as const;

/** Helper: build {value,label} options for a <Select>, with an optional "All" head. */
export function toOptions(
  values: readonly string[],
  labels: Record<string, string>,
  allLabel?: string,
): { value: string; label: string }[] {
  const opts = values.map((v) => ({ value: v, label: labels[v] ?? v }));
  return allLabel ? [{ value: "", label: allLabel }, ...opts] : opts;
}

/* ============================================================================
 *  Badge mappers — return <Badge> props only (caller supplies the label text).
 *  Reuses the design-system Badge; no new primitives.
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
