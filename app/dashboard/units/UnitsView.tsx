"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DocumentArrowDownIcon,
  PrinterIcon,
  PencilSquareIcon,
  EyeIcon,
  BoltIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";
import type { SortingState } from "@tanstack/react-table";
import { UNIT_STATUS_CONFIG } from "@/lib/unit-status";
import { quickUpdateUnit } from "./actions";
import type { UnitRow } from "./page";
import { DataTable, EmptyState, Badge, getUnitTypeBadge, type UnitTypeKey } from "@/components/ui";
import { SearchIllustration } from "@/components/ui/empty-state/illustrations";
import { useCan } from "@/components/PermissionsProvider";
import { UnitThumbnail, buildUnitColumns, unitRowVariant } from "./columns";

// ── Constants ─────────────────────────────────────────────────────────────────

// Kept for CSV export (English export only)
const TYPE_LABEL_EN: Record<string, string> = {
  STUDIO:   "Studio",
  ONE_BR:   "1 BR",
  TWO_BR:   "2 BR",
  THREE_BR: "3 BR",
  SUITE:    "Suite",
};

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCSV(rows: UnitRow[]) {
  const headers = [
    "Unit", "Property", "Type", "Floor", "Bedrooms", "Bathrooms",
    "Area (m²)", "Base Price (OMR)", "Status",
  ];
  const lines = rows.map((u) => [
    `"${u.name.replace(/"/g, '""')}"`,
    `"${u.property.name.replace(/"/g, '""')}"`,
    TYPE_LABEL_EN[u.unitType] ?? u.unitType,
    u.floor === 0 ? "Ground" : u.floor,
    u.bedrooms,
    u.bathrooms,
    u.area ?? "",
    Number(u.basePrice).toFixed(3),
    UNIT_STATUS_CONFIG[u.displayStatus]?.label ?? u.displayStatus,
  ].join(","));
  const csv  = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `units-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Inline Edit Row ───────────────────────────────────────────────────────────

/**
 * Rendered via DataTable's `renderRow` override when `editingId === unit.id`.
 * Nine cells map 1-to-1 onto the column order (photo, name, property, type,
 * floor, beds/baths, price, status, actions). Only the name is editable;
 * everything else stays display-only.
 */
function EditableRow({ unit, onDone }: { unit: UnitRow; onDone: () => void }) {
  const [name, setName] = useState(unit.name);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const t       = useTranslations("units.list");
  const tTypes  = useTranslations("units.types");
  const tStatus = useTranslations("units.displayStatus");

  const save = () => {
    const fd = new FormData();
    fd.set("id",   unit.id);
    fd.set("name", name);
    startTransition(async () => {
      const res = await quickUpdateUnit(fd);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(t("savedToast"));
        router.refresh();
        onDone();
      }
    });
  };

  const cfg = UNIT_STATUS_CONFIG[unit.displayStatus];
  let typeLabel = unit.unitType;
  try { typeLabel = tTypes(unit.unitType as never); } catch {}
  let statusLabel = cfg?.label ?? unit.displayStatus;
  try { statusLabel = tStatus(unit.displayStatus as never); } catch {}

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") onDone();
  };

  return (
    <tr className="bg-brand-50/40">
      {/* Photo */}
      <td className="py-2.5 ps-4 pe-2">
        <UnitThumbnail photos={unit.photos} name={unit.name} />
      </td>
      {/* Name (editable) */}
      <td className="px-3 py-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onKey}
          className="w-full rounded-md border border-brand-400 bg-surface px-2.5 py-1.5 text-sm font-medium text-fg focus:outline-none focus:ring-2 focus:ring-brand-500"
          autoFocus
        />
      </td>
      {/* Property */}
      <td className="px-3 py-2 text-sm text-fg-tertiary">
        <Link
          href={`/dashboard/properties/${unit.propertyId}`}
          className="hover:text-brand-600 transition-colors"
        >
          {unit.property.name}
        </Link>
      </td>
      {/* Type */}
      <td className="px-3 py-2">
        <Badge {...getUnitTypeBadge(unit.unitType as UnitTypeKey)} size="sm">
          {typeLabel}
        </Badge>
      </td>
      {/* Floor */}
      <td className="px-3 py-2 text-sm text-fg-tertiary ltr-numbers whitespace-nowrap">
        {unit.floor > 0 ? t("floorShort", { n: unit.floor }) : t("groundShort")}
      </td>
      {/* Beds/Baths */}
      <td className="px-3 py-2 text-sm text-fg-tertiary ltr-numbers whitespace-nowrap">
        {t("bedsBathsShort", { beds: unit.bedrooms, baths: unit.bathrooms })}
      </td>
      {/* Price */}
      <td className="px-3 py-2 text-end text-sm font-semibold text-fg whitespace-nowrap">
        <span className="ltr-numbers tabular-nums">{Number(unit.basePrice).toFixed(3)}</span>{" "}
        <span className="text-xs font-normal text-fg-tertiary">OMR</span>
      </td>
      {/* Status */}
      <td className="px-3 py-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${cfg?.badge ?? ""}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${cfg?.dot ?? ""}`} />
          {statusLabel}
        </span>
      </td>
      {/* Actions */}
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={save}
            disabled={isPending}
            aria-label={t("actionSave")}
            title={t("actionSave")}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-60 transition-colors"
          >
            <CheckIcon className="h-4 w-4" />
          </button>
          <button
            onClick={onDone}
            disabled={isPending}
            aria-label={t("actionCancel")}
            title={t("actionCancel")}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-tertiary hover:bg-subtle hover:text-fg transition-colors"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function UnitsView({
  units,
  statusFilter,
}: {
  units: UnitRow[];
  statusFilter: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const t        = useTranslations("units.list");
  const tFilters = useTranslations("units.filters");
  const router   = useRouter();
  const canEditUnit = useCan("units", "EDIT");

  const columns = useMemo(() => buildUnitColumns({ t }), [t]);

  const rowActions = useMemo(
    () => (u: UnitRow) => [
      {
        id: "view",
        label: t("actionView"),
        icon: <EyeIcon className="h-4 w-4" />,
        onClick: () => router.push(`/dashboard/units/${u.id}`),
      },
      {
        id: "quick-edit",
        label: t("actionQuickEdit"),
        icon: <BoltIcon className="h-4 w-4" />,
        visible: canEditUnit,
        onClick: () => setEditingId(u.id),
      },
      {
        id: "edit",
        label: t("actionFullEdit"),
        icon: <PencilSquareIcon className="h-4 w-4" />,
        visible: canEditUnit,
        onClick: () => router.push(`/dashboard/units/${u.id}/edit`),
      },
    ],
    [t, router, canEditUnit],
  );

  const statusValue = (s: string) => {
    if (s === "vacant")      return tFilters("statusVacant");
    if (s === "occupied")    return tFilters("statusOccupied");
    if (s === "reserved")    return tFilters("statusReserved");
    if (s === "maintenance") return tFilters("statusMaintenance");
    return s;
  };

  return (
    <div className="space-y-3">

      {/* ── Quick Actions toolbar ──────────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-subtle/40 px-4 py-2">
        <span className="text-xs text-fg-tertiary">
          {t("unitsCount", { count: units.length })}
          {statusFilter !== "all" && (
            <> · {t("filteredBy", { value: statusValue(statusFilter) })}</>
          )}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCSV(units)}
            className="flex items-center gap-1.5 rounded-lg border border-border-default bg-surface px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-subtle hover:text-fg transition-colors"
          >
            <DocumentArrowDownIcon className="h-3.5 w-3.5" />
            {t("csvExport")}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-border-default bg-surface px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-subtle hover:text-fg transition-colors"
          >
            <PrinterIcon className="h-3.5 w-3.5" />
            {t("print")}
          </button>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────── */}
      <DataTable<UnitRow>
        data={units}
        columns={columns}
        mode="client"
        sorting={{ state: sorting, onChange: setSorting }}
        rowActions={rowActions}
        rowVariant={unitRowVariant}
        renderRow={({ row }) =>
          editingId === row.id ? (
            <EditableRow unit={row} onDone={() => setEditingId(null)} />
          ) : null
        }
        hasActiveFilters={statusFilter !== "all"}
        emptyState={
          <EmptyState
            variant="exploratory"
            illustration={<SearchIllustration />}
            title={t("noMatch")}
          />
        }
        aria-label={t("colUnit")}
      />

      {/* Footer */}
      {units.length > 0 && (
        <p className="px-4 text-xs text-fg-tertiary">
          {t("showingCount", { count: units.length })}
        </p>
      )}
    </div>
  );
}
