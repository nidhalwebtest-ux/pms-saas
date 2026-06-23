"use client";

import Link from "next/link";
import { ExclamationCircleIcon } from "@heroicons/react/24/solid";
import { Badge, defineColumns } from "@/components/ui";
import { stageBadge, interestBadge, tierBadge, tierLabel } from "../_lib/crm-options";
import type { ProspectRow } from "./page";

type Translator = (key: string, values?: Record<string, string | number>) => string;

/** Is this follow-up date today or in the past? */
function isDue(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const today = new Date();
  return (
    new Date(d.getFullYear(), d.getMonth(), d.getDate()) <=
    new Date(today.getFullYear(), today.getMonth(), today.getDate())
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function prospectRowVariant(
  r: ProspectRow,
): "urgent" | "warning" | "inactive" | "pinned" | "default" {
  if (r.stage === "LOST") return "inactive";
  if (r.tier === 1) return "pinned";
  if (isDue(r.nextFollowupDate) && r.stage !== "ACTIVE" && r.stage !== "SIGNED") return "warning";
  return "default";
}

export function buildProspectColumns(t: Translator) {
  const c = defineColumns<ProspectRow>();

  return [
    /* ── Business + contact ──────────────────────────────────────── */
    c.custom<string>({
      id: "businessName",
      header: t("prospects.columns.business"),
      accessorFn: (r) => r.businessName.toLowerCase(),
      sortingFn: "alphanumeric",
      meta: { mobile: "title" },
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="min-w-0">
            <Link
              href={`/admin/prospects/${r.id}`}
              className="text-sm font-semibold text-fg transition-colors hover:text-brand-600"
            >
              {r.businessName}
            </Link>
            <div className="text-xs text-fg-tertiary">
              {r.contactPersonName
                ? `${r.contactPersonName} · ${t(`enums.contactRole.${r.roleOfContact}`)}`.replace(/ · $/, "")
                : "—"}
            </div>
          </div>
        );
      },
    }),

    /* ── Area ────────────────────────────────────────────────────── */
    c.custom<string>({
      id: "area",
      header: t("prospects.columns.area"),
      accessorFn: (r) => r.areaLabel,
      sortingFn: "alphanumeric",
      meta: { mobile: "detail", mobilePriority: 3, mobileLabel: t("prospects.columns.area") },
      cell: ({ row }) => {
        const r = row.original;
        return (
          <span className="inline-flex items-center gap-1.5 text-sm text-fg-secondary">
            {r.areaColor && (
              <span
                className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: r.areaColor }}
              />
            )}
            {r.areaLabel}
          </span>
        );
      },
    }),

    /* ── Tier (sortable by score total, highest first) ───────────── */
    c.custom<number>({
      id: "tier",
      header: t("prospects.columns.tier"),
      accessorFn: (r) => r.scoreTotal,
      meta: { align: "center", numeric: true, mobile: "status" },
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex items-center gap-1.5">
            <Badge {...tierBadge(r.tier)} size="sm">
              {tierLabel(r.tier)}
            </Badge>
            <span className="text-xs tabular-nums text-fg-tertiary" dir="ltr">
              {r.scoreTotal}
            </span>
          </div>
        );
      },
    }),

    /* ── Stage ───────────────────────────────────────────────────── */
    c.custom<string>({
      id: "stage",
      header: t("prospects.columns.stage"),
      accessorFn: (r) => r.stage,
      sortingFn: "alphanumeric",
      meta: { mobile: "detail", mobilePriority: 1, mobileLabel: t("prospects.columns.stage") },
      cell: ({ row }) => (
        <Badge {...stageBadge(row.original.stage)} size="sm">
          {t(`enums.stage.${row.original.stage}`)}
        </Badge>
      ),
    }),

    /* ── Interest ────────────────────────────────────────────────── */
    c.custom<string>({
      id: "interestLevel",
      header: t("prospects.columns.interest"),
      accessorFn: (r) => r.interestLevel,
      sortingFn: "alphanumeric",
      meta: { mobile: "detail", mobilePriority: 2, mobileLabel: t("prospects.columns.interest") },
      cell: ({ row }) =>
        row.original.interestLevel === "UNKNOWN" ? (
          <span className="text-xs text-fg-tertiary">—</span>
        ) : (
          <Badge {...interestBadge(row.original.interestLevel)} size="sm">
            {t(`enums.interest.${row.original.interestLevel}`)}
          </Badge>
        ),
    }),

    /* ── Estimated units ─────────────────────────────────────────── */
    c.custom<number>({
      id: "estimatedUnits",
      header: t("prospects.columns.units"),
      accessorFn: (r) => r.estimatedUnits ?? -1,
      meta: { align: "center", numeric: true, mobile: "detail", mobilePriority: 4, mobileLabel: t("prospects.columns.units") },
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-fg" dir="ltr">
          {row.original.estimatedUnits ?? "—"}
        </span>
      ),
    }),

    /* ── Next follow-up ──────────────────────────────────────────── */
    c.custom<number>({
      id: "nextFollowupDate",
      header: t("prospects.columns.nextFollowup"),
      accessorFn: (r) => (r.nextFollowupDate ? new Date(r.nextFollowupDate).getTime() : Number.MAX_SAFE_INTEGER),
      meta: { mobile: "detail", mobilePriority: 5, mobileLabel: t("prospects.columns.nextFollowup") },
      cell: ({ row }) => {
        const r = row.original;
        const due = isDue(r.nextFollowupDate);
        return (
          <span
            className={`inline-flex items-center gap-1 text-sm ${
              due ? "font-semibold text-error-600" : "text-fg-secondary"
            }`}
          >
            {due && <ExclamationCircleIcon className="h-4 w-4" />}
            {fmtDate(r.nextFollowupDate)}
          </span>
        );
      },
    }),
  ];
}
