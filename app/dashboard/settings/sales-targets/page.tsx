import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { requireOrgUser } from "@/lib/tenant";
import { type Role, ROLE_LABELS } from "@/lib/permissions";
import { getSessionAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import AccessDenied from "@/components/dashboard/AccessDenied";
import SalesTargetsGrid from "@/app/dashboard/sales-targets/SalesTargetsGrid";
import type { Scope, PeriodType } from "@/app/dashboard/sales-targets/actions";

export const dynamic = "force-dynamic";

export default async function SalesTargetsSettingsPage() {
  let actor;
  try { actor = await requireOrgUser(); } catch { redirect("/login"); }
  const access = await getSessionAccess();
  if (!access?.canView("salesTargets")) return <AccessDenied />;
  const orgId = actor.organizationId;

  const [users, properties, units, targets] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: orgId },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      orderBy: [{ firstName: "asc" }, { email: "asc" }],
    }),
    prisma.property.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.unit.findMany({
      where: { property: { organizationId: orgId } },
      select: { id: true, name: true, property: { select: { name: true } } },
      orderBy: [{ property: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.salesTarget.findMany({
      where: { organizationId: orgId },
      select: { scope: true, refId: true, periodType: true, periodStart: true, amount: true },
    }),
  ]);

  const receptionists = users.map((u) => ({
    id: u.id,
    name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email,
    role: ROLE_LABELS[u.role as Role] ?? u.role,
  }));
  const buildings = properties.map((p) => ({ id: p.id, name: p.name }));
  const unitList = units.map((u) => ({ id: u.id, name: u.name, group: u.property?.name ?? "—" }));
  const initialTargets = targets.map((t) => ({
    scope: t.scope as Scope,
    refId: t.refId,
    periodType: t.periodType as PeriodType,
    periodStart: t.periodStart.toISOString().slice(0, 10),
    amount: t.amount.toString(),
  }));

  const tNav = await getTranslations("salesTargets");

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/dashboard/settings" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeftIcon className="h-5 w-5 text-gray-500 rtl:rotate-180" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tNav("title")}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tNav("subtitle")}</p>
        </div>
      </div>

      <SalesTargetsGrid
        receptionists={receptionists}
        buildings={buildings}
        units={unitList}
        initialTargets={initialTargets}
      />
    </div>
  );
}
