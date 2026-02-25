import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PrismaClient, Prisma } from "@prisma/client";
import { BuildingOfficeIcon } from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";

// New Client Components we will create below
import PropertyFilters from "./PropertyFilters";
import ListActionBar from "@/components/ui/list/ListActionBar";
import SortableHeader from "@/components/ui/list/SortableHeader";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  // 1. Resolve Search Params (Next.js 15 requirement)
  const params = await searchParams;
  const q = params.q || "";
  const typeFilter = params.type || "";
  const sortParam = params.sort || "newest";
  const showInactive = params.inactive === "true";

  // 2. Auth & User context
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

  // 3. Build Prisma Where Clause dynamically based on filters
  const whereClause: Prisma.PropertyWhereInput = {
    organizationId: dbUser?.organizationId!,
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(typeFilter && { type: typeFilter as any }),
    // In the future, if you add an 'isActive' boolean to Property, handle it here:
    // isActive: showInactive ? undefined : true,
  };

  // 4. Build OrderBy
  let orderByClause: Prisma.PropertyOrderByWithRelationInput = {
    createdAt: "desc",
  };
  if (sortParam === "oldest") orderByClause = { createdAt: "asc" };
  if (sortParam === "name_asc") orderByClause = { name: "asc" };
  if (sortParam === "name_desc") orderByClause = { name: "desc" };
  if (sortParam === "type_asc") orderByClause = { type: "asc" };
  if (sortParam === "type_desc") orderByClause = { type: "desc" };
  if (sortParam === "city_asc") orderByClause = { city: "asc" };
  if (sortParam === "city_desc") orderByClause = { city: "desc" };

  // 5. Fetch Data
  const properties = await prisma.property.findMany({
    where: whereClause,
    include: { _count: { select: { units: true } } },
    orderBy: orderByClause,
  });

  return (
    <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-4">
      {/* 1. Page Title & Primary Action */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-md">
            <BuildingOfficeIcon className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              Properties List
            </h1>
          </div>
        </div>
        <div className="mt-3">
          <Link
            href="/dashboard/properties/new"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            New Property
          </Link>
        </div>
      </div>

      {/* 2. Filter Section (Client Component) */}
      <PropertyFilters currentSearch={q} currentType={typeFilter} />

      {/* 3. Action Bar (Export, Sort, Totals) */}
      <ListActionBar totalResults={properties.length} currentSort={sortParam} />

      {/* 4. The Standardized Data Table */}
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
                    <SortableHeader label="Property Name" sortKey="name" />
                    <SortableHeader label="Type" sortKey="type" />
                    <SortableHeader label="Location (City)" sortKey="city" />
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Units
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {properties.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-10 text-center text-sm text-gray-500"
                      >
                        No properties found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    properties.map((property) => (
                      <tr
                        key={property.id}
                        className="bg-white even:bg-gray-50 hover:bg-blue-50 transition-colors"
                      >
                        <td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm font-mono text-gray-500 sm:pl-6">
                          {property.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm font-medium">
                          <Link
                            href={`/dashboard/properties/${property.id}/edit`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit
                          </Link>
                          <span className="text-gray-300 mx-2">|</span>
                          <Link
                            href={`/dashboard/properties/${property.id}`}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            View
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-900 font-medium">
                          {property.name}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500">
                          {property.type}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500">
                          {property.city}, {property.governorate}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500">
                          {property._count.units} units
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
