import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Prisma } from "@prisma/client";
import {
  HomeModernIcon,
  CheckCircleIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";

import ListActionBar from "@/components/ui/list/ListActionBar";
import SortableHeader from "@/components/ui/list/SortableHeader";
import UnitFilters from "./UnitFilters";

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const propertyFilter = params.property || "";
  const sortParam = params.sort || "newest";
  const showInactive = params.inactive === "true";

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  // 1. Fetch properties for the filter dropdown
  const properties = await prisma.property.findMany({
    where: { organizationId: dbUser?.organizationId! },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // 2. Build Prisma Where Clause
  const whereClause: Prisma.UnitWhereInput = {
    // Ensure we only show units from properties belonging to this Org
    property: { organizationId: dbUser?.organizationId! },
    ...(q && { name: { contains: q, mode: "insensitive" } }),
    ...(propertyFilter && { propertyId: propertyFilter }),
    // When "Show Inactives" is OFF → only AVAILABLE units
    ...(!showInactive && { status: "AVAILABLE" as const }),
  };

  // 3. Build OrderBy
  let orderByClause: Prisma.UnitOrderByWithRelationInput = {
    createdAt: "desc",
  };
  if (sortParam === "oldest") orderByClause = { createdAt: "asc" };
  if (sortParam === "name_asc") orderByClause = { name: "asc" };
  if (sortParam === "name_desc") orderByClause = { name: "desc" };
  if (sortParam === "price_asc") orderByClause = { basePrice: "asc" };
  if (sortParam === "price_desc") orderByClause = { basePrice: "desc" };
  if (sortParam === "floor_asc") orderByClause = { floor: "asc" };
  if (sortParam === "floor_desc") orderByClause = { floor: "desc" };

  // 4. Fetch Data
  const units = await prisma.unit.findMany({
    where: whereClause,
    include: {
      property: { select: { name: true } }, // Fetch parent property name
    },
    orderBy: orderByClause,
  });

  return (
    <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-8">
      {/* 1. Page Title & Action */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-md">
            <HomeModernIcon className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              Units & Rooms List
            </h1>
          </div>
        </div>
        <div className="mt-3">
          {/* Note: You may need to update your new Unit page to be a top-level route /dashboard/units/new */}
          <Link
            href="/dashboard/units/new"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            New Unit
          </Link>
        </div>
      </div>

      {/* 2. Filter Section */}
      <UnitFilters
        currentSearch={q}
        currentProperty={propertyFilter}
        properties={properties}
      />

      {/* 3. Action Bar */}
      <ListActionBar totalResults={units.length} currentSort={sortParam} />

      {/* 4. Data Table */}
      <div className="mt-4 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-200">
                  <tr>
                    <th
                      scope="col"
                      className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 w-32"
                    >
                      Internal ID
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-24"
                    >
                      Edit | View
                    </th>

                    <SortableHeader label="Unit Name" sortKey="name" />
                    <SortableHeader label="Property" sortKey="property" />
                    <SortableHeader label="Floor" sortKey="floor" />
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Specs
                    </th>
                    <SortableHeader label="Base Price (OMR)" sortKey="price" />
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {units.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-10 text-center text-sm text-gray-500"
                      >
                        No units found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    units.map((unit) => (
                      <tr
                        key={unit.id}
                        className="bg-white even:bg-gray-50 hover:bg-blue-50 transition-colors"
                      >
                        <td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm font-mono text-gray-500 sm:pl-6">
                          {unit.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm font-medium">
                          <Link
                            href={`/dashboard/units/${unit.id}/edit`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit
                          </Link>
                          <span className="text-gray-300 mx-2">|</span>
                          <Link
                            href={`/dashboard/units/${unit.id}`}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            View
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-900 font-medium">
                          {unit.name}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-blue-600 hover:underline">
                          <Link
                            href={`/dashboard/properties/${unit.propertyId}`}
                          >
                            {unit.property.name}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500">
                          {unit.floor || "-"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500">
                          {unit.bedrooms} Bed / {unit.bathrooms} Bath
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-900 font-bold">
                          {Number(unit.basePrice).toFixed(3)}{" "}
                          <span className="text-xs font-normal text-gray-500">OMR</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm">
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
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
