"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDownIcon } from "@heroicons/react/20/solid";

// --- 1. Configuration: Define your menu here ---
const navigationConfig = [
  {
    name: "Dashboard",
    href: "/dashboard",
  },
  {
    name: "Properties",
    href: "/dashboard/properties",
    // Example: You could add 'Add Property' here if you wanted
    // children: [ { name: 'All Properties', href: '/dashboard/properties' }, ... ]
  },
  {
    name: "Tenants",
    href: "/dashboard/tenants",
  },
  {
    name: "Reservations",
    href: "/dashboard/reservations",
  },
  {
    name: "Settings",
    href: "/dashboard/settings", // Parent path for highlighting
    children: [
      { name: "Team Management", href: "/dashboard/settings/team" },
      { name: "My Profile", href: "/dashboard/settings/profile" },
      // Add more settings here effortlessly
    ],
  },
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="flex overflow-x-visible border-b border-gray-200 bg-gray-50 px-4 sm:px-6 lg:px-8 z-50 relative">
      <div className="flex space-x-8">
        {navigationConfig.map((item) => {
          // Check if this item (or its children) is active
          const isActive =
            pathname === item.href ||
            (item.children && pathname.startsWith(item.href));
          const hasDropdown = item.children && item.children.length > 0;

          return (
            <div
              key={item.name}
              className="relative group flex items-center h-full"
            >
              {/* Main Tab Link/Button */}
              <Link
                href={item.href}
                className={classNames(
                  isActive
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
                  "inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium whitespace-nowrap",
                )}
              >
                {item.name}
                {hasDropdown && (
                  <ChevronDownIcon
                    className={classNames(
                      isActive
                        ? "text-blue-600"
                        : "text-gray-400 group-hover:text-gray-700",
                      "ml-2 h-4 w-4 transition-transform duration-200 group-hover:rotate-180",
                    )}
                  />
                )}
              </Link>

              {/* Dropdown Menu (Only renders if children exist) */}
              {hasDropdown && (
                <div className="absolute left-0 top-full hidden pt-1 w-56 group-hover:block z-50">
                  {/* The actual white card */}
                  <div className="rounded-md bg-white py-2 shadow-lg ring-1 ring-black ring-opacity-5">
                    {item.children!.map((child) => (
                      <Link
                        key={child.name}
                        href={child.href}
                        className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors"
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
