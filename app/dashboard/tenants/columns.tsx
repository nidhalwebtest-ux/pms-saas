"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Badge,
  defineColumns,
  getTenantClassBadge,
  getTenantTypeBadge,
  type TenantClassKey,
  type TenantTypeKey,
} from "@/components/ui";
import type { TenantRow } from "./page";

/* ============================================================================
 *  Presentation helpers — shared between desktop columns, mobile cards,
 *  and the inline-edit row.
 * ========================================================================= */

const CLASS_AVATAR: Record<string, string> = {
  vip: "bg-warning-50 text-warning-700",
  blacklisted: "bg-error-50 text-error-700",
  regular: "bg-brand-50 text-brand-700",
};

export function Avatar({
  t,
  size = "sm",
}: {
  t: { firstName: string; lastName: string; classification: string | null };
  size?: "sm" | "lg";
}) {
  const cls = CLASS_AVATAR[t.classification ?? "regular"] ?? CLASS_AVATAR.regular;
  const dim = size === "lg" ? "h-14 w-14 text-lg" : "h-8 w-8 text-xs";
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center flex-shrink-0 font-bold ${cls}`}
    >
      {t.firstName[0]}
      {t.lastName[0]}
    </div>
  );
}

export function ClassBadge({ value }: { value: string | null }) {
  const tCls = useTranslations("tenants.classifications");
  const key = (value === "vip" || value === "blacklisted"
    ? value
    : "regular") as TenantClassKey;
  const labelKey =
    key === "vip"
      ? "vipBadge"
      : key === "blacklisted"
      ? "blacklistedBadge"
      : "regular";
  return (
    <Badge {...getTenantClassBadge(key)} size="sm">
      {tCls(labelKey)}
    </Badge>
  );
}

export function TypeBadge({ value }: { value: string | null }) {
  const typeLabel = useTypeLabel();
  if (!value) {
    return (
      <Badge tone="neutral" appearance="subtle" size="sm">
        {typeLabel(value)}
      </Badge>
    );
  }
  return (
    <Badge {...getTenantTypeBadge(value as TenantTypeKey)} size="sm">
      {typeLabel(value)}
    </Badge>
  );
}

export function TagPills({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.slice(0, 3).map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center rounded-full bg-subtle px-1.5 py-0.5 text-[10px] text-fg-tertiary"
        >
          {tag}
        </span>
      ))}
      {tags.length > 3 && (
        <span className="text-[10px] text-fg-tertiary">
          +{tags.length - 3}
        </span>
      )}
    </div>
  );
}

export function useTypeLabel() {
  const tTypes = useTranslations("tenants.types");
  return (v: string | null) => {
    if (!v) return "—";
    try {
      return tTypes(v as never);
    } catch {
      return v;
    }
  };
}

export function useSourceLabel() {
  const tSrc = useTranslations("tenants.sources");
  return (v: string | null) => {
    if (!v) return "—";
    try {
      return tSrc(v as never);
    } catch {
      return v;
    }
  };
}

/* ============================================================================
 *  Row variant
 * ========================================================================= */

export function tenantRowVariant(
  r: TenantRow,
): "urgent" | "warning" | "inactive" | "pinned" | "default" {
  if (r.classification === "blacklisted") return "urgent";
  if (r.classification === "vip") return "pinned";
  if (!r.isActive) return "inactive";
  return "default";
}

/* ============================================================================
 *  Column factory
 * ========================================================================= */

type T = (key: string, params?: Record<string, string | number | Date>) => string;

export interface TenantColumnsDeps {
  /** `useTranslations("tenants.list.table")` */
  tTable: T;
  /** `useTranslations("tenants.list.row")` */
  tRow: T;
}

export function buildTenantColumns({ tTable, tRow }: TenantColumnsDeps) {
  const c = defineColumns<TenantRow>();

  return [
    /* ── Avatar ────────────────────────────────────────────────────── */
    c.custom<string>({
      id: "avatar",
      header: "",
      accessorFn: (r) => `${r.firstName} ${r.lastName}`,
      enableSorting: false,
      size: 56,
      meta: { mobile: "hide" },
      cell: ({ row }) => <Avatar t={row.original} />,
    }),

    /* ── Name + nationality + tags ─────────────────────────────────── */
    c.custom<string>({
      id: "name",
      header: tTable("name"),
      accessorFn: (r) => `${r.firstName} ${r.lastName}`.toLowerCase(),
      sortingFn: "alphanumeric",
      meta: { mobile: "title" },
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="min-w-0">
            <Link
              href={`/dashboard/tenants/${r.id}`}
              className="text-sm font-semibold text-fg hover:text-brand-600 transition-colors truncate"
            >
              {r.firstName} {r.lastName}
            </Link>
            <div className="text-xs text-fg-tertiary">{r.nationality || "—"}</div>
            <TagPills tags={r.tags} />
          </div>
        );
      },
    }),

    /* ── Contact ───────────────────────────────────────────────────── */
    c.custom<string>({
      id: "contact",
      header: tTable("contact"),
      accessorFn: (r) => r.phone,
      enableSorting: false,
      meta: { mobile: "detail", mobilePriority: 1, mobileLabel: tTable("contact") },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="text-fg ltr-numbers truncate">{row.original.phone}</div>
          {row.original.email && (
            <div className="text-xs text-fg-tertiary truncate max-w-[180px]">
              {row.original.email}
            </div>
          )}
        </div>
      ),
    }),

    /* ── Type ──────────────────────────────────────────────────────── */
    c.custom<string | null>({
      id: "tenantType",
      header: tTable("type"),
      accessorFn: (r) => r.tenantType,
      sortingFn: "alphanumeric",
      meta: { mobile: "detail", mobilePriority: 2, mobileLabel: tTable("type") },
      cell: ({ row }) => <TypeBadge value={row.original.tenantType} />,
    }),

    /* ── Source ────────────────────────────────────────────────────── */
    c.custom<string | null>({
      id: "source",
      header: tTable("source"),
      accessorFn: (r) => r.source,
      sortingFn: "alphanumeric",
      meta: { mobile: "detail", mobilePriority: 3, mobileLabel: tTable("source") },
      cell: ({ row }) => {
        const sourceLabel = useSourceLabel();
        return (
          <span className="text-xs text-fg-tertiary">
            {sourceLabel(row.original.source)}
          </span>
        );
      },
    }),

    /* ── Stays ─────────────────────────────────────────────────────── */
    c.custom<number>({
      id: "totalStays",
      header: tTable("stays"),
      accessorFn: (r) => r.totalStays,
      meta: { align: "center", numeric: true, mobile: "detail", mobilePriority: 4, mobileLabel: tTable("stays") },
      cell: ({ getValue }) => (
        <span className="text-sm text-fg tabular-nums" dir="ltr">
          {getValue() as number}
        </span>
      ),
    }),
  ];
}
