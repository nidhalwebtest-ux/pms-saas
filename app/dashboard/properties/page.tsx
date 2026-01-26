import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import {
  BuildingOfficeIcon,
  HomeIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";

const prisma = new PrismaClient();

export default async function PropertiesPage() {
  // 1. Fetch Data
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // Get the Org ID first
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  // Fetch Properties for this Organization
  const properties = await prisma.property.findMany({
    where: {
      organizationId: dbUser?.organizationId!,
    },
    include: {
      _count: {
        select: { units: true }, // Get the number of units/rooms automatically
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      {/* Header Section */}
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Properties
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your buildings, hotels, and compounds.
          </p>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0">
          <Link
            href="/dashboard/properties/new"
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Add Property
          </Link>
        </div>
      </div>

      {/* Empty State */}
      {properties.length === 0 ? (
        <div className="text-center rounded-lg border-2 border-dashed border-gray-300 p-12">
          <BuildingOfficeIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">
            No properties
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new property.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard/properties/new"
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              Add Property
            </Link>
          </div>
        </div>
      ) : (
        /* Grid Layout */
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <div
              key={property.id}
              className="col-span-1 divide-y divide-gray-200 rounded-lg bg-white shadow hover:shadow-md transition-shadow duration-200 border border-gray-100"
            >
              <div className="flex w-full items-center justify-between space-x-6 p-6">
                <div className="flex-1 truncate">
                  <div className="flex items-center space-x-3">
                    <h3 className="truncate text-sm font-medium text-gray-900">
                      {property.name}
                    </h3>
                    <span
                      className={`inline-flex flex-shrink-0 items-center rounded-full px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        property.type === "HOTEL"
                          ? "bg-purple-50 text-purple-700 ring-purple-600/20"
                          : "bg-green-50 text-green-700 ring-green-600/20"
                      }`}
                    >
                      {property.type}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-gray-500 flex items-center gap-1">
                    <MapPinIcon className="h-4 w-4" />
                    {property.city}, {property.governorate}
                  </p>
                </div>
                <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-100 flex items-center justify-center">
                  {/* Icon based on Type */}
                  {property.type === "HOTEL" ? (
                    <BuildingOfficeIcon className="h-6 w-6 text-gray-500" />
                  ) : (
                    <HomeIcon className="h-6 w-6 text-gray-500" />
                  )}
                </div>
              </div>
              <div>
                <div className="-mt-px flex divide-x divide-gray-200">
                  <div className="flex w-0 flex-1">
                    <Link
                      href={`/dashboard/properties/${property.id}`}
                      className="relative -mr-px inline-flex w-0 flex-1 items-center justify-center gap-x-3 rounded-bl-lg border border-transparent py-4 text-sm font-semibold text-gray-900 hover:text-blue-600"
                    >
                      View Details
                    </Link>
                  </div>
                  <div className="-ml-px flex w-0 flex-1">
                    <span className="relative inline-flex w-0 flex-1 items-center justify-center gap-x-2 rounded-br-lg border border-transparent py-4 text-sm text-gray-500">
                      <span className="font-bold text-gray-900">
                        {property._count.units}
                      </span>{" "}
                      Units
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
