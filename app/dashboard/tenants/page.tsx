import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import {
  UserIcon,
  PhoneIcon,
  IdentificationIcon,
} from "@heroicons/react/24/outline";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

export default async function TenantsPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id! },
    select: { organizationId: true },
  });

  const tenants = await prisma.tenant.findMany({
    where: { organizationId: dbUser?.organizationId! },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Tenants
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your residents and guests directory.
          </p>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0">
          <Link
            href="/dashboard/tenants/new"
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Add Tenant
          </Link>
        </div>
      </div>

      {/* List / Table */}
      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl overflow-hidden">
        <ul role="list" className="divide-y divide-gray-100">
          {tenants.length === 0 ? (
            <li className="p-8 text-center text-gray-500">
              No tenants found. Add one to get started.
            </li>
          ) : (
            tenants.map((tenant) => (
              <li
                key={tenant.id}
                className="relative flex justify-between gap-x-6 px-4 py-5 hover:bg-gray-50 sm:px-6"
              >
                <div className="flex min-w-0 gap-x-4">
                  <div className="h-12 w-12 flex-none rounded-full bg-blue-50 flex items-center justify-center">
                    <UserIcon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-auto">
                    <p className="text-sm font-semibold leading-6 text-gray-900">
                      <Link href={`/dashboard/tenants/${tenant.id}`}>
                        <span className="absolute inset-x-0 -top-px bottom-0" />
                        {tenant.firstName} {tenant.lastName}
                      </Link>
                    </p>
                    <p className="mt-1 flex text-xs leading-5 text-gray-500">
                      <IdentificationIcon className="h-4 w-4 mr-1" />
                      {tenant.nationalId ? `ID: ${tenant.nationalId}` : "No ID"}
                      {tenant.nationality && ` • ${tenant.nationality}`}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-x-4">
                  <div className="hidden sm:flex sm:flex-col sm:items-end">
                    <p className="text-sm leading-6 text-gray-900 flex items-center gap-1">
                      <PhoneIcon className="h-4 w-4 text-gray-400" />
                      {tenant.phone}
                    </p>
                    {tenant.email && (
                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        {tenant.email}
                      </p>
                    )}
                  </div>
                  <div className="h-5 w-5 flex-none text-gray-400">
                    <Link
                      className="text-xs font-medium text-blue-600 hover:text-blue-500"
                      href={`/dashboard/tenants/${tenant.id}`}
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
