"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BuildingOfficeIcon,
  ArrowLeftIcon,
  UsersIcon,
  BuildingOffice2Icon,
  HomeModernIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  BanknotesIcon,
  ReceiptPercentIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  CheckCircleIcon,
  GlobeAltIcon,
  PhoneIcon,
  MapPinIcon,
  SparklesIcon,
  ShieldCheckIcon,
  CreditCardIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/Badge";
import {
  getUserRoleBadge,
  getPropertyTypeBadge,
  getUnitStatusBadge,
  getTenantClassBadge,
  getTenantTypeBadge,
  getReservationStatusBadge,
  getPaymentMethodBadge,
  reservationStatusKeyFromDisplayLabel,
  UnitStatusKey,
  TenantClassKey,
  TenantTypeKey,
  PaymentMethodKey,
  UserRoleKey,
  PropertyTypeKey,
} from "@/components/ui/badge-helpers";
import { formatCurrency } from "@/lib/format-currency";
import { fmtDate, fmtDateTime } from "../../_lib/format";

export type OrgUserDTO = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  role: string;
  assignedRoleName: string | null;
  createdAt: string;
};

export type OrgPropertyDTO = {
  id: string;
  name: string;
  type: string;
  address: string | null;
  city: string;
  totalFloors: number | null;
  isActive: boolean;
  unitsCount: number;
  createdAt: string;
};

export type OrgUnitDTO = {
  id: string;
  name: string;
  unitType: string;
  floor: number;
  bedrooms: number;
  bathrooms: number;
  basePrice: number;
  status: string;
  isActive: boolean;
  propertyName: string;
};

export type OrgTenantDTO = {
  id: string;
  name: string;
  fullNameArabic: string | null;
  phone: string;
  email: string | null;
  nationality: string | null;
  classification: string;
  tenantType: string;
  totalStays: number;
  totalSpent: number;
  isActive: boolean;
  createdAt: string;
};

export type OrgReservationDTO = {
  id: string;
  reservationNumber: string | null;
  tenantName: string;
  unitName: string | null;
  startDate: string;
  endDate: string;
  status: string;
  rateType: string;
  totalNights: number;
  grandTotal: number;
  amountPaid: number;
  createdAt: string;
};

export type OrgPaymentDTO = {
  id: string;
  paymentNumber: string | null;
  tenantName: string;
  amount: number;
  date: string;
  method: string;
  reference: string | null;
  notes: string | null;
};

export type OrganizationDetailData = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string;
  area: string | null;
  currency: string;
  timezone: string;
  pdfBrandColor: string;
  plan: string;
  subscriptionStatus: string;
  maxProperties: number;
  checkInPolicy: string;
  autoCheckout: boolean;
  showReservedStatus: boolean;
  dailyInvoiceTiming: string;
  monthlyInvoiceTiming: string;
  createdAt: string;
  metrics: {
    users: number;
    properties: number;
    units: number;
    tenants: number;
    reservations: number;
    invoices: number;
    payments: number;
    expenses: number;
  };
  users: OrgUserDTO[];
  properties: OrgPropertyDTO[];
  units: OrgUnitDTO[];
  tenants: OrgTenantDTO[];
  reservations: OrgReservationDTO[];
  payments: OrgPaymentDTO[];
};

type TabKey = "overview" | "units" | "tenants" | "reservations" | "payments";

