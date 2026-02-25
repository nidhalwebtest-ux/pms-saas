import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PrismaClient, Prisma } from "@prisma/client";
import {
  BanknotesIcon,
  ArrowTrendingDownIcon,
} from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";

import ExpenseFilters from "./ExpenseFilters";
import ListActionBar from "@/components/ui/list/ListActionBar";
import SortableHeader from "@/components/ui/list/SortableHeader";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const categoryFilter = params.category || "";
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
  const whereClause: Prisma.ExpenseWhereInput = {
    // Restrict to this Organization's properties
    property: { organizationId: dbUser?.organizationId! },
    ...(q && { title: { contains: q, mode: "insensitive" } }),
    ...(categoryFilter && { category: categoryFilter as any }),
    ...(propertyFilter && { propertyId: propertyFilter }),
  };

  // 3. Build OrderBy
  let orderByClause: any = { date: "desc" };
  if (sortParam === "oldest") orderByClause = { date: "asc" };
  if (sortParam === "amount_asc") orderByClause = { amount: "asc" };
  if (sortParam === "amount_desc") orderByClause = { amount: "desc" };
  if (sortParam === "title_asc") orderByClause = { title: "asc" };
  if (sortParam === "title_desc") orderByClause = { title: "desc" };

  // 4. Fetch Data
  const expenses = await prisma.expense.findMany({
    where: whereClause,
    include: { property: true },
    orderBy: orderByClause,
  });

  // Calculate Total Expenses of *filtered* results
  const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-8">
      {/* 1. Page Title & Action */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-md">
            <ArrowTrendingDownIcon className="h-6 w-6 text-red-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              Expenses & Bills
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Filtered Total:{" "}
              <span className="font-bold text-red-600">
                {totalAmount.toLocaleString("en-OM", {
                  style: "currency",
                  currency: "OMR",
                })}
              </span>
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Link
            href="/dashboard/expenses/new"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            Record Expense
          </Link>
        </div>
      </div>

      {/* 2. Filter Section */}
      <ExpenseFilters
        currentSearch={q}
        currentCategory={categoryFilter}
        currentProperty={propertyFilter}
        properties={properties}
      />

      {/* 3. Action Bar */}
      <ListActionBar totalResults={expenses.length} currentSort={sortParam} />

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
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-20"
                    >
                      View
                    </th>
                    <SortableHeader label="Date" sortKey="date" />
                    <SortableHeader label="Description" sortKey="title" />
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Property
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Category
                    </th>
                    <SortableHeader label="Amount" sortKey="amount" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {expenses.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-10 text-center text-sm text-gray-500"
                      >
                        No expenses found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((expense) => (
                      <tr
                        key={expense.id}
                        className="bg-white even:bg-gray-50 hover:bg-red-50 transition-colors"
                      >
                        <td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm font-mono text-gray-500 sm:pl-6">
                          {expense.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm font-medium">
                          {/* Note: In standard ERPs, ledgers usually have a view instead of edit, or you might want an edit page. I'll link to a view for now. */}
                          <Link
                            href={`/dashboard/expenses/${expense.id}`}
                            className="text-blue-600 hover:text-blue-900 font-semibold"
                          >
                            View
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500 font-medium">
                          {new Date(expense.date).toLocaleDateString()}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-900 font-medium">
                          {expense.title}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-blue-600 hover:underline">
                          <Link
                            href={`/dashboard/properties/${expense.propertyId}`}
                          >
                            {expense.property.name}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500 capitalize">
                          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                            {expense.category.toLowerCase()}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm font-bold text-red-600">
                          -{Number(expense.amount).toFixed(3)} OMR
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
