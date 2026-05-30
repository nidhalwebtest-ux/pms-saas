import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/utils/supabase/server";
import { notFound, redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { format } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import {
  HomeIcon,
  PhotoIcon,
  BuildingOffice2Icon,
  ArchiveBoxIcon,
  CheckCircleIcon,
  WrenchScrewdriverIcon,
  ListBulletIcon,
} from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";
import PropertyDangerZone from "@/components/dashboard/PropertyDangerZone";
import { getUnitDisplayStatus } from "@/lib/unit-status";
import {
  Badge,
  getPropertyTypeBadge,
  getUnitStatusBadge,
  type PropertyTypeKey,
} from "@/components/ui";

export default async function PropertyDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { organizationId: true },
  });

  const property = await prisma.property.findUnique({
    where:   { id },
    include: {
      units: {
        orderBy: { name: "asc" },
        include: {
          reservations: {
            where:  { status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] } },
            select: { status: true, endDate: true },
          },
        },
      },
      _count: { select: { units: true } },
    },
  });

  if (!property) notFound();
  if (property.organizationId !== dbUser?.organizationId) redirect("/dashboard");

  const t      = await getTranslations("buildings.detail");
  const tT     = await getTranslations("buildings.types");
  const tStat  = await getTranslations("units.displayStatus");
  const locale = await getLocale();
  const dateLocale = locale === "ar" ? arLocale : enLocale;

  const fmtDate = (d: Date) =>
    format(d, "d MMM yyyy", { locale: dateLocale });

  const tryT = <T,>(fn: (k: string) => T, key: string, fallback: T): T => {
    try { return fn(key); } catch { return fallback; }
  };

  const typeLabel = tryT((k) => tT(k), property.type, property.type);

  return (
    <div className="space-y-6">

      {/* ── Archived banner ───────────────────────────────────── */}
      {property.isArchived && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <ArchiveBoxIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900">{t("archivedTitle")}</p>
            <p className="mt-0.5 text-xs text-amber-700">
              {t("archivedBody")}
              {property.archivedAt && (
                <> {t("archivedOn", { date: fmtDate(property.archivedAt) })}</>
              )}
              {" "}{t("scrollToRestore")}
            </p>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 pb-5 sm:flex sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl sm:tracking-tight">
                {property.name}
              </h2>
              <Badge {...getPropertyTypeBadge(property.type as PropertyTypeKey)} size="md">
                {typeLabel}
              </Badge>
              {property.isArchived ? (
                <Badge tone="neutral" appearance="subtle" size="md" icon={<ArchiveBoxIcon className="h-full w-full" />}>
                  {t("archived")}
                </Badge>
              ) : property.isActive ? (
                <Badge tone="success" appearance="subtle" size="md" icon={<CheckCircleIcon className="h-full w-full" />}>
                  {t("active")}
                </Badge>
              ) : (
                <Badge tone="warning" appearance="subtle" size="md" icon={<WrenchScrewdriverIcon className="h-full w-full" />}>
                  {t("inactive")}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {[property.address, property.city, property.governorate].filter(Boolean).join(", ")}
              {property.totalFloors ? t("floorsSuffix", { count: property.totalFloors }) : ""}
            </p>
            {property.description && (
              <p className="mt-2 text-sm text-gray-600 max-w-2xl">{property.description}</p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 sm:ms-4 sm:mt-0">
          <Link
            href="/dashboard/properties"
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            <ListBulletIcon className="h-4 w-4" />
            {t("buildingsList")}
          </Link>
          <Link
            href={`/dashboard/properties/${id}/edit`}
            className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            {t("editProperty")}
          </Link>
          {!property.isArchived && (
            <Link
              href={`/dashboard/units/new?propertyId=${id}`}
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              {t("addUnit")}
            </Link>
          )}
        </div>
      </div>

      {/* ── Photo Gallery ───────────────────────────────────────── */}
      {property.photos.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <PhotoIcon className="h-4 w-4 text-gray-400" />{" "}
            <span className="ltr-numbers">{t("photosHeading", { count: property.photos.length })}</span>
          </h3>
          <div className="flex flex-wrap gap-3">
            {property.photos.map((url) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                <div className="relative h-32 w-40 overflow-hidden rounded-xl ring-1 ring-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <Image src={url} alt={property.name} fill className="object-cover" unoptimized />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Units Table ─────────────────────────────────────────── */}
      <div>
        <h3 className="mb-4 text-base font-semibold text-gray-900 ltr-numbers">
          {t("unitsHeading", { count: property._count.units })}
        </h3>
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3.5 ps-4 pe-3 text-start text-sm font-semibold text-gray-900 sm:ps-6">{t("table.name")}</th>
                <th className="px-3 py-3.5 text-start text-sm font-semibold text-gray-900">{t("table.floor")}</th>
                <th className="px-3 py-3.5 text-start text-sm font-semibold text-gray-900">{t("table.type")}</th>
                <th className="px-3 py-3.5 text-start text-sm font-semibold text-gray-900">{t("table.basePrice")}</th>
                <th className="px-3 py-3.5 text-start text-sm font-semibold text-gray-900">{t("table.status")}</th>
                <th className="relative py-3.5 ps-3 pe-4 sm:pe-6"><span className="sr-only">{t("table.actions")}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {property.units.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-gray-500">
                    {t("noUnits")}{!property.isArchived && t("noUnitsAddHint")}
                  </td>
                </tr>
              ) : (
                property.units.map((unit) => {
                  const displayStatus = getUnitDisplayStatus(unit.status, unit.reservations);
                  const statusLabel = tryT((k) => tStat(k), displayStatus, displayStatus);
                  return (
                  <tr key={unit.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="whitespace-nowrap py-4 ps-4 pe-3 text-sm font-medium text-gray-900 sm:ps-6">
                      <div className="flex items-center gap-2">
                        <HomeIcon className="h-4 w-4 text-gray-400" />
                        {unit.name}
                        {unit.photos.length > 0 && (
                          <span className="text-xs text-gray-400 ltr-numbers" title={t("table.photosCount", { count: unit.photos.length })}>
                            <PhotoIcon className="inline h-3.5 w-3.5" /> {unit.photos.length}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 ltr-numbers">{unit.floor ?? t("table.dash")}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 ltr-numbers">
                      {t("table.bedsBaths", { beds: unit.bedrooms, baths: unit.bathrooms })}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold text-gray-800 ltr-numbers">
                      {Number(unit.basePrice).toFixed(3)}{" "}
                      <span className="text-xs font-normal text-gray-500">{t("table.omr")}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <Badge {...getUnitStatusBadge(displayStatus)} size="sm">
                        {statusLabel}
                      </Badge>
                    </td>
                    <td className="relative whitespace-nowrap py-4 ps-3 pe-4 text-end text-sm font-medium sm:pe-6">
                      <Link href={`/dashboard/units/${unit.id}/edit`} className="text-blue-600 hover:text-blue-900">
                        {t("table.edit")}
                      </Link>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Danger Zone ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-gray-700">{t("dangerZone")}</p>
        <PropertyDangerZone
          propertyId={id}
          propertyName={property.name}
          unitCount={property._count.units}
          isArchived={property.isArchived}
        />
      </div>

    </div>
  );
}
