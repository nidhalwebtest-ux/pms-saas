import Link from "next/link";
import { ReactNode } from "react";
import { PlusIcon, MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";

// --- 1. The List Page Header ---
interface ListHeaderProps {
  title: string;
  description?: string;
  searchPlaceholder?: string;
  primaryAction?: {
    label: string;
    href: string;
  };
}

export function ListHeader({
  title,
  description,
  searchPlaceholder,
  primaryAction,
}: ListHeaderProps) {
  return (
    <div className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6 mb-6 rounded-lg shadow-sm">
      <div className="-ml-4 -mt-2 flex flex-wrap items-center justify-between sm:flex-nowrap">
        {/* Title Section */}
        <div className="ml-4 mt-2">
          <h3 className="text-xl font-bold leading-6 text-gray-900">{title}</h3>
          {description && (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          )}
        </div>

        {/* Actions Section */}
        <div className="ml-4 mt-2 flex-shrink-0 flex gap-3">
          {/* Search Bar (Visual Only for now) */}
          {searchPlaceholder && (
            <div className="relative rounded-md shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon
                  className="h-4 w-4 text-gray-400"
                  aria-hidden="true"
                />
              </div>
              <input
                type="text"
                placeholder={searchPlaceholder}
                className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              />
            </div>
          )}

          {/* Primary Button */}
          {primaryAction && (
            <Link
              href={primaryAction.href}
              className="relative inline-flex items-center gap-x-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <PlusIcon className="-ml-0.5 h-5 w-5" aria-hidden="true" />
              {primaryAction.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// --- 2. The Table Container ---
export function ListTable({ children }: { children: ReactNode }) {
  return (
    <div className="flow-root">
      <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg bg-white">
            <table className="min-w-full divide-y divide-gray-300">
              {children}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- 3. Table Header Cell ---
export function ListTh({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={clsx(
        "py-3.5 pl-4 pr-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500 sm:pl-6",
        className,
      )}
    >
      {children}
    </th>
  );
}

// --- 4. Table Body Cell ---
export function ListTd({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td
      className={clsx(
        "whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6",
        className,
      )}
    >
      {children}
    </td>
  );
}

// --- 5. Empty State ---
export function ListEmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="text-center py-20 bg-white rounded-lg shadow-sm border border-gray-200 border-dashed">
      <h3 className="mt-2 text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
      {actionLabel && actionHref && (
        <div className="mt-6">
          <Link
            href={actionHref}
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
            {actionLabel}
          </Link>
        </div>
      )}
    </div>
  );
}
