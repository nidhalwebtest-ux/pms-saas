"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { name: "Overview", href: "/dashboard" },
  { name: "Properties", href: "/dashboard/properties" },
  { name: "Tenants", href: "/dashboard/tenants" },
  { name: "Leases", href: "/dashboard/leases" },
  { name: "Maintenance", href: "/dashboard/maintenance" },
  { name: "Financials", href: "/dashboard/financials" },
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="flex overflow-x-auto border-b border-gray-200 bg-gray-50 px-4 sm:px-6 lg:px-8">
      <div className="flex space-x-8">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={classNames(
                isActive
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
                "whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium",
              )}
            >
              {item.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
