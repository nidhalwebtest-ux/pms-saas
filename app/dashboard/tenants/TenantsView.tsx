"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ListBulletIcon,
  Squares2X2Icon,
  RectangleGroupIcon,
  DocumentArrowDownIcon,
  PrinterIcon,
  PencilSquareIcon,
  EyeIcon,
  CheckIcon,
  XMarkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
  StarIcon,
  ShieldExclamationIcon,
  UserGroupIcon,
  PhoneIcon,
  EnvelopeIcon,
  CalendarDaysIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";
import { quickUpdateTenant } from "./actions";
import type { TenantRow, TenantStats } from "./page";

// ── Constants ──────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  walk_in:          "Walk-In",
  phone:            "Phone",
  whatsapp:         "WhatsApp",
  website:          "Website",
  booking_com:      "Booking.com",
  airbnb:           "Airbnb",
  referral:         "Referral",
  returning_guest:  "Returning",
  corporate_contract: "Corporate",
  other:            "Other",
};

const TYPE_BADGE: Record<string, string> = {
  individual: "bg-blue-50 text-blue-700",
  family:     "bg-purple-50 text-purple-700",
  corporate:  "bg-orange-50 text-orange-700",
  government: "bg-teal-50 text-teal-700",
};

const TYPE_LABEL: Record<string, string> = {
  individual: "Individual",
  family:     "Family",
  corporate:  "Corporate",
  government: "Government",
};

const CLASS_CONFIG: Record<string, { bg: string; text: string; border: string; avatar: string; label: string }> = {
  vip:         { bg: "bg-yellow-50",  text: "text-yellow-800", border: "border-l-yellow-400", avatar: "bg-yellow-100 text-yellow-800", label: "⭐ VIP" },
  blacklisted: { bg: "bg-red-50",     text: "text-red-700",    border: "border-l-red-400",    avatar: "bg-red-100 text-red-700",       label: "🚫 Blacklisted" },
  regular:     { bg: "bg-gray-50",    text: "text-gray-600",   border: "border-l-blue-200",   avatar: "bg-blue-100 text-blue-700",     label: "Regular" },
};

type SortKey = "name" | "tenantType" | "classification" | "source" | "totalStays" | "totalSpent" | "createdAt" | "activeReservations";
type SortDir = "asc" | "desc";

// ── Helpers ────────────────────────────────────────────────────────────────────

function sortTenants(items: TenantRow[], key: SortKey, dir: SortDir): TenantRow[] {
  return [...items].sort((a, b) => {
    let av: any;
    let bv: any;
    if (key === "name") {
      av = `${a.firstName} ${a.lastName}`.toLowerCase();
      bv = `${b.firstName} ${b.lastName}`.toLowerCase();
    } else if (key === "totalSpent") {
      av = parseFloat(a.totalSpent);
      bv = parseFloat(b.totalSpent);
    } else {
      av = (a as any)[key];
      bv = (b as any)[key];
    }
    if (typeof av === "string") av = av.toLowerCase();
    if (typeof bv === "string") bv = bv.toLowerCase();
    if (av < bv) return dir === "asc" ? -1 :  1;
    if (av > bv) return dir === "asc" ?  1 : -1;
    return 0;
  });
}

