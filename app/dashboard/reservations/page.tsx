import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import {
  CalendarDaysIcon,
  UserIcon,
  HomeIcon,
} from "@heroicons/react/24/outline";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

export default async function ReservationsListPage() {
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

  const reservations = await prisma.reservation.findMany({
    where: {
      unit: { property: { organizationId: dbUser?.organizationId! } },
    },
    include: {
      tenant: true,
      unit: { include: { property: true } },
    },
    orderBy: { startDate: "desc" },
  });

  return (
    <div>
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Reservations
          </h2>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0">
          <Link
            href="/dashboard/reservations/new"
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            New Booking
          </Link>
        </div>
      </div>

      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900"
                >
                  Tenant
                </th>
                <th
                  scope="col"
                  className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                >
                  Unit
                </th>
                <th
                  scope="col"
                  className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                >
                  Dates
                </th>
                <th
                  scope="col"
                  className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="relative py-3.5 pl-3 pr-4 sm:pr-6"
                ></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {reservations.map((res) => (
                <tr key={res.id}>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm">
                    <div className="flex items-center font-medium text-gray-900">
                      <UserIcon className="mr-1.5 h-4 w-4 text-gray-400" />
                      {res.tenant.firstName} {res.tenant.lastName}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900 flex items-center">
                        <HomeIcon className="mr-1.5 h-4 w-4 text-gray-400" />
                        {res.unit.name}
                      </span>
                      <span className="text-xs text-gray-400 pl-6">
                        {res.unit.property.name}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
                      {new Date(res.startDate).toLocaleDateString()} -{" "}
                      {new Date(res.endDate).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                        res.status === "CONFIRMED"
                          ? "bg-green-50 text-green-700 ring-green-600/20"
                          : res.status === "CANCELLED"
                            ? "bg-red-50 text-red-700 ring-red-600/20"
                            : "bg-yellow-50 text-yellow-700 ring-yellow-600/20"
                      }`}
                    >
                      {res.status}
                    </span>
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <Link
                      href={`/dashboard/reservations/${res.id}`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
