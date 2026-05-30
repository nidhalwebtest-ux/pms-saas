/**
 * Badge helpers — map business enums to <Badge> props.
 *
 * Pattern: call sites stay tiny and i18n stays where it already is.
 *
 *   const props = getReservationStatusBadge("in-house");
 *   <Badge {...props}>{t("inHouse")}</Badge>
 *
 * Labels are NOT included in the helper output — the call site already has
 * its own `t` function for the relevant i18n namespace. The helper is pure
 * visual mapping.
 *
 * For the legacy reservation flow (where `getDisplayStatus()` returns a
 * display label like "In House"), use `reservationStatusKeyFromDisplayLabel`
 * to bridge the old label → new key.
 */

import type { ReactNode } from "react";
import {
  StarIcon,
} from "@heroicons/react/24/solid";
import {
  ShieldExclamationIcon,
  NoSymbolIcon,
} from "@heroicons/react/24/outline";
import type { BadgeTone, BadgeAppearance } from "./Badge";

/* ----------------------------------------------------------------------------
 *  Shared return type — visual props only. Caller supplies children + size.
 * ------------------------------------------------------------------------- */

export interface BadgeVariantProps {
  tone: BadgeTone;
  appearance?: BadgeAppearance;
  dot?: boolean;
  icon?: ReactNode;
  pulse?: boolean;
  strikethrough?: boolean;
}

/* ----------------------------------------------------------------------------
 *  Reservation statuses
 *  Per user decision: keep SOLID for urgent statuses (was spec default
 *  subtle — overridden so the receptionist still spots them on busy lists).
 * ------------------------------------------------------------------------- */

export type ReservationStatusKey =
  | "upcoming"
  | "arriving-today"
  | "overdue-arrival"
  | "in-house"
  | "due-checkout"
  | "overstay"
  | "checked-out"
  | "cancelled"
  | "no-show";

export function getReservationStatusBadge(
  status: ReservationStatusKey,
): BadgeVariantProps {
  switch (status) {
    case "upcoming":
      return { tone: "info",    appearance: "subtle", dot: true };
    case "arriving-today":
      return { tone: "warning", appearance: "solid",  dot: true };
    case "overdue-arrival":
      return { tone: "danger",  appearance: "solid",  dot: true };
    case "in-house":
      return { tone: "success", appearance: "solid",  dot: true };
    case "due-checkout":
      return { tone: "warning", appearance: "solid",  dot: true };
    case "overstay":
      return { tone: "danger",  appearance: "solid",  dot: true, pulse: true };
    case "checked-out":
      return { tone: "neutral", appearance: "subtle", dot: true };
    case "cancelled":
      return { tone: "neutral", appearance: "subtle", dot: true, strikethrough: true };
    case "no-show":
      return {
        tone: "neutral",
        appearance: "subtle",
        icon: <NoSymbolIcon className="h-full w-full" />,
      };
  }
}

/** Bridges legacy `getDisplayStatus().label` string → new status key. */
export function reservationStatusKeyFromDisplayLabel(
  label: string,
): ReservationStatusKey {
  const map: Record<string, ReservationStatusKey> = {
    "Upcoming":        "upcoming",
    "Arriving Today":  "arriving-today",
    "Overdue Arrival": "overdue-arrival",
    "In House":        "in-house",
    "Due Checkout":    "due-checkout",
    "Overstay":        "overstay",
    "Checked Out":     "checked-out",
    "Cancelled":       "cancelled",
    "No Show":         "no-show",
    "Pending":         "upcoming",
  };
  return map[label] ?? "upcoming";
}

/* ----------------------------------------------------------------------------
 *  Invoice statuses
 *  `draft` added per audit (auto-issue monthly cycle flow).
 *  `overdue` is derived, handled by the dedicated helper below.
 * ------------------------------------------------------------------------- */

export type InvoiceStatusKey =
  | "draft"
  | "pending"
  | "partially-paid"
  | "paid"
  | "returned"
  | "cancelled";

