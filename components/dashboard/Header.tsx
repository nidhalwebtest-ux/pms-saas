"use client";

import { createClient } from "@/utils/supabase/client"; // You might need to create this client-side helper
import { useRouter } from "next/navigation";
import { MagnifyingGlassIcon, BellIcon } from "@heroicons/react/24/outline";

export default function Header({
  userEmail,
}: {
  userEmail: string | undefined;
}) {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 border-b border-gray-200">
      {/* 1. Logo Section */}
      <div className="flex items-center gap-x-4">
        <div className="h-8 w-8 rounded-md bg-blue-600 flex items-center justify-center">
          <span className="text-white font-bold text-lg">P</span>
        </div>
        <span className="text-lg font-semibold tracking-tight text-gray-900">
          OmRent <span className="text-xs text-gray-500 font-normal">v1.0</span>
        </span>
      </div>

      {/* 2. Search Bar (Centered & Wide) */}
      <div className="hidden sm:flex flex-1 max-w-md mx-8">
        <div className="relative w-full">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MagnifyingGlassIcon
              className="h-5 w-5 text-gray-400"
              aria-hidden="true"
            />
          </div>
          <input
            type="text"
            name="search"
            id="search"
            className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
            placeholder="Search properties, tenants, or invoices..."
          />
        </div>
      </div>

      {/* 3. Right Actions & Profile */}
      <div className="flex items-center gap-x-4 lg:gap-x-6">
        <button
          type="button"
          className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500"
        >
          <span className="sr-only">View notifications</span>
          <BellIcon className="h-6 w-6" aria-hidden="true" />
        </button>

        {/* Separator */}
        <div
          className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200"
          aria-hidden="true"
        />

        {/* Profile Dropdown (Simplified for MVP) */}
        <div className="flex items-center gap-x-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-gray-900">Admin User</p>
            <p className="text-xs text-gray-500">{userEmail}</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-md bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
