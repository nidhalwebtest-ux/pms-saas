import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import {
  BanknotesIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  KeyIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

export default async function DashboardOverview() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });
  const orgId = dbUser?.organizationId!;

  // 1. Fetch KPI Data in Parallel (Fastest way)
  const [
    totalProperties,
    totalUnits,
    occupiedUnits,
    activeTenants,
    paymentsThisMonth,
  ] = await Promise.all([
    // Count Properties
    prisma.property.count({ where: { organizationId: orgId } }),

    // Count Total Units
    prisma.unit.count({
      where: { property: { organizationId: orgId } },
    }),

    // Count Occupied Units (Active Reservations)
    prisma.reservation.count({
      where: {
        unit: { property: { organizationId: orgId } },
        status: { in: ["CHECKED_IN", "CONFIRMED"] },
      },
    }),

    // Count Tenants
    prisma.tenant.count({ where: { organizationId: orgId } }),

    // Sum Payments for Current Month
    prisma.payment.aggregate({
      where: {
        reservation: { unit: { property: { organizationId: orgId } } },
        date: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // First day of this month
          lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1), // First day of next month
        },
      },
      _sum: { amount: true },
    }),
  ]);

  // 2. Calculate Occupancy %
  const occupancyRate =
    totalUnits > 0 ? ((occupiedUnits / totalUnits) * 100).toFixed(1) : "0";

  // 3. Stats Configuration
  const stats = [
    {
      name: "Monthly Revenue",
      stat: `${Number(paymentsThisMonth._sum.amount || 0).toFixed(3)} OMR`,
      icon: BanknotesIcon,
      color: "text-green-600",
      bg: "bg-green-100",
    },
    {
      name: "Occupancy Rate",
      stat: `${occupancyRate}%`,
      icon: ArrowTrendingUpIcon,
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
    {
      name: "Active Tenants",
      stat: activeTenants.toString(),
      icon: UserGroupIcon,
      color: "text-purple-600",
      bg: "bg-purple-100",
    },
    {
      name: "Total Properties",
      stat: totalProperties.toString(),
      icon: BuildingOfficeIcon,
      color: "text-gray-600",
      bg: "bg-gray-100",
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold leading-7 text-gray-900 mb-8">
        Dashboard Overview
      </h2>

      {/* KPI Grid */}
      <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <div
            key={item.name}
            className="relative overflow-hidden rounded-lg bg-white px-4 pt-5 pb-12 shadow sm:px-6 sm:pt-6"
          >
            <dt>
              <div className={`absolute rounded-md p-3 ${item.bg}`}>
                <item.icon
                  className={`h-6 w-6 ${item.color}`}
                  aria-hidden="true"
                />
              </div>
              <p className="ml-16 truncate text-sm font-medium text-gray-500">
                {item.name}
              </p>
            </dt>
            <dd className="ml-16 flex items-baseline pb-1 sm:pb-2">
              <p className="text-2xl font-semibold text-gray-900">
                {item.stat}
              </p>
            </dd>
          </div>
        ))}
      </dl>

      {/* Quick Actions & Recent Activity Container */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Left: Quick Actions */}
        <div className="bg-white shadow sm:rounded-lg p-6">
          <h3 className="text-base font-semibold leading-6 text-gray-900 mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              href="/dashboard/reservations/new"
              className="flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              <KeyIcon className="h-5 w-5" />
              New Reservation
            </Link>
            <Link
              href="/dashboard/tenants/new"
              className="flex items-center justify-center gap-2 rounded-md bg-white px-3 py-3 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              <UserGroupIcon className="h-5 w-5 text-gray-400" />
              Add Tenant
            </Link>
          </div>
        </div>

        {/* Right: Recent Activity (Placeholder for now) */}
        <div className="bg-white shadow sm:rounded-lg p-6">
          <h3 className="text-base font-semibold leading-6 text-gray-900 mb-4">
            System Status
          </h3>
          <div className="rounded-md bg-yellow-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <UserGroupIcon
                  className="h-5 w-5 text-yellow-400"
                  aria-hidden="true"
                />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Complete your setup
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    To get the most out of your dashboard, ensure all units have
                    base prices set and invite your staff members.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
