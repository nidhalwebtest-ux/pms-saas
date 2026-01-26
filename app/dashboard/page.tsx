import { createClient } from "@/utils/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Placeholder: In the future, we will fetch real counts here
  // const { count: propertyCount } = await supabase.from('properties').select('*', { count: 'exact' });

  return (
    <div>
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Dashboard Overview
          </h2>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0">
          <Link
            href="/dashboard/properties/new"
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Add New Property
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {[
          { name: "Total Properties", stat: "0", icon: "🏢" },
          { name: "Occupancy Rate", stat: "0%", icon: "👥" },
          { name: "Outstanding Rent", stat: "OMR 0.00", icon: "💰" },
        ].map((item) => (
          <div
            key={item.name}
            className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 border border-gray-100"
          >
            <dt className="truncate text-sm font-medium text-gray-500">
              {item.name}
            </dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900 flex items-baseline gap-2">
              <span>{item.stat}</span>
              <span className="text-xl">{item.icon}</span>
            </dd>
          </div>
        ))}
      </dl>

      {/* Empty State / Call to Action */}
      <div className="mt-8 text-center rounded-lg border-2 border-dashed border-gray-300 p-12 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
        <h3 className="mt-2 text-sm font-semibold text-gray-900">
          No properties added
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by creating a new property.
        </p>
        <div className="mt-6">
          <button
            type="button"
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Add Property
          </button>
        </div>
      </div>
    </div>
  );
}
