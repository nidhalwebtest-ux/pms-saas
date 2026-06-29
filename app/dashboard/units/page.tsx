import Link from "next/link";
import { assertView } from "@/lib/access";
import { HomeModernIcon, PlusIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getUnitDisplayStatus, type UnitDisplayStatus } from "@/lib/unit-status";
import { getSelectedPropertyId } from "@/lib/selected-property";
import { getEffectivePropertyIds } from "@/lib/property-scope";
import UnitsView from "./UnitsView";

// Active-reservation statuses used in every query
const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN"] as const;

export type CurrentStay = {
  reservationId:     string;
  reservationNumber: string | null;
  tenantId:          string;
  tenantName:        string;
} | null;

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
  isActive:    boolean;
  photos:      string[];
  propertyId:  string;
  description: string | null;
  property:    { name: string };
  displayStatus: UnitDisplayStatus;
  currentStay: CurrentStay;
};

export default async function UnitsPage() {
  // assertView already resolves+caches the session and guarantees an org.
  const access = await assertView("units");
  const orgId = access.organizationId;

  const [allProperties, selectedPropertyId, orgPrefs] = await Promise.all([
    prisma.property.findMany({
      where:   { organizationId: orgId },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getSelectedPropertyId(),
    prisma.organization.findUnique({
      where:  { id: orgId },
      select: { showReservedStatus: true },
    }),
  ]);
  const showReserved = orgPrefs?.showReservedStatus ?? false;

  // When the global property selector picks a specific building, the units
  // list is restricted to that building's units. The filter dropdown reflects
  // that scope. All other filtering (search / tab / type / floor) happens
  // client-side over the loaded rows — no DB refetch.
  const properties = selectedPropertyId
    ? allProperties.filter((p) => p.id === selectedPropertyId)
    : allProperties;

  // Limit to the user's accessible buildings (null = unrestricted).
  const propIds = await getEffectivePropertyIds(selectedPropertyId);

  // ── FETCH all units in scope (one query; filtering is client-side) ─────────
  const rawUnits = await prisma.unit.findMany({
    where: {
      property: { organizationId: orgId },
      ...(propIds ? { propertyId: { in: propIds } } : {}),
    },
    include: {
      property:     { select: { name: true } },
      reservations: {
        where:  { status: { in: [...ACTIVE_STATUSES] } },
        select: {
          id: true, reservationNumber: true, status: true, startDate: true, endDate: true,
          tenant: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { startDate: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const units: UnitRow[] = rawUnits.map((u) => {
    const checkedIn = u.reservations.find((r) => r.status === "CHECKED_IN");
    const currentStay: CurrentStay = checkedIn
      ? {
          reservationId:     checkedIn.id,
          reservationNumber: checkedIn.reservationNumber,
          tenantId:          checkedIn.tenant.id,
          tenantName:        `${checkedIn.tenant.firstName} ${checkedIn.tenant.lastName}`.trim(),
        }
      : null;
    return {
      id:            u.id,
      name:          u.name,
      unitType:      u.unitType,
      floor:         u.floor,
      bedrooms:      u.bedrooms,
      bathrooms:     u.bathrooms,
      area:          u.area,
      basePrice:     u.basePrice.toString(),
      status:        u.status,
      isActive:      u.isActive,
      photos:        u.photos,
      propertyId:    u.propertyId,
      description:   u.description,
      property:      u.property,
      displayStatus: getUnitDisplayStatus(u.status, u.reservations, new Date(), { showReserved, isActive: u.isActive }),
      currentStay,
    };
  });

  const availableFloors = [...new Set(units.map((u) => u.floor))].sort((a, b) => a - b);

  // Header summary counts (from the loaded rows — no extra queries)
  const vacantCount      = units.filter((u) => u.displayStatus === "vacant").length;
  const occupiedCount    = units.filter((u) => u.displayStatus === "occupied" || u.displayStatus === "overstay").length;
  const reservedCount    = units.filter((u) => u.displayStatus === "reserved").length;
  const maintenanceCount = units.filter((u) => u.displayStatus === "maintenance").length;
  const total            = units.length;

  const t = await getTranslations("units.list");

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

      {/* ── Filters + table (all client-side) ──────────────────────── */}
      <UnitsView
        units={units}
        properties={properties}
        availableFloors={availableFloors}
        scopedToBuilding={!!selectedPropertyId}
        showReserved={showReserved}
      />
    </div>
  );
}
