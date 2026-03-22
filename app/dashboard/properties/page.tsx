import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import PropertyFilters from "./PropertyFilters";
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

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const q           = params.q      || "";
  const typeFilter  = params.type   || "";
  const statusFilter = params.status || "active"; // "active" | "inactive" | "all"
  const sortParam   = params.sort   || "name_asc";

  // Auth
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { organizationId: true },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");

  // Build WHERE
  const whereClause: Prisma.PropertyWhereInput = {
    organizationId: dbUser.organizationId,
    ...(q && {
      OR: [
        { name:        { contains: q, mode: "insensitive" } },
        { city:        { contains: q, mode: "insensitive" } },
        { address:     { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(typeFilter && { type: typeFilter as any }),
    // Archived tab shows only archived; all other tabs exclude archived
    ...(statusFilter === "archived"
      ? { isArchived: true }
      : { isArchived: false,
          ...(statusFilter === "active"   && { isActive: true  }),
          ...(statusFilter === "inactive" && { isActive: false }),
        }
    ),
  };

  // Build ORDER BY (server-side for text fields; derived fields sorted client-side)
  let orderByClause: Prisma.PropertyOrderByWithRelationInput = { name: "asc" };
  if (sortParam === "name_desc")    orderByClause = { name:      "desc" };
  if (sortParam === "city_asc")     orderByClause = { city:      "asc"  };
  if (sortParam === "city_desc")    orderByClause = { city:      "desc" };
  if (sortParam === "type_asc")     orderByClause = { type:      "asc"  };
  if (sortParam === "type_desc")    orderByClause = { type:      "desc" };
  if (sortParam === "newest")       orderByClause = { createdAt: "desc" };
  if (sortParam === "oldest")       orderByClause = { createdAt: "asc"  };

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Run both queries in parallel
  const [raw, paymentsThisMonth] = await Promise.all([
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
      orderBy: orderByClause,
    }),
    prisma.payment.findMany({
      where: {
        date: { gte: startOfMonth },
        reservation: {
          unit: { property: { organizationId: dbUser.organizationId } },
        },
      },
      select: {
        amount: true,
        reservation: { select: { unit: { select: { propertyId: true } } } },
      },
    }),
  ]);

  // Build revenue map: propertyId → total OMR this month
  const revenueByProperty: Record<string, number> = {};
  for (const p of paymentsThisMonth) {
    const pid = p.reservation?.unit?.propertyId;
    if (pid) revenueByProperty[pid] = (revenueByProperty[pid] ?? 0) + Number(p.amount);
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
      <PropertyFilters
        currentSearch={q}
        currentType={typeFilter}
        currentStatus={statusFilter}
        totalResults={properties.length}
      />
      <PropertiesView properties={properties} initialSort={sortParam} />
    </div>
  );
}
