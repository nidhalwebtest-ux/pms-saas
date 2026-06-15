import Link from "next/link";
import { assertView } from "@/lib/access";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Prisma } from "@prisma/client";
import { HomeModernIcon, PlusIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getUnitDisplayStatus, type UnitDisplayStatus } from "@/lib/unit-status";
import { getSelectedPropertyId } from "@/lib/selected-property";
import UnitFilters from "./UnitFilters";
import UnitsView from "./UnitsView";

// Active-reservation statuses used in every query
const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN"] as const;

export type UnitRow = {
  id:          string;
  name:        string;
  unitType:    string;
  floor:       number;
  bedrooms:    number;
  bathrooms:   number;
  area:        number | null;
  basePrice:   string;   // serialised Decimal
  status:      string;
  photos:      string[];
  propertyId:  string;
  description: string | null;
  property:    { name: string };
  displayStatus: UnitDisplayStatus;
};

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const access = await assertView("units");
  const params           = await searchParams;
  const q                = params.q        || "";
  const propertyFilter   = params.property || "";
  const statusFilter     = params.status   || "all";
  const typeFilter       = params.type     || "";
  const floorFilter      = params.floor    || "";
  const sortParam        = params.sort     || "newest";

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { organizationId: true, organization: { select: { showReservedStatus: true } } },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");
  const showReserved = dbUser.organization?.showReservedStatus ?? false;

  const [allProperties, selectedPropertyId] = await Promise.all([
    prisma.property.findMany({
      where:   { organizationId: dbUser.organizationId },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getSelectedPropertyId(),
  ]);

  // When the global property selector picks a specific building, the units
  // list is restricted to that building's units. The filter dropdown must
  // reflect that scope — show only the selected building so the user can't
  // accidentally pick a different one without first widening their global
  // scope. When "All buildings" is selected, the dropdown shows everything.
  const properties = selectedPropertyId
    ? allProperties.filter((p) => p.id === selectedPropertyId)
    : allProperties;

  // ── WHERE ──────────────────────────────────────────────────────────────────
  const effectivePropertyId = selectedPropertyId || propertyFilter;

  const statusWhere: Prisma.UnitWhereInput =
    statusFilter === "vacant"
      ? { status: "AVAILABLE", reservations: { none:  { status: { in: [...ACTIVE_STATUSES] } } } }
      : statusFilter === "occupied"
      ? { reservations: { some: { status: "CHECKED_IN" } } }
      : statusFilter === "reserved"
      ? { status: "AVAILABLE", reservations: { some: { status: { in: ["PENDING", "CONFIRMED"] } } } }
      : statusFilter === "maintenance"
      ? { status: "MAINTENANCE" }
      : {};

  const whereClause: Prisma.UnitWhereInput = {
    property: { organizationId: dbUser.organizationId },
    ...(q                   && { name:       { contains: q, mode: "insensitive" } }),
    ...(effectivePropertyId && { propertyId: effectivePropertyId }),
    ...(typeFilter          && { unitType:   typeFilter }),
    ...(floorFilter !== ""  && { floor:      parseInt(floorFilter) }),
    ...statusWhere,
  };

  // ── ORDER BY ───────────────────────────────────────────────────────────────
  let orderByClause: Prisma.UnitOrderByWithRelationInput = { createdAt: "desc" };
  if (sortParam === "oldest")     orderByClause = { createdAt: "asc"  };
  if (sortParam === "name_asc")   orderByClause = { name:      "asc"  };
  if (sortParam === "name_desc")  orderByClause = { name:      "desc" };
  if (sortParam === "price_asc")  orderByClause = { basePrice: "asc"  };
  if (sortParam === "price_desc") orderByClause = { basePrice: "desc" };
  if (sortParam === "floor_asc")  orderByClause = { floor:     "asc"  };
  if (sortParam === "floor_desc") orderByClause = { floor:     "desc" };

  // ── FETCH ──────────────────────────────────────────────────────────────────
  const rawUnits = await prisma.unit.findMany({
    where: whereClause,
    include: {
      property:     { select: { name: true } },
      reservations: {
        where:  { status: { in: [...ACTIVE_STATUSES] } },
        select: { status: true, endDate: true },
      },
    },
    orderBy: orderByClause,
  });

  // Serialize Decimals + compute displayStatus
  const units: UnitRow[] = rawUnits.map((u) => ({
    id:            u.id,
    name:          u.name,
    unitType:      u.unitType,
    floor:         u.floor,
    bedrooms:      u.bedrooms,
    bathrooms:     u.bathrooms,
    area:          u.area,
    basePrice:     u.basePrice.toString(),
    status:        u.status,
    photos:        u.photos,
    propertyId:    u.propertyId,
    description:   u.description,
    property:      u.property,
    displayStatus: getUnitDisplayStatus(u.status, u.reservations, new Date(), { showReserved }),
  }));

  // Distinct floors for filter dropdown
  const floorRows = await prisma.unit.findMany({
    where:    { property: { organizationId: dbUser.organizationId } },
    select:   { floor: true },
    distinct: ["floor"],
    orderBy:  { floor: "asc" },
  });
  const availableFloors = floorRows.map((r) => r.floor);

  // Summary counts — respect the selected property scope
  const countBase: Prisma.UnitWhereInput = {
    property: { organizationId: dbUser.organizationId },
    ...(effectivePropertyId && { propertyId: effectivePropertyId }),
  };
  const [vacantCount, occupiedCount, reservedCount, maintenanceCount, allCount] = await Promise.all([
    prisma.unit.count({ where: { ...countBase, status: "AVAILABLE", reservations: { none:  { status: { in: [...ACTIVE_STATUSES] } } } } }),
    prisma.unit.count({ where: { ...countBase, reservations: { some: { status: "CHECKED_IN" } } } }),
    prisma.unit.count({ where: { ...countBase, status: "AVAILABLE", reservations: { some: { status: { in: ["PENDING","CONFIRMED"] } } } } }),
    prisma.unit.count({ where: { ...countBase, status: "MAINTENANCE" } }),
    prisma.unit.count({ where: countBase }),
  ]);

  const t = await getTranslations("units.list");
  const total = vacantCount + occupiedCount + reservedCount + maintenanceCount;

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
            <HomeModernIcon className="h-5 w-5 text-blue-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-xs text-gray-500">
              <span className="ltr-numbers">{total}</span> {t("totalLabel")} ·{" "}
              <span className="text-emerald-600 font-medium"><span className="ltr-numbers">{vacantCount}</span> {t("vacantLabel")}</span> ·{" "}
              <span className="text-blue-600 font-medium"><span className="ltr-numbers">{occupiedCount}</span> {t("occupiedLabel")}</span>
              {showReserved && (
                <> · <span className="text-violet-600 font-medium"><span className="ltr-numbers">{reservedCount}</span> {t("reservedLabel")}</span></>
              )}
              {maintenanceCount > 0 && (
                <> · <span className="text-amber-600 font-medium"><span className="ltr-numbers">{maintenanceCount}</span> {t("maintenanceLabel")}</span></>
              )}
            </p>
          </div>
        </div>
        {access.canCreate("units") && (
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/units/bulk"
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              <Squares2X2Icon className="h-4 w-4" />
              {t("bulkAdd")}
            </Link>
            <Link
              href="/dashboard/units/new"
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              {t("newUnit")}
            </Link>
          </div>
        )}
      </div>

      {/* ── Filters ────────────────────────────────────────────────── */}
      <UnitFilters
        currentSearch={q}
        currentProperty={propertyFilter}
        currentStatus={statusFilter}
        currentType={typeFilter}
        currentFloor={floorFilter}
        properties={properties}
        availableFloors={availableFloors}
        scopedToBuilding={!!selectedPropertyId}
        counts={{ all: allCount, vacant: vacantCount, occupied: occupiedCount, reserved: reservedCount, maintenance: maintenanceCount }}
        showReserved={showReserved}
      />

      {/* ── Table (client component with sort + quick actions) ───── */}
      <UnitsView units={units} statusFilter={statusFilter} />
    </div>
  );
}
