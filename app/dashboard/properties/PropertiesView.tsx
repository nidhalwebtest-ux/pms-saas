"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Squares2X2Icon,
  ListBulletIcon,
  DocumentArrowDownIcon,
  PrinterIcon,
  PencilSquareIcon,
  CheckIcon,
  XMarkIcon,
  CheckCircleIcon,
  WrenchScrewdriverIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  BuildingOffice2Icon,
  MapPinIcon,
  PlusIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import { quickUpdateProperty } from "./actions";
import type { PropertyRow } from "./page";

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  RESIDENTIAL: { bg: "bg-blue-100",   text: "text-blue-700",   label: "Residential" },
  MIXED:       { bg: "bg-violet-100", text: "text-violet-700", label: "Mixed Use"   },
  HOTEL:       { bg: "bg-amber-100",  text: "text-amber-700",  label: "Short-term"  },
  COMMERCIAL:  { bg: "bg-green-100",  text: "text-green-700",  label: "Commercial"  },
};

type SortKey = "name" | "type" | "city" | "totalUnits" | "occupiedUnits" | "vacantUnits" | "isActive" | "createdAt";
type SortDir = "asc" | "desc";

// ── Helpers ──────────────────────────────────────────────────────────────────

function sortProperties(items: PropertyRow[], key: SortKey, dir: SortDir): PropertyRow[] {
  return [...items].sort((a, b) => {
    let av: any = a[key];
    let bv: any = b[key];
    if (typeof av === "string") av = av.toLowerCase();
    if (typeof bv === "string") bv = bv.toLowerCase();
    if (av < bv) return dir === "asc" ? -1 :  1;
    if (av > bv) return dir === "asc" ?  1 : -1;
    return 0;
  });
}

