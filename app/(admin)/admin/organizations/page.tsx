import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSuperAdmin } from "@/lib/super-admin";
import { OrganizationsListClient, type OrgListItem } from "./OrganizationsListClient";

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
        isDemo: true,
        demoCreatedAt: true,
        demoContactName: true,
        demoContactWhatsapp: true,
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
      // Newest first so fresh demo starts surface immediately.
      orderBy: { createdAt: "desc" },
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

  const items: OrgListItem[] = orgs.map((o) => ({
    id: o.id,
    name: o.name,
    city: o.city,
    createdAt: o.createdAt.toISOString(),
    isDemo: o.isDemo,
    demoCreatedAt: o.demoCreatedAt ? o.demoCreatedAt.toISOString() : null,
    demoContactName: o.demoContactName,
    demoContactWhatsapp: o.demoContactWhatsapp,
    counts: {
      users: o._count.users,
      buildings: o._count.properties,
      units: unitsByOrg.get(o.id) ?? 0,
      tenants: o._count.tenants,
      reservations: o._count.reservations,
      invoices: o._count.invoices,
      payments: paymentsByOrg.get(o.id) ?? 0,
      expenses: o._count.expenses,
    },
  }));

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

      <OrganizationsListClient orgs={items} />
    </div>
  );
}
