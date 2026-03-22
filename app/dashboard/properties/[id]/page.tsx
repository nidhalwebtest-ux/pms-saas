import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/utils/supabase/server";
import { notFound, redirect } from "next/navigation";
import {
  HomeIcon,
  WrenchScrewdriverIcon,
  CheckCircleIcon,
  PhotoIcon,
  BuildingOffice2Icon,
  ArchiveBoxIcon,
} from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";
import PropertyDangerZone from "@/components/dashboard/PropertyDangerZone";

const TYPE_BADGE: Record<string, string> = {
  RESIDENTIAL: "bg-blue-100 text-blue-700",
  MIXED:       "bg-violet-100 text-violet-700",
  HOTEL:       "bg-amber-100 text-amber-700",
  COMMERCIAL:  "bg-green-100 text-green-700",
};
const TYPE_LABEL: Record<string, string> = {
  RESIDENTIAL: "Residential",
  MIXED:       "Mixed Use",
  HOTEL:       "Short-term",
  COMMERCIAL:  "Commercial",
};

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
      units:  { orderBy: { name: "asc" } },
      _count: { select: { units: true } },
    },
  });

  if (!property) notFound();
  if (property.organizationId !== dbUser?.organizationId) redirect("/dashboard");

  return (
    <div className="space-y-6">

      {/* ── Archived banner ───────────────────────────────────── */}
      {property.isArchived && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <ArchiveBoxIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900">This building is archived</p>
            <p className="mt-0.5 text-xs text-amber-700">
              It is hidden from all default views. All units, reservations, and historical data are preserved.
              {property.archivedAt && (
                <> Archived on {new Date(property.archivedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.</>
              )}
              {" "}Scroll down to restore it.
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
              <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold ${TYPE_BADGE[property.type] ?? "bg-gray-100 text-gray-600"}`}>
                {TYPE_LABEL[property.type] ?? property.type}
              </span>
              {property.isArchived ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                  <ArchiveBoxIcon className="h-3.5 w-3.5" /> Archived
                </span>
              ) : property.isActive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                  <CheckCircleIcon className="h-3.5 w-3.5" /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  <WrenchScrewdriverIcon className="h-3.5 w-3.5" /> Inactive
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {[property.address, property.city, property.governorate].filter(Boolean).join(", ")}
              {property.totalFloors ? ` · ${property.totalFloors} floor${property.totalFloors > 1 ? "s" : ""}` : ""}
            </p>
            {property.description && (
              <p className="mt-2 text-sm text-gray-600 max-w-2xl">{property.description}</p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 sm:ml-4 sm:mt-0">
          <Link
            href={`/dashboard/properties/${id}/edit`}
            className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Edit Property
          </Link>
          {!property.isArchived && (
            <Link
              href={`/dashboard/units/new?propertyId=${id}`}
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              + Add Unit
            </Link>
          )}
        </div>
      </div>

      {/* ── Photo Gallery ───────────────────────────────────────── */}
      {property.photos.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <PhotoIcon className="h-4 w-4 text-gray-400" /> Photos ({property.photos.length})
          </h3>
          <div className="flex flex-wrap gap-3">
            {property.photos.map((url) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                <div className="relative h-32 w-40 overflow-hidden rounded-xl ring-1 ring-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <Image src={url} alt="Property photo" fill className="object-cover" unoptimized />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Units Table ─────────────────────────────────────────── */}
      <div>
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          Units &amp; Rooms ({property._count.units})
        </h3>
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Name</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Floor</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Type</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Base Price</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {property.units.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-gray-500">
                    No units yet.{!property.isArchived && <> Click &ldquo;+ Add Unit&rdquo; to get started.</>}
                  </td>
                </tr>
              ) : (
                property.units.map((unit) => (
                  <tr key={unit.id} className={unit.status === "MAINTENANCE" ? "bg-amber-50" : "hover:bg-blue-50"}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                      <div className="flex items-center gap-2">
                        <HomeIcon className="h-4 w-4 text-gray-400" />
                        {unit.name}
                        {unit.photos.length > 0 && (
                          <span className="text-xs text-gray-400" title={`${unit.photos.length} photo(s)`}>
                            <PhotoIcon className="inline h-3.5 w-3.5" /> {unit.photos.length}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{unit.floor ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {unit.bedrooms} Bed / {unit.bathrooms} Bath
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold text-gray-800">
                      {Number(unit.basePrice).toFixed(3)}{" "}
                      <span className="text-xs font-normal text-gray-500">OMR</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      {unit.status === "AVAILABLE" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                          <CheckCircleIcon className="h-3 w-3" /> Available
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          <WrenchScrewdriverIcon className="h-3 w-3" /> Maintenance
                        </span>
                      )}
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <Link href={`/dashboard/units/${unit.id}/edit`} className="text-blue-600 hover:text-blue-900">
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Danger Zone ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-gray-700">Danger Zone</p>
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
