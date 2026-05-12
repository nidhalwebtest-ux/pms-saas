"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DocumentArrowDownIcon,
  PrinterIcon,
  PencilSquareIcon,
  EyeIcon,
  CheckIcon,
  XMarkIcon,
  HomeModernIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";
import { UNIT_STATUS_CONFIG } from "@/lib/unit-status";
import { quickUpdateUnit } from "./actions";
import type { UnitRow } from "./page";
import { Badge, getUnitTypeBadge, type UnitTypeKey } from "@/components/ui";

// ── Constants ─────────────────────────────────────────────────────────────────

// Kept for CSV export (English export only)
const TYPE_LABEL_EN: Record<string, string> = {
  STUDIO:   "Studio",
  ONE_BR:   "1 BR",
  TWO_BR:   "2 BR",
  THREE_BR: "3 BR",
  SUITE:    "Suite",
};

type SortKey = "name" | "unitType" | "floor" | "bedrooms" | "basePrice" | "displayStatus";
type SortDir = "asc" | "desc";

// ── Helpers ───────────────────────────────────────────────────────────────────

function sortUnits(items: UnitRow[], key: SortKey, dir: SortDir): UnitRow[] {
  return [...items].sort((a, b) => {
    let av: any = a[key];
    let bv: any = b[key];
    if (key === "basePrice") { av = parseFloat(av); bv = parseFloat(bv); }
    if (typeof av === "string") av = av.toLowerCase();
    if (typeof bv === "string") bv = bv.toLowerCase();
    if (av < bv) return dir === "asc" ? -1 :  1;
    if (av > bv) return dir === "asc" ?  1 : -1;
    return 0;
  });
}

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

// ── Sub-components ────────────────────────────────────────────────────────────

function UnitThumbnail({ photos, name }: { photos: string[]; name: string }) {
  if (photos[0]) {
    return (
      <div className="relative h-10 w-14 flex-shrink-0 overflow-hidden rounded-md ring-1 ring-gray-200">
        <Image src={photos[0]} alt={name} fill className="object-cover" unoptimized />
      </div>
    );
  }
  return (
    <div className="flex h-10 w-14 flex-shrink-0 items-center justify-center rounded-md bg-gray-100 ring-1 ring-gray-200">
      <HomeModernIcon className="h-5 w-5 text-gray-400" />
    </div>
  );
}

function SortTh({
  label, sortKey, currentKey, currentDir, onSort, className = "",
}: {
  label: string; sortKey: SortKey; currentKey: SortKey; currentDir: SortDir;
  onSort: (k: SortKey) => void; className?: string;
}) {
  const active = currentKey === sortKey;
  return (
    <th
      scope="col"
      onClick={() => onSort(sortKey)}
      className={`cursor-pointer select-none px-3 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-100 transition-colors group ${className}`}
    >
      <div className="flex items-center gap-1">
        {label}
        {active ? (
          currentDir === "asc"
            ? <ChevronUpIcon   className="h-3.5 w-3.5 text-blue-600 stroke-[2.5]" />
            : <ChevronDownIcon className="h-3.5 w-3.5 text-blue-600 stroke-[2.5]" />
        ) : (
          <ChevronUpDownIcon className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500" />
        )}
      </div>
    </th>
  );
}

