import { redirect } from "next/navigation";
import { requireOrgUser } from "@/lib/tenant";
import { can, type Role, ROLE_LABELS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import AccessDenied from "@/components/dashboard/AccessDenied";
import SalesTargetsGrid from "./SalesTargetsGrid";
import type { Scope, PeriodType } from "./actions";

export const dynamic = "force-dynamic";

export default async function SalesTargetsPage() {
  let actor;
  try {
    actor = await requireOrgUser();
  } catch {
    redirect("/login");
  }
  if (!can(actor.role as Role, "manageSalesTargets")) {
    return <AccessDenied />;
  }
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

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <SalesTargetsGrid
        receptionists={receptionists}
        buildings={buildings}
        units={unitList}
        initialTargets={initialTargets}
      />
    </div>
  );
}
