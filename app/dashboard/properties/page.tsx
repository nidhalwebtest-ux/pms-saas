import { redirect } from "next/navigation";
import { assertView } from "@/lib/access";
import { getSessionAccessibleProperties } from "@/lib/property-scope";
import { createClient } from "@/utils/supabase/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import PropertiesView from "./PropertiesView";

export type PropertyRow = {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  isArchived: boolean;
  archivedAt: string | null;
  photos: string[];
  address: string | null;
  city: string;
  governorate: string;
  totalFloors: number | null;
  description: string | null;
  createdAt: string;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  revenueThisMonth: number;
};

export default async function PropertiesPage() {
  await assertView("buildings");

  // Auth
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { organizationId: true },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");

  // Per-user building scope: a user assigned to specific buildings sees only
  // those here; an unrestricted user (no assignments) or owner sees all
  // (accessible = null). This differs from the header property selector, which
  // only scopes content *within* a building — assignment is a hard restriction.
  const accessible = await getSessionAccessibleProperties();
  const scopeFilter: Prisma.PropertyWhereInput = accessible ? { id: { in: accessible } } : {};

  // Load ALL buildings in scope (every status). Search / type / status tab all
  // filter client-side over these rows — no DB refetch.
  const whereClause: Prisma.PropertyWhereInput = {
    organizationId: dbUser.organizationId,
    ...scopeFilter,
  };

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [raw, allocationsThisMonth] = await Promise.all([
    prisma.property.findMany({
      where: whereClause,
      include: {
        units: {
          select: {
            id: true,
            status: true,
            reservations: {
              where:  { status: { in: ["CONFIRMED", "CHECKED_IN"] } },
              select: { id: true },
              take:   1,
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    // Revenue is sourced from invoice payment allocations (not raw payments
    // via reservation→unit→property). This way cancelled invoices and
    // payments that were never applied to any invoice are correctly
    // excluded from the per-property revenue figure.
    prisma.paymentAllocation.findMany({
      where: {
        organizationId: dbUser.organizationId,
        payment: { date: { gte: startOfMonth } },
        invoice: { status: { not: "CANCELLED" } },
      },
      select: {
        amount: true,
        invoice: { select: { propertyId: true } },
      },
    }),
  ]);

  // Build revenue map: propertyId → total OMR this month (via invoices)
  const revenueByProperty: Record<string, number> = {};
  for (const a of allocationsThisMonth) {
    const pid = a.invoice?.propertyId;
    if (pid) revenueByProperty[pid] = (revenueByProperty[pid] ?? 0) + Number(a.amount);
  }

  // Serialize for client (no Date objects)
  const properties: PropertyRow[] = raw.map((p) => ({
    id:           p.id,
    name:         p.name,
    type:         p.type,
    isActive:     p.isActive,
    isArchived:   p.isArchived,
    archivedAt:   p.archivedAt?.toISOString() ?? null,
    photos:       p.photos,
    address:      p.address,
    city:         p.city,
    governorate:  p.governorate,
    totalFloors:  p.totalFloors,
    description:  p.description,
    createdAt:    p.createdAt.toISOString(),
    totalUnits:   p.units.length,
    occupiedUnits: p.units.filter((u) => u.reservations.length > 0).length,
    vacantUnits:   p.units.filter(
      (u) => u.reservations.length === 0 && u.status === "AVAILABLE",
    ).length,
    revenueThisMonth: revenueByProperty[p.id] ?? 0,
  }));

  return (
    <div className="space-y-4">
      <PropertiesView properties={properties} initialSort="name_asc" />
    </div>
  );
}