export function getInvoiceStatusBadge(
  status: InvoiceStatusKey,
): BadgeVariantProps {
  switch (status) {
    case "draft":
      return { tone: "neutral", appearance: "subtle" };
    case "pending":
      return { tone: "warning", appearance: "subtle", dot: true };
    case "partially-paid":
      return { tone: "warning", appearance: "subtle", dot: true };
    case "paid":
      return { tone: "success", appearance: "subtle", dot: true };
    case "returned":
      return { tone: "info",    appearance: "subtle", dot: true };
    case "cancelled":
      return { tone: "neutral", appearance: "subtle", dot: true };
  }
}

/**
 * Maps a raw invoice status + due-date into final badge props.
 * Encapsulates the overdue derivation (was duplicated across 3 pages).
 *
 * `OVERDUE` keys: any of {pending, partially-paid} with dueDate < today.
 * Returns props for `danger` subtle dot in that case.
 *
 * Also maps the legacy DB enum strings (DRAFT, ISSUED, PENDING, PARTIALLY_PAID,
 * PAID, CANCELLED) → spec keys so call sites that have raw DB values dont
 * need to translate twice.
 */
export function resolveInvoiceBadge(
  rawStatus: string,
  dueDate: Date | string | null | undefined,
  today: Date = new Date(),
): { props: BadgeVariantProps; key: InvoiceStatusKey | "overdue" } {
  const normalized = rawStatus.toLowerCase().replace(/_/g, "-");

  // Treat ISSUED as PENDING — they're aliases in this app.
  const key: InvoiceStatusKey | "overdue" =
    normalized === "issued" ? "pending" : (normalized as InvoiceStatusKey);

  // Overdue check applies to pending + partially-paid only.
  if ((key === "pending" || key === "partially-paid") && dueDate) {
    const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
    if (due < today) {
      return {
        props: { tone: "danger", appearance: "subtle", dot: true },
        key:   "overdue",
      };
    }
  }

  // Fall back to neutral if we get a key we don't recognize.
  const known: InvoiceStatusKey[] = [
    "draft", "pending", "partially-paid", "paid", "returned", "cancelled",
  ];
  const safeKey = known.includes(key as InvoiceStatusKey)
    ? (key as InvoiceStatusKey)
    : "draft";

  return { props: getInvoiceStatusBadge(safeKey), key: safeKey };
}

/* ----------------------------------------------------------------------------
 *  Unit statuses (per user decisions 2/3/4: spec colors win)
 * ------------------------------------------------------------------------- */

export type UnitStatusKey = "vacant" | "occupied" | "overstay" | "reserved" | "maintenance";

export function getUnitStatusBadge(status: UnitStatusKey): BadgeVariantProps {
  switch (status) {
    case "vacant":      return { tone: "success", appearance: "subtle", dot: true };
    case "occupied":    return { tone: "info",    appearance: "subtle", dot: true };
    case "overstay":    return { tone: "danger",  appearance: "solid",  dot: true };
    case "reserved":    return { tone: "warning", appearance: "subtle", dot: true };
    case "maintenance": return { tone: "neutral", appearance: "subtle", dot: true };
  }
}

/* ----------------------------------------------------------------------------
 *  Unit types — categorical, no dot.
 * ------------------------------------------------------------------------- */

export type UnitTypeKey = "STUDIO" | "ONE_BR" | "TWO_BR" | "THREE_BR" | "SUITE";

export function getUnitTypeBadge(type: UnitTypeKey): BadgeVariantProps {
  switch (type) {
    case "STUDIO":   return { tone: "neutral", appearance: "outline" };
    case "ONE_BR":   return { tone: "neutral", appearance: "outline" };
    case "TWO_BR":   return { tone: "neutral", appearance: "outline" };
    case "THREE_BR": return { tone: "neutral", appearance: "outline" };
    case "SUITE":    return { tone: "gold",    appearance: "subtle"  };
  }
}

/* ----------------------------------------------------------------------------
 *  Tenant classification (per user decision 9: always show "Regular")
 * ------------------------------------------------------------------------- */

export type TenantClassKey = "vip" | "regular" | "blacklisted";