function exportCSV(rows: PropertyRow[]) {
  const headers = ["Name", "Type", "City", "Address", "Floors", "Total Units", "Occupied", "Vacant", "Status", "Created"];
  const lines = rows.map((p) => [
    `"${p.name.replace(/"/g, '""')}"`,
    TYPE_BADGE[p.type]?.label ?? p.type,
    p.city,
    p.address ?? "",
    p.totalFloors ?? "",
    p.totalUnits,
    p.occupiedUnits,
    p.vacantUnits,
    p.isActive ? "Active" : "Inactive",
    new Date(p.createdAt).toLocaleDateString(),
  ].join(","));
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `properties-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Thumbnail({ photos, name }: { photos: string[]; name: string }) {
  if (photos[0]) {
    return (
      <div className="relative h-10 w-14 flex-shrink-0 overflow-hidden rounded-md ring-1 ring-gray-200">
        <Image src={photos[0]} alt={name} fill className="object-cover" unoptimized />
      </div>
    );
  }
  return (
    <div className="flex h-10 w-14 flex-shrink-0 items-center justify-center rounded-md bg-gray-100 ring-1 ring-gray-200">
      <BuildingOffice2Icon className="h-5 w-5 text-gray-400" />
    </div>
  );
}

function OccupancyBar({ occupied, total }: { occupied: number; total: number }) {
  if (total === 0) return <span className="text-xs text-gray-400">No units</span>;
  const pct = Math.round((occupied / total) * 100);
  const color = pct >= 90 ? "bg-red-400" : pct >= 60 ? "bg-amber-400" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500">{pct}%</span>
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
      className={`cursor-pointer select-none px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-100 transition-colors group ${className}`}
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

// ── Inline Edit Row ──────────────────────────────────────────────────────────

function EditableRow({
  property,
  onDone,
}: {
  property: PropertyRow;
  onDone: () => void;
}) {
  const [name, setName]         = useState(property.name);
  const [isActive, setIsActive] = useState(property.isActive);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const save = () => {
    const fd = new FormData();
    fd.set("id", property.id);
    fd.set("name", name);
    fd.set("isActive", isActive ? "true" : "false");
    startTransition(async () => {
      const res = await quickUpdateProperty(fd);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Saved");
        router.refresh();
        onDone();
      }
    });
  };

  const typeMeta = TYPE_BADGE[property.type] ?? { bg: "bg-gray-100", text: "text-gray-600", label: property.type };

  return (
    <tr className="bg-blue-50 ring-2 ring-inset ring-blue-300">
      <td className="py-2.5 pl-4 pr-2 sm:pl-5">
        <Thumbnail photos={property.photos} name={property.name} />
      </td>
      <td className="px-3 py-2" colSpan={2}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-blue-400 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
      </td>
      <td className="px-3 py-2 hidden sm:table-cell">
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${typeMeta.bg} ${typeMeta.text}`}>
          {typeMeta.label}
        </span>
      </td>
      <td className="px-3 py-2 hidden md:table-cell text-sm text-gray-500">{property.city}</td>
      <td className="px-3 py-2 hidden lg:table-cell text-sm text-center">{property.totalUnits}</td>
      <td className="px-3 py-2 hidden lg:table-cell text-sm text-center text-green-600 font-medium">{property.occupiedUnits}</td>
      <td className="px-3 py-2 hidden lg:table-cell text-sm text-center text-gray-500">{property.vacantUnits}</td>
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={() => setIsActive((v) => !v)}
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
            isActive ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-amber-100 text-amber-700 hover:bg-amber-200"
          }`}
        >
          {isActive ? <CheckCircleIcon className="h-3.5 w-3.5" /> : <WrenchScrewdriverIcon className="h-3.5 w-3.5" />}
          {isActive ? "Active" : "Inactive"}
        </button>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={isPending}
            className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
          >
            <CheckIcon className="h-3.5 w-3.5" /> Save
          </button>
          <button
            onClick={onDone}
            className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <XMarkIcon className="h-3.5 w-3.5" /> Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

function PropertyCard({ property }: { property: PropertyRow }) {
  const typeMeta = TYPE_BADGE[property.type] ?? { bg: "bg-gray-100", text: "text-gray-600", label: property.type };
  const hasPhoto = property.photos.length > 0;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 group">
      {/* Cover */}
      <div className="relative h-36 w-full bg-gray-100">
        {hasPhoto ? (
          <Image src={property.photos[0]} alt={property.name} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BuildingOffice2Icon className="h-12 w-12 text-gray-300" />
          </div>
        )}
        {/* Type badge overlay */}
        <span className={`absolute top-2 left-2 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold shadow-sm ${typeMeta.bg} ${typeMeta.text}`}>
          {typeMeta.label}
        </span>
        {/* Status overlay */}
        <span className={`absolute top-2 right-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold shadow-sm ${
          property.isActive ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
        }`}>
          {property.isActive
            ? <><CheckCircleIcon className="h-3 w-3" /> Active</>
            : <><WrenchScrewdriverIcon className="h-3 w-3" /> Inactive</>}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900 leading-tight line-clamp-1 group-hover:text-blue-600 transition-colors">
            {property.name}
          </h3>
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
            <MapPinIcon className="h-3 w-3 flex-shrink-0" />
            {property.city}{property.governorate ? `, ${property.governorate}` : ""}
            {property.totalFloors ? ` · ${property.totalFloors}F` : ""}
          </div>
        </div>

        {/* Unit stats */}
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 px-3 py-2 text-center text-xs">
          <div>
            <p className="text-base font-bold text-gray-800">{property.totalUnits}</p>
            <p className="text-gray-400">Total</p>
          </div>
          <div>
            <p className="text-base font-bold text-green-600">{property.occupiedUnits}</p>
            <p className="text-gray-400">Occupied</p>
          </div>
          <div>
            <p className="text-base font-bold text-gray-500">{property.vacantUnits}</p>
            <p className="text-gray-400">Vacant</p>
          </div>
        </div>

        {/* Occupancy bar */}
        <OccupancyBar occupied={property.occupiedUnits} total={property.totalUnits} />

        {/* Actions */}
        <div className="mt-auto flex gap-2 pt-1">
          <Link
            href={`/dashboard/properties/${property.id}`}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            View
          </Link>
          <Link
            href={`/dashboard/properties/${property.id}/edit`}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            Edit
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function PropertiesView({
  properties,
  initialSort,
}: {
  properties: PropertyRow[];
  initialSort: string;
}) {
  // Derive initial sort from URL param
  const parseSort = (s: string): [SortKey, SortDir] => {
    if (s === "newest")    return ["createdAt", "desc"];
    if (s === "oldest")    return ["createdAt", "asc"];
    const [key, dir] = s.split("_");
    return [(key as SortKey) || "name", (dir as SortDir) || "asc"];
  };
  const [initKey, initDir] = parseSort(initialSort);

  const [viewMode,     setViewMode]     = useState<"table" | "card">("table");
  const [sortKey,      setSortKey]      = useState<SortKey>(initKey);
  const [sortDir,      setSortDir]      = useState<SortDir>(initDir);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [editMode,     setEditMode]     = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sorted = useMemo(
    () => sortProperties(properties, sortKey, sortDir),
    [properties, sortKey, sortDir],
  );

  const handlePrint = () => window.print();

  return (
    <div className="space-y-3">

      {/* ── Action / toolbar bar ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">

        {/* Left: Export actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => exportCSV(sorted)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-green-300 hover:bg-green-50 hover:text-green-700 transition-colors"
            title="Export to CSV"
          >
            <DocumentArrowDownIcon className="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            title="Print list"
          >
            <PrinterIcon className="h-3.5 w-3.5" />
            Print
          </button>
          <div className="mx-1 h-4 w-px bg-gray-200" />
          <button
            onClick={() => { setEditMode((v) => !v); setInlineEditId(null); }}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              editMode
                ? "border-blue-400 bg-blue-50 text-blue-700"
                : "border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            }`}
            title="Toggle inline editing"
          >
            <PencilSquareIcon className="h-3.5 w-3.5" />
            {editMode ? "Exit Edit" : "Inline Edit"}
          </button>
        </div>

        {/* Right: New property + view toggle */}
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/properties/new"
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            New Property
          </Link>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "table" ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
              title="Table view"
            >
              <ListBulletIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("card")}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "card" ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
              title="Card view"
            >
              <Squares2X2Icon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Table view ───────────────────────────────────────────── */}
      {viewMode === "table" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 print:text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 pl-4 pr-2 sm:pl-5 w-16" />
                  <SortTh label="Name"     sortKey="name"         currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="min-w-[160px]" />
                  <SortTh label="Type"     sortKey="type"         currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
                  <SortTh label="City"     sortKey="city"         currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                  <SortTh label="Units"    sortKey="totalUnits"   currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden lg:table-cell text-center" />
                  <SortTh label="Occupied" sortKey="occupiedUnits" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden lg:table-cell text-center" />
                  <SortTh label="Vacant"   sortKey="vacantUnits"  currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden lg:table-cell text-center" />
                  <SortTh label="Status"   sortKey="isActive"     currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 print:hidden">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-sm text-gray-400">
                      <BuildingOffice2Icon className="mx-auto mb-3 h-10 w-10 text-gray-200" />
                      No buildings match your filters.
                    </td>
                  </tr>
                ) : (
                  sorted.map((p) =>
                    editMode && inlineEditId === p.id ? (
                      <EditableRow key={p.id} property={p} onDone={() => setInlineEditId(null)} />
                    ) : (
                      <tr
                        key={p.id}
                        className="hover:bg-blue-50/50 transition-colors"
                      >
                        {/* Thumbnail */}
                        <td className="py-2.5 pl-4 pr-2 sm:pl-5">
                          <Thumbnail photos={p.photos} name={p.name} />
                        </td>

                        {/* Name */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/dashboard/properties/${p.id}`}
                              className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors line-clamp-1"
                            >
                              {p.name}
                            </Link>
                          </div>
                          {p.description && (
                            <p className="mt-0.5 line-clamp-1 text-xs text-gray-400">{p.description}</p>
                          )}
                        </td>

                        {/* Type */}
                        <td className="hidden sm:table-cell px-3 py-2.5">
                          {(() => {
                            const m = TYPE_BADGE[p.type] ?? { bg: "bg-gray-100", text: "text-gray-600", label: p.type };
                            return (
                              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${m.bg} ${m.text}`}>
                                {m.label}
                              </span>
                            );
                          })()}
                        </td>

                        {/* City */}
                        <td className="hidden md:table-cell px-3 py-2.5 text-sm text-gray-500">
                          {p.city}
                          {p.governorate && p.governorate !== p.city && (
                            <span className="text-gray-400">, {p.governorate}</span>
                          )}
                        </td>

                        {/* Units */}
                        <td className="hidden lg:table-cell px-3 py-2.5 text-sm text-center font-medium text-gray-700">
                          {p.totalUnits}
                        </td>

                        {/* Occupied */}
                        <td className="hidden lg:table-cell px-3 py-2.5">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-sm font-semibold text-green-600">{p.occupiedUnits}</span>
                            <OccupancyBar occupied={p.occupiedUnits} total={p.totalUnits} />
                          </div>
                        </td>

                        {/* Vacant */}
                        <td className="hidden lg:table-cell px-3 py-2.5 text-sm text-center text-gray-500">
                          {p.vacantUnits}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-2.5">
                          {p.isActive ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                              <CheckCircleIcon className="h-3 w-3" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                              <WrenchScrewdriverIcon className="h-3 w-3" /> Inactive
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2.5 text-right print:hidden">
                          <div className="flex items-center justify-end gap-1">
                            {editMode && (
                              <button
                                onClick={() => setInlineEditId(p.id)}
                                className="rounded-md p-1.5 text-gray-400 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                                title="Inline edit"
                              >
                                <PencilSquareIcon className="h-4 w-4" />
                              </button>
                            )}
                            <Link
                              href={`/dashboard/properties/${p.id}`}
                              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                              title="View details"
                            >
                              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {sorted.length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-2.5 text-xs text-gray-500">
              {sorted.length} building{sorted.length !== 1 ? "s" : ""} ·{" "}
              {sorted.reduce((s, p) => s + p.totalUnits, 0)} total units ·{" "}
              <span className="text-green-600 font-medium">{sorted.reduce((s, p) => s + p.occupiedUnits, 0)} occupied</span> ·{" "}
              {sorted.reduce((s, p) => s + p.vacantUnits, 0)} vacant
            </div>
          )}
        </div>
      )}

      {/* ── Card view ────────────────────────────────────────────── */}
      {viewMode === "card" && (
        <>
          {sorted.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm">
              <BuildingOffice2Icon className="mx-auto mb-3 h-10 w-10 text-gray-200" />
              <p className="text-sm text-gray-400">No buildings match your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sorted.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
              {/* New property card */}
              <Link
                href="/dashboard/properties/new"
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-white py-12 text-sm font-medium text-gray-400 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 transition-all"
              >
                <PlusIcon className="h-8 w-8" />
                Add Building
              </Link>
            </div>
          )}
        </>
      )}

      {/* ── Print-only table (hidden on screen) ──────────────────── */}
      <div className="hidden print:block">
        <h2 className="mb-4 text-lg font-bold">Properties List — {new Date().toLocaleDateString()}</h2>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-800">
              {["Name","Type","City","Address","Units","Occupied","Vacant","Status"].map((h) => (
                <th key={h} className="py-1 pr-3 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const m = TYPE_BADGE[p.type];
              return (
                <tr key={p.id} className="border-b border-gray-200">
                  <td className="py-1 pr-3 font-medium">{p.name}</td>
                  <td className="py-1 pr-3">{m?.label ?? p.type}</td>
                  <td className="py-1 pr-3">{p.city}</td>
                  <td className="py-1 pr-3">{p.address ?? "—"}</td>
                  <td className="py-1 pr-3 text-center">{p.totalUnits}</td>
                  <td className="py-1 pr-3 text-center">{p.occupiedUnits}</td>
                  <td className="py-1 pr-3 text-center">{p.vacantUnits}</td>
                  <td className="py-1 pr-3">{p.isActive ? "Active" : "Inactive"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
