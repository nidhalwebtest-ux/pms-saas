"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  Squares2X2Icon,
  ListBulletIcon,
  RectangleGroupIcon,
  DocumentArrowDownIcon,
  PrinterIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  WrenchScrewdriverIcon,
  ArchiveBoxIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  BuildingOffice2Icon,
  MapPinIcon,
  PlusIcon,
  EyeIcon,
  ArrowTopRightOnSquareIcon,
  BanknotesIcon,
  HomeIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import type { PropertyRow } from "./page";
import { Badge, getPropertyTypeBadge, type PropertyTypeKey } from "@/components/ui";

// ── Constants ────────────────────────────────────────────────────────────────

type SortKey = "name" | "type" | "city" | "totalUnits" | "occupiedUnits" | "vacantUnits" | "isActive" | "createdAt" | "revenueThisMonth";
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

function OccupancyBar({ occupied, total, noUnitsLabel }: { occupied: number; total: number; noUnitsLabel: string }) {
  if (total === 0) return <span className="text-xs text-gray-400">{noUnitsLabel}</span>;
  const pct = Math.round((occupied / total) * 100);
  const color = pct >= 90 ? "bg-red-400" : pct >= 60 ? "bg-amber-400" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 ltr-numbers">{pct}%</span>
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


// ── Card ─────────────────────────────────────────────────────────────────────

function PropertyCard({ property }: { property: PropertyRow }) {
  const tCard = useTranslations("buildings.card");
  const tDet = useTranslations("buildings.detail");
  const tTable = useTranslations("buildings.table");
  const tT = useTranslations("buildings.types");
  const typeLabel = (() => { try { return tT(property.type); } catch { return property.type; } })();
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
        <Badge
          {...getPropertyTypeBadge(property.type as PropertyTypeKey)}
          size="sm"
          className="absolute top-2 start-2 shadow-sm"
        >
          {typeLabel}
        </Badge>
        {/* Status overlay */}
        <span className={`absolute top-2 end-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold shadow-sm ${
          property.isArchived ? "bg-gray-200 text-gray-600"
          : property.isActive ? "bg-green-100 text-green-700"
          : "bg-amber-100 text-amber-700"
        }`}>
          {property.isArchived
            ? <><ArchiveBoxIcon className="h-3 w-3" /> {tDet("archived")}</>
            : property.isActive
            ? <><CheckCircleIcon className="h-3 w-3" /> {tDet("active")}</>
            : <><WrenchScrewdriverIcon className="h-3 w-3" /> {tDet("inactive")}</>}
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
            <span className="ltr-numbers">
              {property.city}{property.governorate ? `, ${property.governorate}` : ""}
              {property.totalFloors ? ` · ${property.totalFloors}F` : ""}
            </span>
          </div>
        </div>

        {/* Unit stats */}
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 px-3 py-2 text-center text-xs">
          <div>
            <p className="text-base font-bold text-gray-800 ltr-numbers">{property.totalUnits}</p>
            <p className="text-gray-400">{tCard("total")}</p>
          </div>
          <div>
            <p className="text-base font-bold text-green-600 ltr-numbers">{property.occupiedUnits}</p>
            <p className="text-gray-400">{tCard("occupied")}</p>
          </div>
          <div>
            <p className="text-base font-bold text-gray-500 ltr-numbers">{property.vacantUnits}</p>
            <p className="text-gray-400">{tCard("vacant")}</p>
          </div>
        </div>

        {/* Occupancy bar */}
        <OccupancyBar occupied={property.occupiedUnits} total={property.totalUnits} noUnitsLabel={tTable("noUnits")} />

        {/* Actions */}
        <div className="mt-auto flex gap-2 pt-1">
          <Link
            href={`/dashboard/properties/${property.id}`}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {tCard("view")}
          </Link>
          <Link
            href={`/dashboard/properties/${property.id}/edit`}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            {tCard("edit")}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ property }: { property: PropertyRow }) {
  const locale = useLocale();
  const tSum = useTranslations("buildings.summary");
  const tDet = useTranslations("buildings.detail");
  const tT = useTranslations("buildings.types");

  const typeLabel = (() => { try { return tT(property.type); } catch { return property.type; } })();
  const hasPhoto  = property.photos.length > 0;
  const pct       = property.totalUnits > 0
    ? Math.round((property.occupiedUnits / property.totalUnits) * 100) : 0;
  const barColor  = pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-amber-400" : "bg-emerald-500";

  const numFmt = locale === "ar" ? "ar-OM" : "en-OM";

  const stats = [
    {
      label: tSum("totalUnits"),
      value: property.totalUnits.toString(),
      sub: property.totalFloors ? tSum("floorsCount", { count: property.totalFloors }) : null,
      icon: HomeIcon,
      iconCls: "bg-blue-50 text-blue-500",
      valCls: "text-gray-900",
    },
    {
      label: tSum("occupied"),
      value: `${pct}%`,
      sub: tSum("occupiedSub", { occupied: property.occupiedUnits, total: property.totalUnits }),
      icon: CheckCircleIcon,
      iconCls: "bg-emerald-50 text-emerald-500",
      valCls: pct >= 90 ? "text-red-600" : pct >= 60 ? "text-amber-600" : "text-emerald-600",
    },
    {
      label: tSum("vacant"),
      value: property.vacantUnits.toString(),
      sub: property.totalUnits > 0 ? tSum("availableSub", { pct: 100 - pct }) : "—",
      icon: BuildingOffice2Icon,
      iconCls: "bg-gray-50 text-gray-400",
      valCls: "text-gray-700",
    },
    {
      label: tSum("revenueThisMonth"),
      value: property.revenueThisMonth > 0
        ? property.revenueThisMonth.toLocaleString(numFmt, { minimumFractionDigits: 3, maximumFractionDigits: 3 })
        : "—",
      sub: property.revenueThisMonth > 0 ? tSum("omr") : tSum("noPayments"),
      icon: BanknotesIcon,
      iconCls: "bg-violet-50 text-violet-500",
      valCls: "text-violet-700",
    },
  ];

  return (
    <Link
      href={`/dashboard/properties/${property.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Cover photo */}
      <div className="relative h-44 w-full flex-shrink-0 bg-gray-100">
        {hasPhoto ? (
          <Image src={property.photos[0]} alt={property.name} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <BuildingOffice2Icon className="h-16 w-16 text-gray-300" />
          </div>
        )}
        {/* Gradient overlay for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        {/* Type badge */}
        <Badge
          {...getPropertyTypeBadge(property.type as PropertyTypeKey)}
          size="md"
          className="absolute top-3 start-3 shadow"
        >
          {typeLabel}
        </Badge>
        {/* Status badge */}
        <span className={`absolute top-3 end-3 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold shadow ${
          property.isArchived ? "bg-gray-200 text-gray-700"
          : property.isActive  ? "bg-emerald-100 text-emerald-700"
          : "bg-amber-100 text-amber-700"
        }`}>
          {property.isArchived ? <><ArchiveBoxIcon className="h-3 w-3" />{tDet("archived")}</>
          : property.isActive  ? <><CheckCircleIcon className="h-3 w-3" />{tDet("active")}</>
          : <><WrenchScrewdriverIcon className="h-3 w-3" />{tDet("inactive")}</>}
        </span>
        {/* Name over photo */}
        <div className="absolute bottom-0 inset-x-0 px-4 pb-3">
          <h3 className="text-base font-bold text-white leading-tight drop-shadow line-clamp-1 group-hover:underline">
            {property.name}
          </h3>
          {(property.city || property.governorate) && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-white/80">
              <MapPinIcon className="h-3 w-3 flex-shrink-0" />
              {[property.city, property.governorate].filter(Boolean).join(", ")}
            </div>
          )}
        </div>
      </div>

      {/* Occupancy bar */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-500">{tSum("occupancyLabel")}</span>
          <span className={`text-xs font-bold ltr-numbers ${pct >= 90 ? "text-red-600" : pct >= 60 ? "text-amber-600" : "text-emerald-600"}`}>
            {pct}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${barColor} transition-all duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-px bg-gray-100 border-t border-gray-100 mt-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex items-start gap-2.5 bg-white px-4 py-3">
              <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${s.iconCls}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-bold leading-tight ${s.valCls} truncate ltr-numbers`}>{s.value}</p>
                <p className="text-[11px] text-gray-400 leading-tight mt-0.5 truncate">{s.label}</p>
                {s.sub && <p className="text-[10px] text-gray-300 mt-0.5 truncate ltr-numbers">{s.sub}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer CTA */}
      <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/60 px-4 py-2.5">
        <span className="text-xs text-gray-400">
          {property.description
            ? <span className="line-clamp-1">{property.description}</span>
            : <span>{tSum("viewAllDetails")}</span>}
        </span>
        <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 flex-shrink-0 text-gray-400 group-hover:text-blue-500 transition-colors rtl:-scale-x-100" />
      </div>
    </Link>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

function EmptyState({
  hasAnyBuildings,
  hasActiveFilters,
  clearHref,
}: {
  hasAnyBuildings: boolean;
  hasActiveFilters: boolean;
  clearHref: string;
}) {
  const t = useTranslations("buildings.empty");
  if (!hasAnyBuildings) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <BuildingOffice2Icon className="h-10 w-10 text-gray-200" />
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">{t("firstTitle")}</p>
          <p className="mt-1 text-xs text-gray-400">{t("firstBody")}</p>
        </div>
        <Link
          href="/dashboard/properties/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          {t("firstCta")}
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 py-12">
      <BuildingOffice2Icon className="h-10 w-10 text-gray-200" />
      <p className="text-sm text-gray-500">{t("noMatch")}</p>
      {hasActiveFilters && (
        <Link
          href={clearHref}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-blue-300 hover:text-blue-600 transition-colors"
        >
          <FunnelIcon className="h-3.5 w-3.5" />
          {t("clearFilters")}
        </Link>
      )}
    </div>
  );
}

export default function PropertiesView({
  properties,
  initialSort,
  totalUnfiltered,
}: {
  properties: PropertyRow[];
  initialSort: string;
  totalUnfiltered: number;
}) {
  const t       = useTranslations("buildings");
  const tTb     = useTranslations("buildings.toolbar");
  const tTable  = useTranslations("buildings.table");
  const tCard   = useTranslations("buildings.card");
  const tT      = useTranslations("buildings.types");
  const tDet    = useTranslations("buildings.detail");
  const tPrint  = useTranslations("buildings.print");
  const tCsv    = useTranslations("buildings.csv");
  const locale  = useLocale();

  // CSV export uses locale-aware translated headers
  const exportCSV = (rows: PropertyRow[]) => {
    const headers = [
      tCsv("name"), tCsv("type"), tCsv("city"), tCsv("address"),
      tCsv("floors"), tCsv("totalUnits"), tCsv("occupied"), tCsv("vacant"),
      tCsv("revenue"), tCsv("status"), tCsv("created"),
    ];
    const lines = rows.map((p) => {
      let typeLabel: string;
      try { typeLabel = tT(p.type); } catch { typeLabel = p.type; }
      const status = p.isArchived ? tDet("archived") : p.isActive ? tDet("active") : tDet("inactive");
      return [
        `"${p.name.replace(/"/g, '""')}"`,
        typeLabel,
        p.city,
        p.address ?? "",
        p.totalFloors ?? "",
        p.totalUnits,
        p.occupiedUnits,
        p.vacantUnits,
        p.revenueThisMonth.toFixed(3),
        status,
        new Date(p.createdAt).toLocaleDateString(locale === "ar" ? "ar-OM" : "en-GB"),
      ].join(",");
    });
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `properties-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Derive initial sort from URL param
  const parseSort = (s: string): [SortKey, SortDir] => {
    if (s === "newest")    return ["createdAt", "desc"];
    if (s === "oldest")    return ["createdAt", "asc"];
    const [key, dir] = s.split("_");
    return [(key as SortKey) || "name", (dir as SortDir) || "asc"];
  };
  const [initKey, initDir] = parseSort(initialSort);

  const [viewMode, setViewMode] = useState<"table" | "card" | "summary">("table");
  const [sortKey,  setSortKey]  = useState<SortKey>(initKey);
  const [sortDir,  setSortDir]  = useState<SortDir>(initDir);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sorted = useMemo(
    () => sortProperties(properties, sortKey, sortDir),
    [properties, sortKey, sortDir],
  );

  const handlePrint = () => window.print();

  const printDate = new Date().toLocaleDateString(locale === "ar" ? "ar-OM" : "en-GB");
  const noUnitsLabel = tTable("noUnits");

  // Distinguish "no buildings exist" vs "filters hide them" so the empty state
  // can show the right CTA.
  const searchParams   = useSearchParams();
  const pathname       = usePathname();
  const hasActiveFilters =
    !!searchParams.get("q") ||
    !!searchParams.get("type") ||
    (searchParams.get("status") ?? "active") !== "active";
  const clearFiltersHref = pathname; // strip all params

  return (
    <div className="space-y-3">

      {/* ── Action / toolbar bar ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">

        {/* Left: Export actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => exportCSV(sorted)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-green-300 hover:bg-green-50 hover:text-green-700 transition-colors"
            title={tTb("csvTitle")}
          >
            <DocumentArrowDownIcon className="h-3.5 w-3.5" />
            {tTb("csv")}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            title={tTb("printTitle")}
          >
            <PrinterIcon className="h-3.5 w-3.5" />
            {tTb("print")}
          </button>
        </div>

        {/* Right: New property + view toggle */}
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/properties/new"
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            {t("newProperty")}
          </Link>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "table" ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
              title={tTb("viewTable")}
            >
              <ListBulletIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("card")}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "card" ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
              title={tTb("viewCard")}
            >
              <Squares2X2Icon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("summary")}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "summary" ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
              title={tTb("viewSummary")}
            >
              <RectangleGroupIcon className="h-4 w-4" />
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
                  <th className="py-3 ps-4 pe-2 sm:ps-5 w-16" />
                  <SortTh label={tTable("colName")}     sortKey="name"          currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="min-w-[160px]" />
                  <SortTh label={tTable("colType")}     sortKey="type"          currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
                  <SortTh label={tTable("colCity")}     sortKey="city"          currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                  <SortTh label={tTable("colUnits")}    sortKey="totalUnits"    currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden lg:table-cell text-center" />
                  <SortTh label={tTable("colOccupied")} sortKey="occupiedUnits" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden lg:table-cell text-center" />
                  <SortTh label={tTable("colVacant")}   sortKey="vacantUnits"   currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden lg:table-cell text-center" />
                  <SortTh label={tTable("colStatus")}   sortKey="isActive"      currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <th className="px-3 py-3 text-end text-xs font-semibold uppercase tracking-wide text-gray-500 print:hidden">
                    {tTable("colActions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState
                        hasAnyBuildings={totalUnfiltered > 0}
                        hasActiveFilters={hasActiveFilters}
                        clearHref={clearFiltersHref}
                      />
                    </td>
                  </tr>
                ) : (
                  sorted.map((p) => (
                      <tr
                        key={p.id}
                        className="hover:bg-blue-50/50 transition-colors"
                      >
                        {/* Thumbnail */}
                        <td className="py-2.5 ps-4 pe-2 sm:ps-5">
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
                            let label: string;
                            try { label = tT(p.type); } catch { label = p.type; }
                            return (
                              <Badge {...getPropertyTypeBadge(p.type as PropertyTypeKey)} size="sm">
                                {label}
                              </Badge>
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
                        <td className="hidden lg:table-cell px-3 py-2.5 text-sm text-center font-medium text-gray-700 ltr-numbers">
                          {p.totalUnits}
                        </td>

                        {/* Occupied */}
                        <td className="hidden lg:table-cell px-3 py-2.5">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-sm font-semibold text-green-600 ltr-numbers">{p.occupiedUnits}</span>
                            <OccupancyBar occupied={p.occupiedUnits} total={p.totalUnits} noUnitsLabel={noUnitsLabel} />
                          </div>
                        </td>

                        {/* Vacant */}
                        <td className="hidden lg:table-cell px-3 py-2.5 text-sm text-center text-gray-500 ltr-numbers">
                          {p.vacantUnits}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-2.5">
                          {p.isArchived ? (
                            <Badge tone="neutral" appearance="subtle" size="sm" icon={<ArchiveBoxIcon className="h-full w-full" />}>
                              {tDet("archived")}
                            </Badge>
                          ) : p.isActive ? (
                            <Badge tone="success" appearance="subtle" size="sm" icon={<CheckCircleIcon className="h-full w-full" />}>
                              {tDet("active")}
                            </Badge>
                          ) : (
                            <Badge tone="warning" appearance="subtle" size="sm" icon={<WrenchScrewdriverIcon className="h-full w-full" />}>
                              {tDet("inactive")}
                            </Badge>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2.5 text-end print:hidden">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/dashboard/properties/${p.id}`}
                              className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                              title={tTable("actionViewDetails")}
                            >
                              <EyeIcon className="h-3.5 w-3.5" />
                            </Link>
                            <Link
                              href={`/dashboard/properties/${p.id}/edit`}
                              className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                              title={tTable("actionEdit")}
                            >
                              <PencilSquareIcon className="h-3.5 w-3.5" />
                              {tTable("actionEdit")}
                            </Link>
                          </div>
                        </td>
                      </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {sorted.length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-2.5 text-xs text-gray-500 ltr-numbers">
              {tTable("footerBuildings", { count: sorted.length })}
              {tTable("footerSeparator")}
              {tTable("footerTotalUnits", { count: sorted.reduce((s, p) => s + p.totalUnits, 0) })}
              {tTable("footerSeparator")}
              <span className="text-green-600 font-medium">
                {tTable("footerOccupied", { count: sorted.reduce((s, p) => s + p.occupiedUnits, 0) })}
              </span>
              {tTable("footerSeparator")}
              {tTable("footerVacant", { count: sorted.reduce((s, p) => s + p.vacantUnits, 0) })}
            </div>
          )}
        </div>
      )}

      {/* ── Card view ────────────────────────────────────────────── */}
      {viewMode === "card" && (
        <>
          {sorted.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <EmptyState
                hasAnyBuildings={totalUnfiltered > 0}
                hasActiveFilters={hasActiveFilters}
                clearHref={clearFiltersHref}
              />
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
                {tCard("addBuilding")}
              </Link>
            </div>
          )}
        </>
      )}

      {/* ── Summary view ─────────────────────────────────────────── */}
      {viewMode === "summary" && (
        <>
          {sorted.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <EmptyState
                hasAnyBuildings={totalUnfiltered > 0}
                hasActiveFilters={hasActiveFilters}
                clearHref={clearFiltersHref}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map((p) => (
                <SummaryCard key={p.id} property={p} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Print-only table (hidden on screen) ──────────────────── */}
      <div className="hidden print:block">
        <h2 className="mb-4 text-lg font-bold">{tPrint("title", { date: printDate })}</h2>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-800">
              {[
                tPrint("colName"), tPrint("colType"), tPrint("colCity"), tPrint("colAddress"),
                tPrint("colUnits"), tPrint("colOccupied"), tPrint("colVacant"), tPrint("colStatus"),
              ].map((h) => (
                <th key={h} className="py-1 pe-3 text-start font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              let typeLabel: string;
              try { typeLabel = tT(p.type); } catch { typeLabel = p.type; }
              return (
                <tr key={p.id} className="border-b border-gray-200">
                  <td className="py-1 pe-3 font-medium">{p.name}</td>
                  <td className="py-1 pe-3">{typeLabel}</td>
                  <td className="py-1 pe-3">{p.city}</td>
                  <td className="py-1 pe-3">{p.address ?? tPrint("dash")}</td>
                  <td className="py-1 pe-3 text-center ltr-numbers">{p.totalUnits}</td>
                  <td className="py-1 pe-3 text-center ltr-numbers">{p.occupiedUnits}</td>
                  <td className="py-1 pe-3 text-center ltr-numbers">{p.vacantUnits}</td>
                  <td className="py-1 pe-3">{p.isActive ? tDet("active") : tDet("inactive")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
