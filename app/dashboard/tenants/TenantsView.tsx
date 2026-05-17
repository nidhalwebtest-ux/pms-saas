"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  ListBulletIcon,
  Squares2X2Icon,
  RectangleGroupIcon,
  DocumentArrowDownIcon,
  PrinterIcon,
  PencilSquareIcon,
  EyeIcon,
  BoltIcon,
  CheckIcon,
  XMarkIcon,
  UserGroupIcon,
  PhoneIcon,
  EnvelopeIcon,
  CalendarDaysIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";
import type { SortingState } from "@tanstack/react-table";
import { quickUpdateTenant } from "./actions";
import type { TenantRow } from "./page";
import { DataTable, NoTenantsFirstTime } from "@/components/ui";
import {
  Avatar,
  ClassBadge,
  TagPills,
  TypeBadge,
  buildTenantColumns,
  tenantRowVariant,
  useSourceLabel,
  useTypeLabel,
} from "./columns";

// ── Constants ──────────────────────────────────────────────────────────────────

const CLASS_BORDER: Record<string, string> = {
  vip:         "border-l-yellow-400",
  blacklisted: "border-l-red-400",
  regular:     "border-l-blue-200",
};

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
    t.tenantType ?? "",
    t.classification ?? "regular",
    t.source ?? "",
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

// ── Inline Edit Row ────────────────────────────────────────────────────────────

const CLASS_CYCLE = ["regular", "vip", "blacklisted"];

/**
 * Inline edit row — rendered via DataTable's `renderRow` override. Seven
 * cells map 1-to-1 onto the column order: avatar / name / contact / type /
 * source / stays / actions. Type and Stays stay display-only; Source visually
 * becomes the classification cycle button while editing.
 */
