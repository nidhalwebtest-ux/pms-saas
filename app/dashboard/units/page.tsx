import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Prisma } from "@prisma/client";
import {
  HomeModernIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";
import { getUnitDisplayStatus, UNIT_STATUS_CONFIG } from "@/lib/unit-status";
import UnitFilters from "./UnitFilters";

// Active-reservation statuses used in every query
const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN"] as const;

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params       = await searchParams;
  const q            = params.q        || "";
  const propertyFilter = params.property || "";
  const statusFilter = params.status   || "all";
  const sortParam    = params.sort     || "newest";

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { organizationId: true },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");

  // Properties for filter dropdown
  const properties = await prisma.property.findMany({
    where:   { organizationId: dbUser.organizationId },
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // ── WHERE ──────────────────────────────────────────────────────────────────
  const statusWhere: Prisma.UnitWhereInput =
    statusFilter === "vacant"
      ? { status: "AVAILABLE", reservations: { none:  { status: { in: [...ACTIVE_STATUSES] } } } }
      : statusFilter === "occupied"
      ? { reservations: { some: { status: "CHECKED_IN" } } }
      : statusFilter === "reserved"
      ? { status: "AVAILABLE", reservations: { some: { status: { in: ["PENDING", "CONFIRMED"] } } } }
      : statusFilter === "maintenance"
      ? { status: "MAINTENANCE" }
      : {}; // "all"

  const whereClause: Prisma.UnitWhereInput = {
    property: { organizationId: dbUser.organizationId },
    ...(q              && { name:       { contains: q, mode: "insensitive" } }),
    ...(propertyFilter && { propertyId: propertyFilter }),
    ...statusWhere,
  };

  // ── ORDER BY ───────────────────────────────────────────────────────────────
  let orderByClause: Prisma.UnitOrderByWithRelationInput = { createdAt: "desc" };
  if (sortParam === "oldest")      orderByClause = { createdAt: "asc"  };
  if (sortParam === "name_asc")    orderByClause = { name:      "asc"  };
  if (sortParam === "name_desc")   orderByClause = { name:      "desc" };
  if (sortParam === "price_asc")   orderByClause = { basePrice: "asc"  };
  if (sortParam === "price_desc")  orderByClause = { basePrice: "desc" };
  if (sortParam === "floor_asc")   orderByClause = { floor:     "asc"  };
  if (sortParam === "floor_desc")  orderByClause = { floor:     "desc" };

  // ── FETCH ──────────────────────────────────────────────────────────────────
  const units = await prisma.unit.findMany({
    where: whereClause,
    include: {
      property: { select: { name: true } },
      reservations: {
        where:  { status: { in: [...ACTIVE_STATUSES] } },
        select: { status: true },
      },
    },
    orderBy: orderByClause,
  });

  // Summary counts (scoped to org, all units regardless of filter)
  const [vacantCount, occupiedCount, reservedCount, maintenanceCount] = await Promise.all([
    prisma.unit.count({ where: { property: { organizationId: dbUser.organizationId }, status: "AVAILABLE", reservations: { none:  { status: { in: [...ACTIVE_STATUSES] } } } } }),
    prisma.unit.count({ where: { property: { organizationId: dbUser.organizationId }, reservations: { some: { status: "CHECKED_IN" } } } }),
    prisma.unit.count({ where: { property: { organizationId: dbUser.organizationId }, status: "AVAILABLE", reservations: { some: { status: { in: ["PENDING","CONFIRMED"] } } } } }),
    prisma.unit.count({ where: { property: { organizationId: dbUser.organizationId }, status: "MAINTENANCE" } }),
  ]);

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
            <HomeModernIcon className="h-5 w-5 text-blue-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Units &amp; Rooms</h1>
            <p className="text-xs text-gray-500">
              {vacantCount + occupiedCount + reservedCount + maintenanceCount} total ·{" "}
              <span className="text-emerald-600 font-medium">{vacantCount} vacant</span> ·{" "}
              <span className="text-blue-600 font-medium">{occupiedCount} occupied</span> ·{" "}
              <span className="text-violet-600 font-medium">{reservedCount} reserved</span>
              {maintenanceCount > 0 && (
                <> · <span className="text-amber-600 font-medium">{maintenanceCount} maintenance</span></>
              )}
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/units/new"
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          New Unit
        </Link>
      </div>

      {/* ── Filters ────────────────────────────────────────────────── */}
      <UnitFilters
        currentSearch={q}
        currentProperty={propertyFilter}
        currentStatus={statusFilter}
        properties={properties}
        counts={{ vacant: vacantCount, occupied: occupiedCount, reserved: reservedCount, maintenance: maintenanceCount }}
      />

      {/* ── Table ──────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:pl-5">
                  Unit
                </th>
                <th className="hidden px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">
                  Property
                </th>
                <th className="hidden px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">
                  Floor
                </th>
                <th className="hidden px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">
                  Type
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Price / mo
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {units.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-sm text-gray-400">
                    <HomeModernIcon className="mx-auto mb-3 h-10 w-10 text-gray-200" />
                    No units match your filters.
                  </td>
                </tr>
              ) : (
                units.map((unit) => {
                  const displayStatus = getUnitDisplayStatus(unit.status, unit.reservations);
                  const cfg = UNIT_STATUS_CONFIG[displayStatus];
                  const typeLabel = {
                    STUDIO: "Studio", ONE_BR: "1 BR", TWO_BR: "2 BR",
                    THREE_BR: "3 BR", SUITE: "Suite",
                  }[unit.unitType] ?? unit.unitType;

                  return (
                    <tr key={unit.id} className="hover:bg-blue-50/40 transition-colors">
                      {/* Unit name */}
                      <td className="py-3 pl-4 pr-3 sm:pl-5">
                        <Link
                          href={`/dashboard/units/${unit.id}/edit`}
                          className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                        >
                          {unit.name}
                        </Link>
                        {unit.description && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-gray-400">{unit.description}</p>
                        )}
                      </td>

                      {/* Property */}
                      <td className="hidden px-3 py-3 text-sm sm:table-cell">
                        <Link
                          href={`/dashboard/properties/${unit.propertyId}`}
                          className="text-gray-600 hover:text-blue-600 transition-colors"
                        >
                          {unit.property.name}
                        </Link>
                      </td>

                      {/* Floor */}
                      <td className="hidden px-3 py-3 text-sm text-gray-500 md:table-cell">
                        {unit.floor > 0 ? `Floor ${unit.floor}` : "G"}
                      </td>

                      {/* Type */}
                      <td className="hidden px-3 py-3 text-sm text-gray-500 md:table-cell">
                        <span className="font-medium">{typeLabel}</span>
                        <span className="text-gray-400"> · {unit.bedrooms}b/{unit.bathrooms}ba</span>
                        {unit.area && (
                          <span className="text-gray-400"> · {unit.area}m²</span>
                        )}
                      </td>

                      {/* Price */}
                      <td className="px-3 py-3 text-sm font-semibold text-gray-800 whitespace-nowrap">
                        {Number(unit.basePrice).toFixed(3)}{" "}
                        <span className="text-xs font-normal text-gray-400">OMR</span>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3 text-right text-sm">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/dashboard/units/${unit.id}/edit`}
                            className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                          >
                            Edit
                          </Link>
                          <Link
                            href={`/dashboard/properties/${unit.propertyId}`}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            Building
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {units.length > 0 && (
          <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-2.5 text-xs text-gray-500">
            Showing {units.length} unit{units.length !== 1 ? "s" : ""}
            {statusFilter !== "all" && ` · filtered by ${statusFilter}`}
          </div>
        )}
      </div>
    </div>
  );
}
