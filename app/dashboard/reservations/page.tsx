import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PrismaClient, Prisma } from "@prisma/client";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";

import ReservationFilters from "./ReservationFilters";
import ListActionBar from "@/components/ui/list/ListActionBar";
import SortableHeader from "@/components/ui/list/SortableHeader";

export default async function ReservationsListPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const statusFilter = params.status || "";
  const propertyFilter = params.property || "";
  const sortParam = params.sort || "newest";

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
  const whereClause: Prisma.ReservationWhereInput = {
    // Restrict to this Organization's properties
    unit: { property: { organizationId: dbUser?.organizationId! } },
    ...(q && {
      OR: [
        { tenant: { firstName: { contains: q, mode: "insensitive" } } },
        { tenant: { lastName: { contains: q, mode: "insensitive" } } },
        { unit: { name: { contains: q, mode: "insensitive" } } },
      ],
    }),
    ...(statusFilter && { status: statusFilter as any }),
    ...(propertyFilter && { unit: { propertyId: propertyFilter } }),
  };

  // 3. Build OrderBy
  // We use type 'any' here briefly because nested relation sorting types in Prisma can be strict
  let orderByClause: any = { createdAt: "desc" };
  if (sortParam === "oldest") orderByClause = { createdAt: "asc" };
  if (sortParam === "tenant_asc")
    orderByClause = { tenant: { firstName: "asc" } };
  if (sortParam === "tenant_desc")
    orderByClause = { tenant: { firstName: "desc" } };
  if (sortParam === "start_asc") orderByClause = { startDate: "asc" };
  if (sortParam === "start_desc") orderByClause = { startDate: "desc" };
  if (sortParam === "status_asc") orderByClause = { status: "asc" };
  if (sortParam === "status_desc") orderByClause = { status: "desc" };

  // 4. Fetch Data
  const reservations = await prisma.reservation.findMany({
    where: whereClause,
    include: {
      tenant: true,
      unit: { include: { property: true } },
    },
    orderBy: orderByClause,
  });

  return (
    <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-8">
      {/* 1. Page Title & Action */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-md">
            <CalendarDaysIcon className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              Reservations & Leases
            </h1>
          </div>
        </div>
        <div className="mt-3">
          <Link
            href="/dashboard/reservations/new"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            New Booking
          </Link>
        </div>
      </div>

      {/* 2. Filter Section */}
      <ReservationFilters
        currentSearch={q}
        currentStatus={statusFilter}
        currentProperty={propertyFilter}
        properties={properties}
      />

      {/* 3. Action Bar */}
      <ListActionBar
        totalResults={reservations.length}
        currentSort={sortParam}
      />

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
                      Action
                    </th>

                    <SortableHeader label="Tenant" sortKey="tenant" />
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Unit & Property
                    </th>
                    <SortableHeader label="Start Date" sortKey="start" />
                    <SortableHeader label="Status" sortKey="status" />
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 pr-6"
                    >
                      Total Value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {reservations.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-10 text-center text-sm text-gray-500"
                      >
                        No reservations found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    reservations.map((res) => (
                      <tr
                        key={res.id}
                        className="bg-white even:bg-gray-50 hover:bg-blue-50 transition-colors"
                      >
                        <td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm font-mono text-gray-500 sm:pl-6">
                          {res.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm font-medium">
                          <Link
                            href={`/dashboard/reservations/${res.id}`}
                            className="text-blue-600 hover:text-blue-900 font-semibold"
                          >
                            View
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-900 font-medium">
                          <Link
                            href={`/dashboard/tenants/${res.tenantId}`}
                            className="hover:underline"
                          >
                            {res.tenant.firstName} {res.tenant.lastName}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500">
                          <div className="font-medium text-gray-900">
                            {res.unit?.name ?? "Multiple Units"}
                          </div>
                          <div className="text-xs text-gray-400">
                            {res.unit?.property.name ?? "—"}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500">
                          <div>
                            {new Date(res.startDate).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-400">
                            to {new Date(res.endDate).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                              res.status === "CONFIRMED" ||
                              res.status === "CHECKED_IN"
                                ? "bg-green-50 text-green-700 ring-green-600/20"
                                : res.status === "CANCELLED"
                                  ? "bg-red-50 text-red-700 ring-red-600/20"
                                  : res.status === "COMPLETED"
                                    ? "bg-gray-50 text-gray-600 ring-gray-500/10"
                                    : "bg-yellow-50 text-yellow-800 ring-yellow-600/20"
                            }`}
                          >
                            {res.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-900 font-bold text-right pr-6">
                          {Number(res.totalPrice).toFixed(3)}
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