export default function OrganizationDetailClient({
  data,
}: {
  data: OrganizationDetailData;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [searchQuery, setSearchQuery] = useState("");

  const metricsList = [
    { key: "users", label: "Users", value: data.metrics.users, Icon: UsersIcon, accent: "bg-brand-50 text-brand-700" },
    { key: "properties", label: "Buildings", value: data.metrics.properties, Icon: BuildingOffice2Icon, accent: "bg-info-50 text-info-700" },
    { key: "units", label: "Units", value: data.metrics.units, Icon: HomeModernIcon, accent: "bg-warning-50 text-warning-700" },
    { key: "tenants", label: "Tenants", value: data.metrics.tenants, Icon: UserGroupIcon, accent: "bg-success-50 text-success-700" },
    { key: "reservations", label: "Reservations", value: data.metrics.reservations, Icon: CalendarDaysIcon, accent: "bg-brand-100 text-brand-700" },
    { key: "invoices", label: "Invoices", value: data.metrics.invoices, Icon: DocumentTextIcon, accent: "bg-info-50 text-info-700" },
    { key: "payments", label: "Payments", value: data.metrics.payments, Icon: BanknotesIcon, accent: "bg-success-50 text-success-700" },
    { key: "expenses", label: "Expenses", value: data.metrics.expenses, Icon: ReceiptPercentIcon, accent: "bg-warning-50 text-warning-700" },
  ];

  // Filtering for Units tab
  const filteredUnits = data.units.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.propertyName.toLowerCase().includes(q) ||
      u.unitType.toLowerCase().includes(q) ||
      u.status.toLowerCase().includes(q)
    );
  });

  // Filtering for Tenants tab
  const filteredTenants = data.tenants.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.fullNameArabic && t.fullNameArabic.toLowerCase().includes(q)) ||
      t.phone.toLowerCase().includes(q) ||
      (t.email && t.email.toLowerCase().includes(q)) ||
      (t.nationality && t.nationality.toLowerCase().includes(q))
    );
  });

  // Filtering for Reservations tab
  const filteredReservations = data.reservations.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.tenantName.toLowerCase().includes(q) ||
      (r.reservationNumber && r.reservationNumber.toLowerCase().includes(q)) ||
      (r.unitName && r.unitName.toLowerCase().includes(q)) ||
      r.status.toLowerCase().includes(q)
    );
  });

  // Filtering for Payments tab
  const filteredPayments = data.payments.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.tenantName.toLowerCase().includes(q) ||
      (p.paymentNumber && p.paymentNumber.toLowerCase().includes(q)) ||
      p.method.toLowerCase().includes(q) ||
      (p.reference && p.reference.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb & Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-fg-tertiary">
          <Link
            href="/admin/organizations"
            className="inline-flex items-center gap-1 hover:text-brand-600 transition-colors"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5 rtl:rotate-180" />
            <span>Organizations</span>
          </Link>
          <span>/</span>
          <span className="font-medium text-fg truncate">{data.name}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-white shadow-md"
              style={{ backgroundColor: data.pdfBrandColor || "#185FA5" }}
            >
              <BuildingOfficeIcon className="h-6 w-6" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-fg">{data.name}</h1>
                <Badge tone={data.subscriptionStatus === "ACTIVE" ? "success" : "warning"} appearance="subtle" size="sm" dot>
                  {data.subscriptionStatus}
                </Badge>
                <Badge tone="brand" appearance="subtle" size="sm">
                  Plan: {data.plan}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-fg-tertiary">
                {data.city} {data.area ? `(${data.area})` : ""} · Created on {fmtDate(data.createdAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {metricsList.map(({ key, label, value, Icon, accent }) => (
          <div
            key={key}
            className="flex flex-col justify-between rounded-2xl border border-border-default bg-surface p-3.5 transition-all hover:border-brand-300"
          >
            <div className="flex items-center justify-between">
              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3">
              <p className="text-xl font-bold tabular-nums text-fg leading-none">{value}</p>
              <p className="mt-1 text-[11px] font-medium text-fg-tertiary truncate">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs Bar */}
      <div className="border-b border-border-default">
        <nav className="-mb-px flex space-x-6 overflow-x-auto rtl:space-x-reverse" aria-label="Tabs">
          {[
            { id: "overview", label: "Overview", icon: BuildingOffice2Icon, count: null },
            { id: "units", label: "Units", icon: HomeModernIcon, count: data.units.length },
            { id: "tenants", label: "Tenants", icon: UserGroupIcon, count: data.tenants.length },
            { id: "reservations", label: "Reservations", icon: CalendarDaysIcon, count: data.reservations.length },
            { id: "payments", label: "Payments", icon: BanknotesIcon, count: data.payments.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as TabKey);
                  setSearchQuery("");
                }}
                className={`group inline-flex items-center gap-2 border-b-2 py-3.5 px-1 text-sm font-semibold transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-brand-600 text-brand-600"
                    : "border-transparent text-fg-tertiary hover:border-border-default hover:text-fg"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-brand-600" : "text-fg-tertiary group-hover:text-fg"}`} />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      isActive ? "bg-brand-50 text-brand-700" : "bg-canvas text-fg-tertiary"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Search Bar for List Tabs */}
      {activeTab !== "overview" && (
        <div className="relative max-w-md">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-tertiary rtl:left-auto rtl:right-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab}...`}
            className="w-full rounded-xl border border-border-default bg-surface py-2 pl-9 pr-4 text-sm text-fg placeholder-fg-tertiary focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 rtl:pl-4 rtl:pr-9"
          />
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Org Details & Settings Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Organization Info */}
            <div className="rounded-2xl border border-border-default bg-surface p-5 space-y-4">
              <h3 className="text-base font-bold text-fg flex items-center gap-2">
                <BuildingOfficeIcon className="h-5 w-5 text-brand-600" />
                <span>Organization Profile</span>
              </h3>

              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl bg-canvas p-3">
                  <p className="text-xs text-fg-tertiary">Organization Name</p>
                  <p className="font-semibold text-fg mt-0.5">{data.name}</p>
                </div>

                <div className="rounded-xl bg-canvas p-3">
                  <p className="text-xs text-fg-tertiary">Phone</p>
                  <p className="font-semibold text-fg mt-0.5">{data.phone || "—"}</p>
                </div>

                <div className="rounded-xl bg-canvas p-3">
                  <p className="text-xs text-fg-tertiary">City & Area</p>
                  <p className="font-semibold text-fg mt-0.5">
                    {data.city} {data.area ? `· ${data.area}` : ""}
                  </p>
                </div>

                <div className="rounded-xl bg-canvas p-3">
                  <p className="text-xs text-fg-tertiary">Address</p>
                  <p className="font-semibold text-fg mt-0.5 truncate">{data.address || "—"}</p>
                </div>

                <div className="rounded-xl bg-canvas p-3">
                  <p className="text-xs text-fg-tertiary">Default Currency</p>
                  <p className="font-semibold text-fg mt-0.5">{data.currency} (OMR)</p>
                </div>

                <div className="rounded-xl bg-canvas p-3">
                  <p className="text-xs text-fg-tertiary">Timezone</p>
                  <p className="font-semibold text-fg mt-0.5">{data.timezone}</p>
                </div>
              </div>
            </div>

            {/* System Configuration & Policies */}
            <div className="rounded-2xl border border-border-default bg-surface p-5 space-y-4">
              <h3 className="text-base font-bold text-fg flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5 text-brand-600" />
                <span>System Policies & Configuration</span>
              </h3>

              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl bg-canvas p-3">
                  <p className="text-xs text-fg-tertiary">Max Properties</p>
                  <p className="font-semibold text-fg mt-0.5">{data.maxProperties} building(s)</p>
                </div>

                <div className="rounded-xl bg-canvas p-3">
                  <p className="text-xs text-fg-tertiary">Check-in Policy</p>
                  <p className="font-semibold text-fg mt-0.5">{data.checkInPolicy}</p>
                </div>

                <div className="rounded-xl bg-canvas p-3">
                  <p className="text-xs text-fg-tertiary">Daily Invoice Timing</p>
                  <p className="font-semibold text-fg mt-0.5">{data.dailyInvoiceTiming}</p>
                </div>

                <div className="rounded-xl bg-canvas p-3">
                  <p className="text-xs text-fg-tertiary">Monthly Invoice Timing</p>
                  <p className="font-semibold text-fg mt-0.5">{data.monthlyInvoiceTiming}</p>
                </div>

                <div className="rounded-xl bg-canvas p-3">
                  <p className="text-xs text-fg-tertiary">Auto-Checkout</p>
                  <p className="font-semibold text-fg mt-0.5">{data.autoCheckout ? "Enabled" : "Disabled"}</p>
                </div>

                <div className="rounded-xl bg-canvas p-3">
                  <p className="text-xs text-fg-tertiary">PDF Brand Color</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span
                      className="h-4 w-4 rounded-full border border-black/10"
                      style={{ backgroundColor: data.pdfBrandColor || "#185FA5" }}
                    />
                    <span className="font-mono text-xs font-semibold text-fg">{data.pdfBrandColor}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Properties / Buildings List */}
          <div className="rounded-2xl border border-border-default bg-surface p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-fg flex items-center gap-2">
                <BuildingOffice2Icon className="h-5 w-5 text-brand-600" />
                <span>Buildings & Properties ({data.properties.length})</span>
              </h3>
            </div>

            {data.properties.length === 0 ? (
              <p className="text-sm text-fg-tertiary italic">No properties registered yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.properties.map((p) => {
                  const typeBadgeProps = getPropertyTypeBadge(p.type as PropertyTypeKey);
                  return (
                    <div key={p.id} className="rounded-xl border border-border-default bg-canvas p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-fg text-sm truncate">{p.name}</h4>
                        <Badge {...typeBadgeProps} size="sm">
                          {p.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-fg-tertiary">{p.city} {p.address ? `· ${p.address}` : ""}</p>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-border-default/50 text-fg-secondary">
                        <span>{p.unitsCount} unit(s)</span>
                        <span>{p.totalFloors ? `${p.totalFloors} floor(s)` : ""}</span>
                        <span className={p.isActive ? "text-success-600 font-medium" : "text-fg-tertiary"}>
                          {p.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Organization Users / Staff */}
          <div className="rounded-2xl border border-border-default bg-surface p-5 space-y-4">
            <h3 className="text-base font-bold text-fg flex items-center gap-2">
              <UsersIcon className="h-5 w-5 text-brand-600" />
              <span>Users & Team Members ({data.users.length})</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-fg rtl:text-right">
                <thead className="bg-canvas text-xs uppercase text-fg-tertiary border-b border-border-default">
                  <tr>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Phone</th>
                    <th className="px-4 py-3 font-semibold">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {data.users.map((u) => {
                    const roleBadgeProps = getUserRoleBadge(u.role as UserRoleKey);
                    return (
                      <tr key={u.id} className="hover:bg-canvas/50">
                        <td className="px-4 py-3 font-medium text-fg">
                          {u.firstName || u.lastName
                            ? `${u.firstName || ""} ${u.lastName || ""}`.trim()
                            : "User"}
                        </td>
                        <td className="px-4 py-3 text-fg-secondary font-mono text-xs">{u.email}</td>
                        <td className="px-4 py-3">
                          <Badge {...roleBadgeProps} size="sm">
                            {u.assignedRoleName || u.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-fg-tertiary text-xs">{u.phone || "—"}</td>
                        <td className="px-4 py-3 text-fg-tertiary text-xs">{fmtDate(u.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: UNITS */}
      {activeTab === "units" && (
        <div className="rounded-2xl border border-border-default bg-surface p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-fg">
              Units Directory ({filteredUnits.length} of {data.units.length})
            </h3>
          </div>

          {filteredUnits.length === 0 ? (
            <div className="py-10 text-center text-sm text-fg-tertiary">
              No units found matching your search.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-fg rtl:text-right">
                <thead className="bg-canvas text-xs uppercase text-fg-tertiary border-b border-border-default">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Unit Name</th>
                    <th className="px-4 py-3 font-semibold">Building</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Beds / Baths</th>
                    <th className="px-4 py-3 font-semibold">Base Price</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {filteredUnits.map((u) => {
                    const statusKey = u.status.toLowerCase() as UnitStatusKey;
                    const badgeProps = getUnitStatusBadge(statusKey);
                    return (
                      <tr key={u.id} className="hover:bg-canvas/50">
                        <td className="px-4 py-3 font-bold text-fg">{u.name}</td>
                        <td className="px-4 py-3 text-fg-secondary">{u.propertyName}</td>
                        <td className="px-4 py-3 text-xs font-medium text-fg-tertiary">{u.unitType}</td>
                        <td className="px-4 py-3 text-xs text-fg-tertiary">
                          {u.bedrooms} Bed · {u.bathrooms} Bath (Fl. {u.floor})
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-fg">
                          {formatCurrency(u.basePrice, data.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge {...badgeProps} size="sm">
                            {u.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {u.isActive ? (
                            <span className="text-success-600 font-medium">Active</span>
                          ) : (
                            <span className="text-fg-tertiary">Inactive</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TENANTS */}
      {activeTab === "tenants" && (
        <div className="rounded-2xl border border-border-default bg-surface p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-fg">
              Tenants Directory ({filteredTenants.length} of {data.tenants.length})
            </h3>
          </div>

          {filteredTenants.length === 0 ? (
            <div className="py-10 text-center text-sm text-fg-tertiary">
              No tenants found matching your search.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-fg rtl:text-right">
                <thead className="bg-canvas text-xs uppercase text-fg-tertiary border-b border-border-default">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Tenant</th>
                    <th className="px-4 py-3 font-semibold">Phone / Email</th>
                    <th className="px-4 py-3 font-semibold">Classification</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Stays</th>
                    <th className="px-4 py-3 font-semibold">Total Spent</th>
                    <th className="px-4 py-3 font-semibold">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {filteredTenants.map((t) => {
                    const classProps = getTenantClassBadge(t.classification as TenantClassKey);
                    const typeProps = getTenantTypeBadge(t.tenantType as TenantTypeKey);
                    return (
                      <tr key={t.id} className="hover:bg-canvas/50">
                        <td className="px-4 py-3">
                          <p className="font-bold text-fg">{t.name}</p>
                          {t.fullNameArabic && (
                            <p className="text-xs text-fg-tertiary">{t.fullNameArabic}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <p className="font-mono text-fg">{t.phone}</p>
                          {t.email && <p className="text-fg-tertiary">{t.email}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge {...classProps} size="sm">
                            {t.classification}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge {...typeProps} size="sm">
                            {t.tenantType}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-semibold tabular-nums text-fg">{t.totalStays}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-fg">
                          {formatCurrency(t.totalSpent, data.currency)}
                        </td>
                        <td className="px-4 py-3 text-xs text-fg-tertiary">{fmtDate(t.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: RESERVATIONS */}
      {activeTab === "reservations" && (
        <div className="rounded-2xl border border-border-default bg-surface p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-fg">
              Reservations Log ({filteredReservations.length} of {data.reservations.length})
            </h3>
          </div>

          {filteredReservations.length === 0 ? (
            <div className="py-10 text-center text-sm text-fg-tertiary">
              No reservations found matching your search.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-fg rtl:text-right">
                <thead className="bg-canvas text-xs uppercase text-fg-tertiary border-b border-border-default">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Res #</th>
                    <th className="px-4 py-3 font-semibold">Tenant</th>
                    <th className="px-4 py-3 font-semibold">Unit</th>
                    <th className="px-4 py-3 font-semibold">Dates</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Grand Total</th>
                    <th className="px-4 py-3 font-semibold">Amount Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {filteredReservations.map((r) => {
                    const statusKey = reservationStatusKeyFromDisplayLabel(r.status);
                    const statusProps = getReservationStatusBadge(statusKey);
                    return (
                      <tr key={r.id} className="hover:bg-canvas/50">
                        <td className="px-4 py-3 font-mono font-semibold text-brand-600 text-xs">
                          {r.reservationNumber || r.id.substring(0, 8)}
                        </td>
                        <td className="px-4 py-3 font-bold text-fg">{r.tenantName}</td>
                        <td className="px-4 py-3 text-fg-secondary text-xs">{r.unitName || "—"}</td>
                        <td className="px-4 py-3 text-xs text-fg-tertiary">
                          <p>{fmtDate(r.startDate)} → {fmtDate(r.endDate)}</p>
                          <p className="text-[11px] text-fg-tertiary">{r.totalNights} night(s) · {r.rateType}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge {...statusProps} size="sm">
                            {r.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-fg">
                          {formatCurrency(r.grandTotal, data.currency)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-success-700 font-semibold">
                          {formatCurrency(r.amountPaid, data.currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: PAYMENTS */}
      {activeTab === "payments" && (
        <div className="rounded-2xl border border-border-default bg-surface p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-fg">
              Payments Log ({filteredPayments.length} of {data.payments.length})
            </h3>
          </div>

          {filteredPayments.length === 0 ? (
            <div className="py-10 text-center text-sm text-fg-tertiary">
              No payments found matching your search.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-fg rtl:text-right">
                <thead className="bg-canvas text-xs uppercase text-fg-tertiary border-b border-border-default">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Payment #</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Tenant</th>
                    <th className="px-4 py-3 font-semibold">Method</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {filteredPayments.map((p) => {
                    const methodProps = getPaymentMethodBadge(p.method as PaymentMethodKey);
                    return (
                      <tr key={p.id} className="hover:bg-canvas/50">
                        <td className="px-4 py-3 font-mono font-semibold text-brand-600 text-xs">
                          {p.paymentNumber || p.id.substring(0, 8)}
                        </td>
                        <td className="px-4 py-3 text-xs text-fg-tertiary">{fmtDateTime(p.date)}</td>
                        <td className="px-4 py-3 font-bold text-fg">{p.tenantName}</td>
                        <td className="px-4 py-3">
                          <Badge {...methodProps} size="sm">
                            {p.method}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-success-700">
                          {formatCurrency(p.amount, data.currency)}
                        </td>
                        <td className="px-4 py-3 text-xs text-fg-tertiary font-mono">{p.reference || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
