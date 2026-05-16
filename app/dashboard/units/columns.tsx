"use client";

import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { HomeModernIcon } from "@heroicons/react/24/outline";
import {
  Badge,
  defineColumns,
  getUnitTypeBadge,
  type UnitTypeKey,
} from "@/components/ui";
import { UNIT_STATUS_CONFIG } from "@/lib/unit-status";
import type { UnitRow } from "./page";

/* ----------------------------------------------------------------------------
 *  Shared cell helpers
 * ------------------------------------------------------------------------- */

export function UnitThumbnail({
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
      <HomeModernIcon className="h-5 w-5 text-fg-tertiary" />
    </div>
  );
}

/* ----------------------------------------------------------------------------
 *  Row variant — maintenance dims out so other statuses stand out
 * ------------------------------------------------------------------------- */

export function unitRowVariant(r: UnitRow): "inactive" | "default" {
  return r.displayStatus === "maintenance" ? "inactive" : "default";
}

/* ----------------------------------------------------------------------------
 *  Column factory
 * ------------------------------------------------------------------------- */

type T = (key: string, params?: Record<string, string | number | Date>) => string;

export interface UnitColumnsDeps {
  /** `useTranslations("units.list")` */
  t: T;
}

export function buildUnitColumns({ t }: UnitColumnsDeps) {
  const c = defineColumns<UnitRow>();

  return [
    /* ── Photo ─────────────────────────────────────────────────────── */
    c.custom<string>({
      id: "photo",
      header: "",
      accessorFn: (r) => r.name,
      enableSorting: false,
      size: 72,
      meta: { mobile: "hide" },
      cell: ({ row }) => (
        <UnitThumbnail photos={row.original.photos} name={row.original.name} />
      ),
    }),

    /* ── Name ──────────────────────────────────────────────────────── */
    c.custom<string>({
      id: "name",
      header: t("colUnit"),
      accessorFn: (r) => r.name.toLowerCase(),
      sortingFn: "alphanumeric",
      meta: { mobile: "title" },
      cell: ({ row }) => {
        const u = row.original;
        const desc = u.description
          ? ` · ${u.description.slice(0, 40)}${u.description.length > 40 ? "…" : ""}`
          : "";
        return (
          <div className="min-w-0">
            <Link
              href={`/dashboard/units/${u.id}`}
              className="text-sm font-semibold text-fg hover:text-brand-600 transition-colors truncate"
            >
              {u.name}
            </Link>
            <div className="text-xs text-fg-tertiary truncate">
              {u.property.name}
              {desc}
            </div>
          </div>
        );
      },
    }),

    /* ── Property ──────────────────────────────────────────────────── */
    c.custom<string>({
      id: "property",
      header: t("colProperty"),
      accessorFn: (r) => r.property.name.toLowerCase(),
      sortingFn: "alphanumeric",
      meta: { mobile: "detail", mobilePriority: 1, mobileLabel: t("colProperty") },
      cell: ({ row }) => (
        <Link
          href={`/dashboard/properties/${row.original.propertyId}`}
          className="text-sm text-fg-secondary hover:text-brand-600 transition-colors"
        >
          {row.original.property.name}
        </Link>
      ),
    }),

    /* ── Type ──────────────────────────────────────────────────────── */
    c.custom<string>({
      id: "unitType",
      header: t("colType"),
      accessorFn: (r) => r.unitType,
      sortingFn: "alphanumeric",
      meta: { mobile: "detail", mobilePriority: 2, mobileLabel: t("colType") },
      cell: ({ row }) => <TypeCell value={row.original.unitType} />,
    }),

    /* ── Floor ─────────────────────────────────────────────────────── */
    c.custom<number>({
      id: "floor",
      header: t("colFloor"),
      accessorFn: (r) => r.floor,
      sortingFn: (a, b) => a.original.floor - b.original.floor,
      meta: { mobile: "detail", mobilePriority: 3, mobileLabel: t("colFloor") },
      cell: ({ row }) => (
        <span className="text-sm text-fg-tertiary ltr-numbers whitespace-nowrap">
          {row.original.floor > 0
            ? t("floorShort", { n: row.original.floor })
            : t("groundShort")}
        </span>
      ),
    }),

    /* ── Beds / Baths ──────────────────────────────────────────────── */
    c.custom<number>({
      id: "bedrooms",
      header: t("colBedsBaths"),
      accessorFn: (r) => r.bedrooms,
      sortingFn: (a, b) => a.original.bedrooms - b.original.bedrooms,
      meta: { mobile: "detail", mobilePriority: 4, mobileLabel: t("colBedsBaths") },
      cell: ({ row }) => (
        <span className="text-sm text-fg-tertiary ltr-numbers whitespace-nowrap">
          {t("bedsBathsShort", {
            beds: row.original.bedrooms,
            baths: row.original.bathrooms,
          })}
          {row.original.area ? (
            <span className="ms-1 text-fg-tertiary">
              {t("areaShort", { area: row.original.area })}
            </span>
          ) : null}
        </span>
      ),
    }),

    /* ── Price ─────────────────────────────────────────────────────── */
    c.custom<number>({
      id: "basePrice",
      header: t("colPrice"),
      accessorFn: (r) => Number(r.basePrice),
      sortingFn: (a, b) => Number(a.original.basePrice) - Number(b.original.basePrice),
      meta: { align: "end", numeric: true, mobile: "detail", mobilePriority: 5, mobileLabel: t("colPrice") },
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-fg whitespace-nowrap">
          <span className="tabular-nums" dir="ltr">
            {Number(row.original.basePrice).toFixed(3)}
          </span>{" "}
          <span className="text-xs font-normal text-fg-tertiary">OMR</span>
        </span>
      ),
    }),

    /* ── Status ────────────────────────────────────────────────────── */
    c.custom<string>({
      id: "displayStatus",
      header: t("colStatus"),
      accessorFn: (r) => r.displayStatus,
      sortingFn: "alphanumeric",
      meta: { mobile: "status" },
      cell: ({ row }) => <StatusCell value={row.original.displayStatus} />,
    }),
  ];
}

/* ----------------------------------------------------------------------------
 *  Inline cell components that read translations at render time
 * ------------------------------------------------------------------------- */

function TypeCell({ value }: { value: string }) {
  const tTypes = useTranslations("units.types");
  let label = value;
  try { label = tTypes(value as never); } catch {}
  return (
    <Badge {...getUnitTypeBadge(value as UnitTypeKey)} size="sm">
      {label}
    </Badge>
  );
}

function StatusCell({ value }: { value: string }) {
  const tStatus = useTranslations("units.displayStatus");
  const cfg = UNIT_STATUS_CONFIG[value as keyof typeof UNIT_STATUS_CONFIG];
  let label = cfg?.label ?? value;
  try { label = tStatus(value as never); } catch {}
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${cfg?.badge ?? ""}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg?.dot ?? ""}`} />
      {label}
    </span>
  );
}