function EditableRow({
  tenant,
  onDone,
}: {
  tenant: TenantRow;
  onDone: () => void;
}) {
  const tRow = useTranslations("tenants.list.row");
  const tCls = useTranslations("tenants.classifications");
  const [firstName, setFirstName] = useState(tenant.firstName);
  const [lastName, setLastName] = useState(tenant.lastName);
  const [phone, setPhone] = useState(tenant.phone);
  const [classification, setClassification] = useState(
    tenant.classification ?? "regular",
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const cycleClass = () => {
    const idx = CLASS_CYCLE.indexOf(classification);
    setClassification(CLASS_CYCLE[(idx + 1) % CLASS_CYCLE.length]);
  };

  const save = () => {
    const fd = new FormData();
    fd.set("id", tenant.id);
    fd.set("firstName", firstName);
    fd.set("lastName", lastName);
    fd.set("phone", phone);
    fd.set("classification", classification);
    startTransition(async () => {
      const res = await quickUpdateTenant(fd);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(tRow("saved"));
      router.refresh();
      onDone();
    });
  };

  const inputCls =
    "w-full rounded-md border border-brand-400 bg-surface px-2 py-1 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-brand-500";
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") onDone();
  };

  return (
    <tr className="bg-brand-50/40">
      {/* Avatar — reflects pending classification color */}
      <td className="py-2.5 ps-4 pe-2">
        <Avatar t={{ ...tenant, classification }} />
      </td>
      {/* Name — first + last stacked */}
      <td className="px-3 py-2 min-w-[200px]">
        <div className="flex flex-col gap-1.5">
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            onKeyDown={onKey}
            placeholder={tRow("firstNamePlaceholder")}
            className={inputCls}
            autoFocus
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            onKeyDown={onKey}
            placeholder={tRow("lastNamePlaceholder")}
            className={inputCls}
          />
        </div>
      </td>
      {/* Contact — phone input */}
      <td className="px-3 py-2">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={onKey}
          className={inputCls}
        />
      </td>
      {/* Type — read-only display */}
      <td className="px-3 py-2">
        <TypeBadge value={tenant.tenantType} />
      </td>
      {/* Source slot → classification cycle */}
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={cycleClass}
          title={tRow("cycleClassTitle")}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
            classification === "vip"
              ? "bg-warning-50 text-warning-700 hover:bg-warning-100"
              : classification === "blacklisted"
              ? "bg-error-50 text-error-700 hover:bg-error-100"
              : "bg-subtle text-fg-tertiary hover:bg-border-subtle"
          }`}
        >
          {classification === "vip"
            ? tCls("vipBadge")
            : classification === "blacklisted"
            ? tCls("blacklistedBadge")
            : tCls("regular")}
        </button>
      </td>
      {/* Stays — read-only display */}
      <td className="px-3 py-2 text-center text-sm text-fg-tertiary ltr-numbers">
        {tenant.totalStays}
      </td>
      {/* Actions — save + cancel */}
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={save}
            disabled={isPending}
            aria-label={tRow("save")}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-60 transition-colors"
            title={tRow("save")}
          >
            <CheckIcon className="h-4 w-4" />
          </button>
          <button
            onClick={onDone}
            disabled={isPending}
            aria-label={tRow("cancel")}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-tertiary hover:bg-subtle hover:text-fg transition-colors"
            title={tRow("cancel")}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Compact Card ──────────────────────────────────────────────────────────────

function TenantCard({ tenant }: { tenant: TenantRow }) {
  const tCard = useTranslations("tenants.list.card");
  const sourceLabel = useSourceLabel();

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
            <p className="text-base font-bold text-gray-800 ltr-numbers">{tenant.totalStays}</p>
            <p className="text-gray-400">{tCard("stays")}</p>
          </div>
          <div>
            <p className={`text-base font-bold ltr-numbers ${tenant.activeReservations > 0 ? "text-green-600" : "text-gray-400"}`}>
              {tenant.activeReservations}
            </p>
            <p className="text-gray-400">{tCard("active")}</p>
          </div>
          <div>
            <p className="text-sm font-bold text-purple-700 ltr-numbers">{parseFloat(tenant.totalSpent).toFixed(0)}</p>
            <p className="text-gray-400">OMR</p>
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <PhoneIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <span className="ltr-numbers">{tenant.phone}</span>
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
            {tCard("via", { source: sourceLabel(tenant.source) })}
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex gap-2 pt-1">
          <Link
            href={`/dashboard/tenants/${tenant.id}`}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <EyeIcon className="h-3.5 w-3.5" /> {tCard("view")}
          </Link>
          <Link
            href={`/dashboard/tenants/${tenant.id}/edit`}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            <PencilSquareIcon className="h-3.5 w-3.5" /> {tCard("edit")}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Summary Card ──────────────────────────────────────────────────────────────

function TenantSummaryCard({ tenant }: { tenant: TenantRow }) {
  const tSummary = useTranslations("tenants.list.summary");
  const sourceLabel = useSourceLabel();
  const border = CLASS_BORDER[tenant.classification ?? "regular"] ?? CLASS_BORDER.regular;

  const stats = [
    { label: tSummary("totalStays"), value: tenant.totalStays,                    sub: tSummary("reservations"),          color: "text-blue-700",   iconCls: "bg-blue-50 text-blue-500",   Icon: CalendarDaysIcon },
    { label: tSummary("activeNow"),  value: tenant.activeReservations,             sub: tenant.activeReservations > 0 ? tSummary("currentlyStaying") : tSummary("noActiveRes"), color: tenant.activeReservations > 0 ? "text-green-700" : "text-gray-400", iconCls: "bg-green-50 text-green-500", Icon: UserGroupIcon },
    { label: tSummary("totalSpent"), value: `${parseFloat(tenant.totalSpent).toFixed(3)}`, sub: "OMR",          color: "text-purple-700", iconCls: "bg-purple-50 text-purple-500", Icon: BanknotesIcon },
  ];

  return (
    <Link
      href={`/dashboard/tenants/${tenant.id}`}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border-l-4 ${border}`}
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
            <p className={`text-lg font-bold leading-tight ltr-numbers ${color}`}>{value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5 font-medium uppercase tracking-wide">{label}</p>
            <p className="text-[10px] text-gray-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* Contact footer */}
      <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <PhoneIcon className="h-3.5 w-3.5 text-gray-400" />
          <span className="ltr-numbers">{tenant.phone}</span>
          {tenant.email && <span className="text-gray-300 mx-1">·</span>}
          {tenant.email && <span className="text-gray-400 truncate max-w-[140px]">{tenant.email}</span>}
        </div>
        <div className="text-xs text-gray-400">
          {tenant.source ? sourceLabel(tenant.source) : ""}
        </div>
      </div>
    </Link>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function TenantsView({
  tenants,
}: {
  tenants: TenantRow[];
}) {
  const tBar     = useTranslations("tenants.list.toolbar");
  const tTable   = useTranslations("tenants.list.table");
  const tRow     = useTranslations("tenants.list.row");
  const tList    = useTranslations("tenants.list");
  const router   = useRouter();
  const [viewMode,     setViewMode]     = useState<"table" | "card" | "summary">("table");
  const [sorting,      setSorting]      = useState<SortingState>([
    { id: "name", desc: false },
  ]);
  const [editMode,     setEditMode]     = useState(false);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);

  // For card / summary views we still want the same default sort, but they
  // are not driven by TanStack — derive a comparator from the sorting state.
  const sorted = useMemo(() => {
    const sort = sorting[0];
    if (!sort) return tenants;
    const dir = sort.desc ? -1 : 1;
    return [...tenants].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sort.id];
      const bv = (b as Record<string, unknown>)[sort.id];
      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * dir;
      }
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
    });
  }, [tenants, sorting]);

  const columns = useMemo(
    () => buildTenantColumns({ tTable, tRow }),
    [tTable, tRow],
  );

  const rowActions = useMemo(
    () => (r: TenantRow) => [
      {
        id: "view",
        label: tRow("viewProfile"),
        icon: <EyeIcon className="h-4 w-4" />,
        onClick: () => router.push(`/dashboard/tenants/${r.id}`),
      },
      {
        id: "quick-edit",
        label: tRow("quickEdit"),
        icon: <BoltIcon className="h-4 w-4" />,
        visible: editMode,
        onClick: () => setInlineEditId(r.id),
      },
      {
        id: "edit",
        label: tRow("edit"),
        icon: <PencilSquareIcon className="h-4 w-4" />,
        onClick: () => router.push(`/dashboard/tenants/${r.id}/edit`),
      },
    ],
    [tRow, editMode, router],
  );

  const viewTitles: Record<"table" | "card" | "summary", string> = {
    table:   tBar("tableViewTitle"),
    card:    tBar("cardViewTitle"),
    summary: tBar("summaryViewTitle"),
  };

  return (
    <div className="space-y-3">

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        {/* Left: quick actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => exportCSV(sorted)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-green-300 hover:bg-green-50 hover:text-green-700 transition-colors"
          >
            <DocumentArrowDownIcon className="h-3.5 w-3.5" /> {tBar("csv")}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            <PrinterIcon className="h-3.5 w-3.5" /> {tBar("print")}
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
                {editMode ? tBar("exitEdit") : tBar("inlineEdit")}
              </button>
            </>
          )}
        </div>

        {/* Right: count + view toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 hidden sm:block">
            {tBar("tenantsCount", { count: sorted.length })}
          </span>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {([["table", ListBulletIcon], ["card", Squares2X2Icon], ["summary", RectangleGroupIcon]] as const).map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => { setViewMode(mode as any); setInlineEditId(null); setEditMode(false); }}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === mode ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
                title={viewTitles[mode]}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Table view ──────────────────────────────────────────── */}
      {viewMode === "table" && (
        <>
          <DataTable<TenantRow>
            data={tenants}
            columns={columns}
            mode="client"
            sorting={{ state: sorting, onChange: setSorting }}
            rowActions={rowActions}
            rowVariant={tenantRowVariant}
            renderRow={({ row }) =>
              editMode && inlineEditId === row.id ? (
                <EditableRow tenant={row} onDone={() => setInlineEditId(null)} />
              ) : null
            }
            emptyState={
              <NoTenantsFirstTime
                onCreate={() => router.push("/dashboard/tenants/new")}
              />
            }
            aria-label={tTable("name")}
          />
          {tenants.length > 0 && (
            <p className="px-4 text-xs text-fg-tertiary">
              {tList("showing", { count: tenants.length })}
            </p>
          )}
        </>
      )}

      {/* ── Compact card view ───────────────────────────────────── */}
      {viewMode === "card" && (
        sorted.length === 0 ? (
          <div className="py-20 text-center">
            <UserGroupIcon className="mx-auto mb-3 h-12 w-12 text-gray-200" />
            <p className="text-sm text-gray-400">{tList("empty")}</p>
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
            <p className="text-sm text-gray-400">{tList("empty")}</p>
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
