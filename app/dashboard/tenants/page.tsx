import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PrismaClient, Prisma } from "@prisma/client";
import { UserGroupIcon } from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";

import TenantFilters from "./TenantFilters";
import ListActionBar from "@/components/ui/list/ListActionBar";
import SortableHeader from "@/components/ui/list/SortableHeader";

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const nationalityFilter = params.nationality || "";
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

  // 1. Build Prisma Where Clause
  // We use OR to allow searching across multiple fields easily
  const whereClause: Prisma.TenantWhereInput = {
    organizationId: dbUser?.organizationId!,
    ...(q && {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { nationalId: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(nationalityFilter && {
      nationality:
        nationalityFilter === "Expat"
          ? { notIn: ["Omani", "Saudi", "Emirati"] } // Simple logic for 'Other'
          : { equals: nationalityFilter, mode: "insensitive" },
    }),
  };

  // 2. Build OrderBy
  let orderByClause: Prisma.TenantOrderByWithRelationInput = {
    createdAt: "desc",
  };
  if (sortParam === "oldest") orderByClause = { createdAt: "asc" };
  if (sortParam === "firstName_asc") orderByClause = { firstName: "asc" };
  if (sortParam === "firstName_desc") orderByClause = { firstName: "desc" };
  if (sortParam === "lastName_asc") orderByClause = { lastName: "asc" };
  if (sortParam === "lastName_desc") orderByClause = { lastName: "desc" };

  // 3. Fetch Data
  const tenants = await prisma.tenant.findMany({
    where: whereClause,
    orderBy: orderByClause,
  });

  return (
    <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-8">
      {/* 1. Page Title & Action */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-md">
            <UserGroupIcon className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              Tenants & Customers
            </h1>
          </div>
        </div>
        <div className="mt-3">
          <Link
            href="/dashboard/tenants/new"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            New Tenant
          </Link>
        </div>
      </div>

      {/* 2. Filter Section */}
      <TenantFilters currentSearch={q} currentNationality={nationalityFilter} />

      {/* 3. Action Bar */}
      <ListActionBar totalResults={tenants.length} currentSort={sortParam} />

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
                    <SortableHeader label="First Name" sortKey="firstName" />
                    <SortableHeader label="Last Name" sortKey="lastName" />
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Contact Info
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      ID / Passport
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Nationality
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {tenants.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-10 text-center text-sm text-gray-500"
                      >
                        No tenants found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    tenants.map((tenant) => (
                      <tr
                        key={tenant.id}
                        className="bg-white even:bg-gray-50 hover:bg-blue-50 transition-colors"
                      >
                        <td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm font-mono text-gray-500 sm:pl-6">
                          {tenant.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm font-medium">
                          <Link
                            href={`/dashboard/tenants/${tenant.id}/edit`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit
                          </Link>
                          <span className="text-gray-300 mx-2">|</span>
                          <Link
                            href={`/dashboard/tenants/${tenant.id}`}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            View
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-900 font-medium">
                          {tenant.firstName}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-900 font-medium">
                          {tenant.lastName}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500">
                          <div>{tenant.phone}</div>
                          <div className="text-xs text-gray-400">
                            {tenant.email || "No email"}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500">
                          {tenant.nationalId || "-"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500">
                          {tenant.nationality || "-"}
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