export function getTenantClassBadge(value: TenantClassKey): BadgeVariantProps {
  switch (value) {
    case "vip":
      return {
        tone: "gold",
        appearance: "solid",
        icon: <StarIcon className="h-full w-full" />,
      };
    case "regular":
      return { tone: "neutral", appearance: "outline" };
    case "blacklisted":
      return {
        tone: "danger",
        appearance: "subtle",
        icon: <ShieldExclamationIcon className="h-full w-full" />,
      };
  }
}

/* ----------------------------------------------------------------------------
 *  Tenant types
 * ------------------------------------------------------------------------- */

export type TenantTypeKey = "individual" | "family" | "corporate" | "government";

export function getTenantTypeBadge(type: TenantTypeKey): BadgeVariantProps {
  switch (type) {
    case "individual": return { tone: "neutral", appearance: "subtle" };
    case "family":     return { tone: "accent",  appearance: "subtle" };
    case "corporate":  return { tone: "warning", appearance: "subtle" };
    case "government": return { tone: "info",    appearance: "subtle" };
  }
}

/* ----------------------------------------------------------------------------
 *  Payment methods (per user decision 7: add online + other)
 * ------------------------------------------------------------------------- */

export type PaymentMethodKey =
  | "CASH"
  | "CARD"
  | "BANK_TRANSFER"
  | "CHEQUE"
  | "ONLINE"
  | "OTHER";

export function getPaymentMethodBadge(
  method: PaymentMethodKey,
): BadgeVariantProps {
  switch (method) {
    case "CASH":          return { tone: "success", appearance: "subtle" };
    case "CARD":          return { tone: "info",    appearance: "subtle" };
    case "BANK_TRANSFER": return { tone: "accent",  appearance: "subtle" };
    case "CHEQUE":        return { tone: "warning", appearance: "subtle" };
    case "ONLINE":        return { tone: "info",    appearance: "subtle" };
    case "OTHER":         return { tone: "neutral", appearance: "subtle" };
  }
}

/* ----------------------------------------------------------------------------
 *  Expense statuses
 * ------------------------------------------------------------------------- */

export type ExpenseStatusKey = "PENDING" | "APPROVED" | "REJECTED" | "PROCESSED";

export function getExpenseStatusBadge(
  status: ExpenseStatusKey,
): BadgeVariantProps {
  switch (status) {
    case "PENDING":   return { tone: "warning", appearance: "subtle", dot: true };
    case "APPROVED":  return { tone: "info",    appearance: "subtle", dot: true };
    case "REJECTED":  return { tone: "danger",  appearance: "subtle", dot: true };
    case "PROCESSED": return { tone: "success", appearance: "subtle", dot: true };
  }
}

/* ----------------------------------------------------------------------------
 *  User roles — moved into the design system from lib/permissions.ts.
 *  OWNER kept on accent (violet) to preserve the existing purple tint.
 * ------------------------------------------------------------------------- */

export type UserRoleKey = "OWNER" | "MANAGER" | "STAFF" | "ACCOUNTANT";

export function getUserRoleBadge(role: UserRoleKey): BadgeVariantProps {
  switch (role) {
    case "OWNER":      return { tone: "accent",  appearance: "subtle" };
    case "MANAGER":    return { tone: "info",    appearance: "subtle" };
    case "STAFF":      return { tone: "success", appearance: "subtle" };
    case "ACCOUNTANT": return { tone: "warning", appearance: "subtle" };
  }
}

/* ----------------------------------------------------------------------------
 *  Property types (per user decision 8: add wrapper even though spec
 *  did not enumerate this domain)
 * ------------------------------------------------------------------------- */

export type PropertyTypeKey = "RESIDENTIAL" | "MIXED" | "HOTEL" | "COMMERCIAL";

export function getPropertyTypeBadge(
  type: PropertyTypeKey,
): BadgeVariantProps {
  switch (type) {
    case "RESIDENTIAL": return { tone: "info",    appearance: "subtle" };
    case "MIXED":       return { tone: "accent",  appearance: "subtle" };
    case "HOTEL":       return { tone: "warning", appearance: "subtle" };
    case "COMMERCIAL":  return { tone: "success", appearance: "subtle" };
  }
}
