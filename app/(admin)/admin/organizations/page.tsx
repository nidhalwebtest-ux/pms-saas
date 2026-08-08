import Link from "next/link";
import {
  UsersIcon,
  BuildingOffice2Icon,
  HomeModernIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  BanknotesIcon,
  ReceiptPercentIcon,
  BuildingOfficeIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSuperAdmin } from "@/lib/super-admin";
import { fmtDate } from "../_lib/format";

export default async function AdminOrganizationsPage() {
  if (!(await getSuperAdmin())) redirect("/dashboard");
  const t = await getTranslations("admin.organizations");

  // Direct relation counts via _count; units (nested under Property) and
  // payments (optional org link, no back-relation) are tallied separately.
  const [orgs, propsForUnits, paymentGroups] = await Promise.all([
    prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        city: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            properties: true,
            tenants: true,
            reservations: true,
            invoices: true,
            expenses: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.property.findMany({
      select: { organizationId: true, _count: { select: { units: true } } },
    }),
    prisma.payment.groupBy({
      by: ["organizationId"],
      _count: { _all: true },
    }),
  ]);

  const unitsByOrg = new Map<string, number>();
  for (const p of propsForUnits) {
    unitsByOrg.set(p.organizationId, (unitsByOrg.get(p.organizationId) ?? 0) + p._count.units);
  }
  const paymentsByOrg = new Map<string, number>();
  for (const g of paymentGroups) {
    if (g.organizationId) paymentsByOrg.set(g.organizationId, g._count._all);
  }

  const metrics = (o: (typeof orgs)[number]) => [
    { key: "users", value: o._count.users, Icon: UsersIcon, accent: "bg-brand-50 text-brand-700" },
    { key: "buildings", value: o._count.properties, Icon: BuildingOffice2Icon, accent: "bg-info-50 text-info-700" },
    { key: "units", value: unitsByOrg.get(o.id) ?? 0, Icon: HomeModernIcon, accent: "bg-warning-50 text-warning-700" },
    { key: "tenants", value: o._count.tenants, Icon: UserGroupIcon, accent: "bg-success-50 text-success-700" },
    { key: "reservations", value: o._count.reservations, Icon: CalendarDaysIcon, accent: "bg-brand-100 text-brand-700" },
    { key: "invoices", value: o._count.invoices, Icon: DocumentTextIcon, accent: "bg-info-50 text-info-700" },
    { key: "payments", value: paymentsByOrg.get(o.id) ?? 0, Icon: BanknotesIcon, accent: "bg-success-50 text-success-700" },
    { key: "expenses", value: o._count.expenses, Icon: ReceiptPercentIcon, accent: "bg-warning-50 text-warning-700" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-fg">{t("title")}</h2>
          <p className="text-sm text-fg-tertiary">{t("subtitle")}</p>
        </div>
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
          {t("count", { n: orgs.length })}
        </span>
      </div>

      {orgs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-default bg-surface p-10 text-center">
          <BuildingOfficeIcon className="mx-auto h-10 w-10 text-fg-tertiary/40" />
          <p className="mt-2 text-sm text-fg-tertiary">{t("empty")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orgs.map((o) => (
            <div key={o.id} className="rounded-2xl border border-border-default bg-surface p-4 transition-all hover:border-brand-300 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={`/admin/organizations/${o.id}`}
                  className="group flex items-center gap-x-3 min-w-0 flex-1"
                >
                  <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm transition-transform group-hover:scale-105">
                    <BuildingOfficeIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold text-fg group-hover:text-brand-600">
                      {o.name}
                    </h3>
                    <p className="text-xs text-fg-tertiary">
                      {o.city} · {t("since", { date: fmtDate(o.createdAt.toISOString()) })}
                    </p>
                  </div>
                </Link>
                <Link
                  href={`/admin/organizations/${o.id}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-canvas px-3 py-1.5 text-xs font-medium text-fg-secondary transition-colors hover:bg-surface hover:text-brand-600"
                >
                  <span>{t("viewDetails", { defaultValue: "View details" })}</span>
                  <ChevronRightIcon className="h-3.5 w-3.5 rtl:rotate-180" />
                </Link>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {metrics(o).map(({ key, value, Icon, accent }) => (
                  <div key={key} className="flex items-center gap-2.5 rounded-xl bg-canvas px-3 py-2.5">
                    <span className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${accent}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-base font-bold tabular-nums leading-none text-fg">{value}</p>
                      <p className="mt-0.5 truncate text-[11px] text-fg-tertiary">{t(`metrics.${key}`)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