// ── Inline Edit Row ───────────────────────────────────────────────────────────

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
  let statusLabel = cfg.label;
  try { statusLabel = tStatus(unit.displayStatus as never); } catch {}

  return (
    <tr className="bg-blue-50 ring-2 ring-inset ring-blue-300">
      {/* Photo */}
      <td className="py-2.5 ps-4 pe-2 sm:ps-5">
        <UnitThumbnail photos={unit.photos} name={unit.name} />
      </td>
      {/* Name (editable) */}
      <td className="px-3 py-2" colSpan={2}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") onDone(); }}
          className="w-full rounded-md border border-blue-400 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
      </td>
      {/* Type */}
      <td className="hidden px-3 py-2 md:table-cell">
        <Badge {...getUnitTypeBadge(unit.unitType as UnitTypeKey)} size="sm">
          {typeLabel}
        </Badge>
      </td>
      {/* Floor */}
      <td className="hidden px-3 py-2 text-sm text-gray-500 lg:table-cell ltr-numbers">
        {unit.floor > 0 ? t("floorShort", { n: unit.floor }) : t("groundShort")}
      </td>
      {/* Beds/Baths */}
      <td className="hidden px-3 py-2 text-sm text-gray-500 lg:table-cell ltr-numbers">
        {t("bedsBathsShort", { beds: unit.bedrooms, baths: unit.bathrooms })}
      </td>
      {/* Price */}
      <td className="hidden px-3 py-2 text-sm font-semibold text-gray-800 xl:table-cell whitespace-nowrap">
        <span className="ltr-numbers">{Number(unit.basePrice).toFixed(3)}</span>{" "}
        <span className="text-xs font-normal text-gray-400">OMR</span>
      </td>
      {/* Status */}
      <td className="px-3 py-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
          {statusLabel}
        </span>
      </td>
      {/* Actions */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={isPending}
            className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
          >
            <CheckIcon className="h-3.5 w-3.5" /> {t("actionSave")}
          </button>
          <button
            onClick={onDone}
            className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <XMarkIcon className="h-3.5 w-3.5" /> {t("actionCancel")}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Normal Row ────────────────────────────────────────────────────────────────

function UnitRow({ unit, onEdit }: { unit: UnitRow; onEdit: () => void }) {
  const cfg = UNIT_STATUS_CONFIG[unit.displayStatus];
  const t       = useTranslations("units.list");
  const tTypes  = useTranslations("units.types");
  const tStatus = useTranslations("units.displayStatus");

  let typeLabel = unit.unitType;
  try { typeLabel = tTypes(unit.unitType as never); } catch {}
  let statusLabel = cfg.label;
  try { statusLabel = tStatus(unit.displayStatus as never); } catch {}

  return (
    <tr className="group hover:bg-blue-50/40 transition-colors">
      {/* Photo */}
      <td className="py-2.5 ps-4 pe-2 sm:ps-5">
        <UnitThumbnail photos={unit.photos} name={unit.name} />
      </td>

      {/* Name */}
      <td className="px-3 py-2.5">
        <Link
          href={`/dashboard/units/${unit.id}`}
          className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors"
        >
          {unit.name}
        </Link>
        <div className="text-xs text-gray-400">
          {unit.property.name}
          {unit.description ? ` · ${unit.description.slice(0, 40)}${unit.description.length > 40 ? "…" : ""}` : ""}
        </div>
      </td>

      {/* Property (hidden on mobile — shown in name cell) */}
      <td className="hidden px-3 py-2.5 text-sm text-gray-500 sm:table-cell">
        <Link href={`/dashboard/properties/${unit.propertyId}`} className="hover:text-blue-600 transition-colors">
          {unit.property.name}
        </Link>
      </td>

      {/* Type */}
      <td className="hidden px-3 py-2.5 md:table-cell">
        <Badge {...getUnitTypeBadge(unit.unitType as UnitTypeKey)} size="sm">
          {typeLabel}
        </Badge>
      </td>

      {/* Floor */}
      <td className="hidden px-3 py-2.5 text-sm text-gray-500 lg:table-cell ltr-numbers">
        {unit.floor > 0 ? t("floorShort", { n: unit.floor }) : t("groundShort")}
      </td>

      {/* Beds/Baths */}
      <td className="hidden px-3 py-2.5 text-sm text-gray-500 lg:table-cell ltr-numbers">
        {t("bedsBathsShort", { beds: unit.bedrooms, baths: unit.bathrooms })}
        {unit.area ? <span className="ms-1 text-gray-400">{t("areaShort", { area: unit.area })}</span> : null}
      </td>

      {/* Base Price */}
      <td className="hidden px-3 py-2.5 text-sm font-semibold text-gray-800 xl:table-cell whitespace-nowrap">
        <span className="ltr-numbers">{Number(unit.basePrice).toFixed(3)}</span>{" "}
        <span className="text-xs font-normal text-gray-400">OMR</span>
      </td>

      {/* Status */}
      <td className="px-3 py-2.5">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
          {statusLabel}
        </span>
      </td>

      {/* Actions */}
      <td className="px-3 py-2.5 text-end">
        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
          <Link
            href={`/dashboard/units/${unit.id}`}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-blue-100 hover:text-blue-700 transition-colors"
            title={t("actionView")}
          >
            <EyeIcon className="h-4 w-4" />
          </Link>
          <button
            onClick={onEdit}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-blue-100 hover:text-blue-700 transition-colors"
            title={t("actionQuickEdit")}
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <Link
            href={`/dashboard/units/${unit.id}/edit`}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors"
            title={t("actionFullEdit")}
          >
            {t("actionFullEdit")}
          </Link>
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
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const t        = useTranslations("units.list");
  const tFilters = useTranslations("units.filters");

  const sorted = useMemo(() => sortUnits(units, sortKey, sortDir), [units, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const statusValue = (s: string) => {
    if (s === "vacant")      return tFilters("statusVacant");
    if (s === "occupied")    return tFilters("statusOccupied");
    if (s === "reserved")    return tFilters("statusReserved");
    if (s === "maintenance") return tFilters("statusMaintenance");
    return s;
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

      {/* ── Quick Actions toolbar ──────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/60 px-4 py-2">
        <span className="text-xs text-gray-500">
          {t("unitsCount", { count: sorted.length })}
          {statusFilter !== "all" && <> · {t("filteredBy", { value: statusValue(statusFilter) })}</>}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCSV(sorted)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors"
          >
            <DocumentArrowDownIcon className="h-3.5 w-3.5" />
            {t("csvExport")}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors"
          >
            <PrinterIcon className="h-3.5 w-3.5" />
            {t("print")}
          </button>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-3 ps-4 pe-2 sm:ps-5" />
              <SortTh label={t("colUnit")}     sortKey="name"          currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <th className="hidden px-3 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">{t("colProperty")}</th>
              <SortTh label={t("colType")}     sortKey="unitType"      currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} className="hidden md:table-cell" />
              <SortTh label={t("colFloor")}    sortKey="floor"         currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} className="hidden lg:table-cell" />
              <SortTh label={t("colBedsBaths")} sortKey="bedrooms"     currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} className="hidden lg:table-cell" />
              <SortTh label={t("colPrice")}    sortKey="basePrice"     currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} className="hidden xl:table-cell" />
              <SortTh label={t("colStatus")}   sortKey="displayStatus" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <th className="px-3 py-3 text-end text-xs font-semibold uppercase tracking-wide text-gray-500">{t("colActions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center text-sm text-gray-400">
                  <HomeModernIcon className="mx-auto mb-3 h-10 w-10 text-gray-200" />
                  {t("noMatch")}
                </td>
              </tr>
            ) : (
              sorted.map((unit) =>
                editingId === unit.id ? (
                  <EditableRow key={unit.id} unit={unit} onDone={() => setEditingId(null)} />
                ) : (
                  <UnitRow key={unit.id} unit={unit} onEdit={() => setEditingId(unit.id)} />
                )
              )
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {sorted.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-2.5 text-xs text-gray-500">
          {t("showingCount", { count: sorted.length })}
        </div>
      )}
    </div>
  );
}
