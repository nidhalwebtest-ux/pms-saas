"use client";

import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  ArchiveBoxIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import {
  Badge,
  defineColumns,
  getPropertyTypeBadge,
  type PropertyTypeKey,
} from "@/components/ui";
import type { PropertyRow } from "./page";

/* ----------------------------------------------------------------------------
 *  Shared cell helpers (also used by the EmptyState fallback above and the
 *  PropertyCard / SummaryCard in PropertiesView).
 * ------------------------------------------------------------------------- */

export function Thumbnail({
  photos,
  name,
}: {
  photos: string[];
  name: string;
}) {
  if (photos[0]) {
    return (
      <div className="relative h-10 w-14 flex-shrink-0 overflow-hidden rounded-md ring-1 ring-border-default">
        <Image
          src={photos[0]}
          alt={name}
          fill
          className="object-cover"
          unoptimized
        />
      </div>
    );
  }
  return (
    <div className="flex h-10 w-14 flex-shrink-0 items-center justify-center rounded-md bg-subtle ring-1 ring-border-default">
      <BuildingOffice2Icon className="h-5 w-5 text-fg-tertiary" />
    </div>
  );
}

export function OccupancyBar({
  occupied,
  total,
  noUnitsLabel,
}: {
  occupied: number;
  total: number;
  noUnitsLabel: string;
}) {
  if (total === 0) {
    return <span className="text-xs text-fg-tertiary">{noUnitsLabel}</span>;
  }
  const pct = Math.round((occupied / total) * 100);
  const color =
    pct >= 90 ? "bg-error-500" : pct >= 60 ? "bg-warning-500" : "bg-success-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-subtle">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-fg-tertiary ltr-numbers">{pct}%</span>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 *  Row variant — archived → inactive, deactivated → warning, else default
 * ------------------------------------------------------------------------- */

export function propertyRowVariant(
  r: PropertyRow,
): "inactive" | "warning" | "default" {
  if (r.isArchived) return "inactive";
  if (!r.isActive) return "warning";
  return "default";
}

/* ----------------------------------------------------------------------------
 *  Column factory
 * ------------------------------------------------------------------------- */

type T = (key: string, params?: Record<string, string | number | Date>) => string;

export interface PropertyColumnsDeps {
  /** `useTranslations("buildings.table")` */
  tTable: T;
  /** `useTranslations("buildings.types")` */
  tT: T;
  /** `useTranslations("buildings.detail")` — used for the active / inactive / archived labels. */
  tDet: T;
}

export function buildPropertyColumns({ tTable, tT, tDet }: PropertyColumnsDeps) {
  const c = defineColumns<PropertyRow>();

  return [
    /* ── Thumbnail ─────────────────────────────────────────────────── */
    c.custom<string>({
      id: "thumbnail",
      header: "",
      accessorFn: (r) => r.name,
      enableSorting: false,
      size: 72,
      meta: { mobile: "hide" },
      cell: ({ row }) => (
        <Thumbnail photos={row.original.photos} name={row.original.name} />
      ),
    }),

    /* ── Name ──────────────────────────────────────────────────────── */
    c.custom<string>({
      id: "name",
      header: tTable("colName"),
      accessorFn: (r) => r.name.toLowerCase(),
      sortingFn: "alphanumeric",
      meta: { mobile: "title" },
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="min-w-0">
            <Link
              href={`/dashboard/properties/${p.id}`}
              className="text-sm font-semibold text-fg hover:text-brand-600 transition-colors line-clamp-1"
            >
              {p.name}
            </Link>
            {p.description && (
              <p className="mt-0.5 line-clamp-1 text-xs text-fg-tertiary">
                {p.description}
              </p>
            )}
          </div>
        );
      },
    }),

    /* ── Type ──────────────────────────────────────────────────────── */
    c.custom<string>({
      id: "type",
      header: tTable("colType"),
      accessorFn: (r) => r.type,
      sortingFn: "alphanumeric",
      meta: { mobile: "detail", mobilePriority: 1, mobileLabel: tTable("colType") },
      cell: ({ row }) => {
        let label = row.original.type;
        try { label = tT(row.original.type); } catch {}
        return (
          <Badge {...getPropertyTypeBadge(row.original.type as PropertyTypeKey)} size="sm">
            {label}
          </Badge>
        );
      },
    }),

    /* ── City ──────────────────────────────────────────────────────── */
    c.custom<string>({
      id: "city",
      header: tTable("colCity"),
      accessorFn: (r) => r.city,
      sortingFn: "alphanumeric",
      meta: { mobile: "detail", mobilePriority: 2, mobileLabel: tTable("colCity") },
      cell: ({ row }) => (
        <span className="text-sm text-fg-tertiary">
          {row.original.city}
          {row.original.governorate && row.original.governorate !== row.original.city && (
            <span className="text-fg-tertiary">, {row.original.governorate}</span>
          )}
        </span>
      ),
    }),

    /* ── Total Units ───────────────────────────────────────────────── */
    c.custom<number>({
      id: "totalUnits",
      header: tTable("colUnits"),
      accessorFn: (r) => r.totalUnits,
      sortingFn: (a, b) => a.original.totalUnits - b.original.totalUnits,
      meta: { align: "center", numeric: true, mobile: "detail", mobilePriority: 3, mobileLabel: tTable("colUnits") },
      cell: ({ row }) => (
        <span className="text-sm font-medium text-fg-secondary ltr-numbers tabular-nums">
          {row.original.totalUnits}
        </span>
      ),
    }),

    /* ── Occupied (with occupancy bar) ─────────────────────────────── */
    c.custom<number>({
      id: "occupiedUnits",
      header: tTable("colOccupied"),
      accessorFn: (r) => r.occupiedUnits,
      sortingFn: (a, b) => a.original.occupiedUnits - b.original.occupiedUnits,
      meta: { mobile: "detail", mobilePriority: 4, mobileLabel: tTable("colOccupied") },
      cell: ({ row }) => (
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-semibold text-success-600 ltr-numbers tabular-nums">
            {row.original.occupiedUnits}
          </span>
          <OccupancyBar
            occupied={row.original.occupiedUnits}
            total={row.original.totalUnits}
            noUnitsLabel={tTable("noUnits")}
          />
        </div>
      ),
    }),

    /* ── Vacant ────────────────────────────────────────────────────── */
    c.custom<number>({
      id: "vacantUnits",
      header: tTable("colVacant"),
      accessorFn: (r) => r.vacantUnits,
      sortingFn: (a, b) => a.original.vacantUnits - b.original.vacantUnits,
      meta: { align: "center", numeric: true, mobile: "detail", mobilePriority: 5, mobileLabel: tTable("colVacant") },
      cell: ({ row }) => (
        <span className="text-sm text-fg-tertiary ltr-numbers tabular-nums">
          {row.original.vacantUnits}
        </span>
      ),
    }),

    /* ── Status ────────────────────────────────────────────────────── */
    c.custom<string>({
      id: "isActive",
      header: tTable("colStatus"),
      accessorFn: (r) =>
        r.isArchived ? "archived" : r.isActive ? "active" : "inactive",
      sortingFn: "alphanumeric",
      meta: { mobile: "status" },
      cell: ({ row }) => {
        const p = row.original;
        if (p.isArchived) {
          return (
            <Badge tone="neutral" appearance="subtle" size="sm" icon={<ArchiveBoxIcon className="h-full w-full" />}>
              {tDet("archived")}
            </Badge>
          );
        }
        if (p.isActive) {
          return (
            <Badge tone="success" appearance="subtle" size="sm" icon={<CheckCircleIcon className="h-full w-full" />}>
              {tDet("active")}
            </Badge>
          );
        }
        return (
          <Badge tone="warning" appearance="subtle" size="sm" icon={<WrenchScrewdriverIcon className="h-full w-full" />}>
            {tDet("inactive")}
          </Badge>
        );
      },
    }),
  ];
}