function exportCSV(rows: TenantRow[]) {
  const headers = [
    "First Name", "Last Name", "Phone", "Email", "Nationality",
    "ID Type", "ID Number", "Type", "Classification", "Source",
    "Total Stays", "Total Spent (OMR)", "Active Reservations", "Active", "Added",
  ];
  const lines = rows.map((t) => [
    `"${t.firstName.replace(/"/g, '""')}"`,
    `"${t.lastName.replace(/"/g, '""')}"`,
    t.phone,
    t.email ?? "",
    t.nationality ?? "",
    t.idType ?? "",
    t.idNumber ?? "",
    TYPE_LABEL[t.tenantType ?? ""] ?? t.tenantType ?? "",
    t.classification ?? "regular",
    SOURCE_LABELS[t.source ?? ""] ?? t.source ?? "",
    t.totalStays,
    parseFloat(t.totalSpent).toFixed(3),
    t.activeReservations,
    t.isActive ? "Yes" : "No",
    new Date(t.createdAt).toLocaleDateString(),
  ].join(","));
  const csv  = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `tenants-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Avatar({ t, size = "sm" }: { t: TenantRow; size?: "sm" | "lg" }) {
  const cls  = CLASS_CONFIG[t.classification ?? "regular"]?.avatar ?? CLASS_CONFIG.regular.avatar;
  const dim  = size === "lg" ? "h-14 w-14 text-lg" : "h-8 w-8 text-xs";
  return (
    <div className={`${dim} rounded-full flex items-center justify-center flex-shrink-0 font-bold ${cls}`}>
      {t.firstName[0]}{t.lastName[0]}
    </div>
  );
}

function ClassBadge({ value }: { value: string | null }) {
  if (value === "vip")
    return <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">⭐ VIP</span>;
  if (value === "blacklisted")
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">🚫 Blacklisted</span>;
  return <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Regular</span>;
}

function TypeBadge({ value }: { value: string | null }) {
  const cls = TYPE_BADGE[value ?? ""] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {TYPE_LABEL[value ?? ""] ?? value ?? "—"}
    </span>
  );
}

function TagPills({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.slice(0, 3).map((tag) => (
        <span key={tag} className="inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{tag}</span>
      ))}
      {tags.length > 3 && <span className="text-[10px] text-gray-400">+{tags.length - 3}</span>}
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
      onClick={() => onSort(sortKey)}
      className={`cursor-pointer select-none px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-100 transition-colors group ${className}`}
    >
      <div className="flex items-center gap-1">
        {label}
        {active
          ? currentDir === "asc"
            ? <ChevronUpIcon   className="h-3.5 w-3.5 text-blue-600 stroke-[2.5]" />
            : <ChevronDownIcon className="h-3.5 w-3.5 text-blue-600 stroke-[2.5]" />
          : <ChevronUpDownIcon className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500" />}
      </div>
    </th>
  );
}

// ── Inline Edit Row ────────────────────────────────────────────────────────────

const CLASS_CYCLE = ["regular", "vip", "blacklisted"];

function EditableRow({ tenant, onDone }: { tenant: TenantRow; onDone: () => void }) {
  const [firstName,      setFirstName]      = useState(tenant.firstName);
  const [lastName,       setLastName]       = useState(tenant.lastName);
  const [phone,          setPhone]          = useState(tenant.phone);
  const [classification, setClassification] = useState(tenant.classification ?? "regular");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const cycleClass = () => {
    const idx = CLASS_CYCLE.indexOf(classification);
    setClassification(CLASS_CYCLE[(idx + 1) % CLASS_CYCLE.length]);
  };

  const save = () => {
    const fd = new FormData();
    fd.set("id",             tenant.id);
    fd.set("firstName",      firstName);
    fd.set("lastName",       lastName);
    fd.set("phone",          phone);
    fd.set("classification", classification);
    startTransition(async () => {
      const res = await quickUpdateTenant(fd);
      if (res?.error) { toast.error(res.error); return; }
      toast.success("Saved");
      router.refresh();
      onDone();
    });
  };

  return (
    <tr className="bg-blue-50 ring-2 ring-inset ring-blue-300">
      {/* Avatar */}
      <td className="py-2.5 pl-4 pr-2">
        <Avatar t={{ ...tenant, classification }} />
      </td>
      {/* First + Last name */}
      <td className="px-3 py-2" colSpan={2}>
        <div className="flex gap-1.5">
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") onDone(); }}
            placeholder="First name"
            className="w-1/2 rounded-md border border-blue-400 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") onDone(); }}
            placeholder="Last name"
            className="w-1/2 rounded-md border border-blue-400 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </td>
      {/* Phone */}
      <td className="hidden px-3 py-2 md:table-cell">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") onDone(); }}
          className="w-full rounded-md border border-blue-400 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </td>
      {/* Type */}
      <td className="hidden px-3 py-2 lg:table-cell">
        <TypeBadge value={tenant.tenantType} />
      </td>
      {/* Classification cycle */}
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={cycleClass}
          title="Click to cycle classification"
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
            classification === "vip"         ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
            : classification === "blacklisted" ? "bg-red-100 text-red-700 hover:bg-red-200"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {classification === "vip" ? "⭐ VIP" : classification === "blacklisted" ? "🚫 Blacklisted" : "Regular"}
        </button>
      </td>
      {/* Stays */}
      <td className="hidden px-3 py-2 text-sm text-center text-gray-700 xl:table-cell">{tenant.totalStays}</td>
      {/* Actions */}
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

// ── Normal Table Row ──────────────────────────────────────────────────────────

function TenantTableRow({ tenant, onEdit, editMode }: { tenant: TenantRow; onEdit: () => void; editMode: boolean }) {
  return (
    <tr className="group hover:bg-blue-50/40 transition-colors">
      {/* Avatar */}
      <td className="py-2.5 pl-4 pr-2">
        <Avatar t={tenant} />
      </td>

      {/* Name + nationality + tags */}
      <td className="px-3 py-2.5 min-w-[160px]">
        <Link href={`/dashboard/tenants/${tenant.id}`} className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors">
          {tenant.firstName} {tenant.lastName}
        </Link>
        <div className="text-xs text-gray-400">{tenant.nationality || "—"}</div>
        <TagPills tags={tenant.tags} />
      </td>

      {/* Contact */}
      <td className="hidden px-3 py-2.5 text-sm sm:table-cell">
        <div className="text-gray-800">{tenant.phone}</div>
        {tenant.email && <div className="text-xs text-gray-400 truncate max-w-[150px]">{tenant.email}</div>}
      </td>

      {/* Type */}
      <td className="hidden px-3 py-2.5 md:table-cell">
        <TypeBadge value={tenant.tenantType} />
      </td>

      {/* Classification */}
      <td className="px-3 py-2.5">
        <ClassBadge value={tenant.classification} />
      </td>

      {/* Source */}
      <td className="hidden px-3 py-2.5 text-xs text-gray-500 lg:table-cell">
        {SOURCE_LABELS[tenant.source ?? ""] ?? tenant.source ?? "—"}
      </td>

      {/* Stays */}
      <td className="hidden px-3 py-2.5 text-sm text-center text-gray-700 xl:table-cell">
        {tenant.totalStays}
      </td>

      {/* Actions */}
      <td className="px-3 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
          <Link
            href={`/dashboard/tenants/${tenant.id}`}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-blue-100 hover:text-blue-700 transition-colors"
            title="View profile"
          >
            <EyeIcon className="h-4 w-4" />
          </Link>
          {editMode && (
            <button
              onClick={onEdit}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-blue-100 hover:text-blue-700 transition-colors"
              title="Quick edit"
            >
              <PencilSquareIcon className="h-4 w-4" />
            </button>
          )}
          <Link
            href={`/dashboard/tenants/${tenant.id}/edit`}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors"
          >
            Edit
          </Link>
        </div>
      </td>
    </tr>
  );
}

// ── Compact Card ──────────────────────────────────────────────────────────────

function TenantCard({ tenant }: { tenant: TenantRow }) {
  const cls = CLASS_CONFIG[tenant.classification ?? "regular"] ?? CLASS_CONFIG.regular;

  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 group`}>
      {/* Color bar based on classification */}
      <div className={`h-1.5 w-full ${
        tenant.classification === "vip"         ? "bg-yellow-400"
        : tenant.classification === "blacklisted" ? "bg-red-400"
        : "bg-blue-400"
      }`} />

      <div className="p-4 flex flex-col gap-3">
        {/* Top: avatar + name + badges */}
        <div className="flex items-start gap-3">
          <Avatar t={tenant} size="lg" />
          <div className="min-w-0">
            <Link href={`/dashboard/tenants/${tenant.id}`} className="text-sm font-bold text-gray-900 hover:text-blue-600 transition-colors leading-tight line-clamp-1 group-hover:text-blue-600">
              {tenant.firstName} {tenant.lastName}
            </Link>
            <div className="mt-1 flex flex-wrap gap-1">
              <ClassBadge value={tenant.classification} />
              <TypeBadge value={tenant.tenantType} />
            </div>
            {tenant.nationality && (
              <div className="text-xs text-gray-400 mt-0.5">{tenant.nationality}</div>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 px-3 py-2 text-center text-xs">
          <div>
            <p className="text-base font-bold text-gray-800">{tenant.totalStays}</p>
            <p className="text-gray-400">Stays</p>
          </div>
          <div>
            <p className={`text-base font-bold ${tenant.activeReservations > 0 ? "text-green-600" : "text-gray-400"}`}>
              {tenant.activeReservations}
            </p>
            <p className="text-gray-400">Active</p>
          </div>
          <div>
            <p className="text-sm font-bold text-purple-700">{parseFloat(tenant.totalSpent).toFixed(0)}</p>
            <p className="text-gray-400">OMR</p>
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <PhoneIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            {tenant.phone}
          </div>
          {tenant.email && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 truncate">
              <EnvelopeIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
              <span className="truncate">{tenant.email}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        <TagPills tags={tenant.tags} />

        {/* Source */}
        {tenant.source && (
          <div className="text-[10px] text-gray-400 uppercase tracking-wide">
            via {SOURCE_LABELS[tenant.source] ?? tenant.source}
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex gap-2 pt-1">
          <Link
            href={`/dashboard/tenants/${tenant.id}`}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <EyeIcon className="h-3.5 w-3.5" /> View
          </Link>
          <Link
            href={`/dashboard/tenants/${tenant.id}/edit`}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            <PencilSquareIcon className="h-3.5 w-3.5" /> Edit
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Summary Card ──────────────────────────────────────────────────────────────

function TenantSummaryCard({ tenant }: { tenant: TenantRow }) {
  const cls = CLASS_CONFIG[tenant.classification ?? "regular"] ?? CLASS_CONFIG.regular;

  const stats = [
    { label: "Total Stays",    value: tenant.totalStays,                    sub: "reservations",          color: "text-blue-700",   iconCls: "bg-blue-50 text-blue-500",   Icon: CalendarDaysIcon },
    { label: "Active Now",     value: tenant.activeReservations,             sub: tenant.activeReservations > 0 ? "currently staying" : "no active res.", color: tenant.activeReservations > 0 ? "text-green-700" : "text-gray-400", iconCls: "bg-green-50 text-green-500", Icon: UserGroupIcon },
    { label: "Total Spent",    value: `${parseFloat(tenant.totalSpent).toFixed(3)}`, sub: "OMR",          color: "text-purple-700", iconCls: "bg-purple-50 text-purple-500", Icon: BanknotesIcon },
  ];

  return (
    <Link
      href={`/dashboard/tenants/${tenant.id}`}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border-l-4 ${cls.border}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3 border-b border-gray-100">
        <Avatar t={tenant} size="lg" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-gray-900 leading-tight group-hover:text-blue-600 transition-colors line-clamp-1">
              {tenant.firstName} {tenant.lastName}
            </h3>
            <ClassBadge value={tenant.classification} />
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <TypeBadge value={tenant.tenantType} />
            {tenant.nationality && (
              <span className="text-xs text-gray-400">{tenant.nationality}</span>
            )}
          </div>
          {tenant.tags.length > 0 && <TagPills tags={tenant.tags} />}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 px-0">
        {stats.map(({ label, value, sub, color, iconCls, Icon }) => (
          <div key={label} className="flex flex-col items-center py-4 px-3 text-center">
            <div className={`mb-1.5 rounded-lg p-1.5 ${iconCls}`}>
              <Icon className="h-4 w-4" />
            </div>
            <p className={`text-lg font-bold leading-tight ${color}`}>{value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5 font-medium uppercase tracking-wide">{label}</p>
            <p className="text-[10px] text-gray-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* Contact footer */}
      <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <PhoneIcon className="h-3.5 w-3.5 text-gray-400" />
          {tenant.phone}
          {tenant.email && <span className="text-gray-300 mx-1">·</span>}
          {tenant.email && <span className="text-gray-400 truncate max-w-[140px]">{tenant.email}</span>}
        </div>
        <div className="text-xs text-gray-400">
          {SOURCE_LABELS[tenant.source ?? ""] ?? tenant.source ?? ""}
        </div>
      </div>
    </Link>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function TenantsView({
  tenants,
  stats,
}: {
  tenants: TenantRow[];
  stats: TenantStats;
}) {
  const [viewMode,     setViewMode]     = useState<"table" | "card" | "summary">("table");
  const [sortKey,      setSortKey]      = useState<SortKey>("createdAt");
  const [sortDir,      setSortDir]      = useState<SortDir>("desc");
  const [editMode,     setEditMode]     = useState(false);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sorted = useMemo(() => sortTenants(tenants, sortKey, sortDir), [tenants, sortKey, sortDir]);

  return (
    <div className="space-y-3">

      {/* ── Stats bar ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Tenants", value: stats.total,       color: "border-l-blue-400",   val: "text-blue-700" },
          { label: "VIP Guests",    value: stats.vip,         color: "border-l-yellow-400", val: "text-yellow-700" },
          { label: "Blacklisted",   value: stats.blacklisted, color: "border-l-red-400",    val: "text-red-600" },
          { label: "Active",        value: stats.active,      color: "border-l-green-400",  val: "text-green-700" },
        ].map(({ label, value, color, val }) => (
          <div key={label} className={`bg-white rounded-xl border border-gray-200 border-l-4 ${color} px-4 py-3 shadow-sm`}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${val}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        {/* Left: quick actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => exportCSV(sorted)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-green-300 hover:bg-green-50 hover:text-green-700 transition-colors"
          >
            <DocumentArrowDownIcon className="h-3.5 w-3.5" /> CSV
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            <PrinterIcon className="h-3.5 w-3.5" /> Print
          </button>
          {viewMode === "table" && (
            <>
              <div className="h-4 w-px bg-gray-200" />
              <button
                onClick={() => { setEditMode((v) => !v); setInlineEditId(null); }}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  editMode
                    ? "border-blue-400 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                <PencilSquareIcon className="h-3.5 w-3.5" />
                {editMode ? "Exit Edit" : "Inline Edit"}
              </button>
            </>
          )}
        </div>

        {/* Right: count + view toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 hidden sm:block">
            {sorted.length} tenant{sorted.length !== 1 ? "s" : ""}
          </span>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {([["table", ListBulletIcon], ["card", Squares2X2Icon], ["summary", RectangleGroupIcon]] as const).map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => { setViewMode(mode as any); setInlineEditId(null); setEditMode(false); }}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === mode ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
                title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} view`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Table view ──────────────────────────────────────────── */}
      {viewMode === "table" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 print:text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 pl-4 pr-2 w-12" />
                  <SortTh label="Name"   sortKey="name"           currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="min-w-[160px]" />
                  <th className="hidden px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">Contact</th>
                  <SortTh label="Type"   sortKey="tenantType"     currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                  <SortTh label="Class"  sortKey="classification" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortTh label="Source" sortKey="source"         currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden lg:table-cell" />
                  <SortTh label="Stays"  sortKey="totalStays"     currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden xl:table-cell text-center" />
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <UserGroupIcon className="mx-auto mb-3 h-10 w-10 text-gray-200" />
                      <p className="text-sm text-gray-400">No tenants match your filters.</p>
                    </td>
                  </tr>
                ) : (
                  sorted.map((tenant) =>
                    editMode && inlineEditId === tenant.id ? (
                      <EditableRow key={tenant.id} tenant={tenant} onDone={() => setInlineEditId(null)} />
                    ) : (
                      <TenantTableRow
                        key={tenant.id}
                        tenant={tenant}
                        editMode={editMode}
                        onEdit={() => setInlineEditId(tenant.id)}
                      />
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
          {sorted.length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-2.5 text-xs text-gray-500">
              Showing {sorted.length} tenant{sorted.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {/* ── Compact card view ───────────────────────────────────── */}
      {viewMode === "card" && (
        sorted.length === 0 ? (
          <div className="py-20 text-center">
            <UserGroupIcon className="mx-auto mb-3 h-12 w-12 text-gray-200" />
            <p className="text-sm text-gray-400">No tenants match your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sorted.map((tenant) => <TenantCard key={tenant.id} tenant={tenant} />)}
          </div>
        )
      )}

      {/* ── Summary card view ────────────────────────────────────── */}
      {viewMode === "summary" && (
        sorted.length === 0 ? (
          <div className="py-20 text-center">
            <UserGroupIcon className="mx-auto mb-3 h-12 w-12 text-gray-200" />
            <p className="text-sm text-gray-400">No tenants match your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {sorted.map((tenant) => <TenantSummaryCard key={tenant.id} tenant={tenant} />)}
          </div>
        )
      )}
    </div>
  );
}
