import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  PlusIcon,
  BanknotesIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

const prisma = new PrismaClient();

export default async function ExpensesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  // Fetch Expenses
  const expenses = await prisma.expense.findMany({
    where: { property: { organizationId: dbUser?.organizationId! } },
    include: { property: true },
    orderBy: { date: "desc" },
  });

  // Calculate Totals
  const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Expenses
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Track operating costs, maintenance, and bills.
          </p>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0">
          <Link
            href="/dashboard/expenses/new"
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
            Record Expense
          </Link>
        </div>
      </div>

      {/* List */}
      <div className="overflow-hidden bg-white shadow sm:rounded-md">
        <ul role="list" className="divide-y divide-gray-200">
          {expenses.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-gray-500">
              No expenses found.
            </li>
          ) : (
            expenses.map((expense) => (
              <li key={expense.id}>
                <Link
                  href={`/dashboard/expenses/${expense.id}`}
                  className="block hover:bg-gray-50"
                >
                  <div className="flex items-center px-4 py-4 sm:px-6">
                    <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between">
                      <div className="truncate">
                        <div className="flex text-sm">
                          <p className="truncate font-medium text-blue-600">
                            {expense.title}
                          </p>
                          <p className="ml-1 flex-shrink-0 font-normal text-gray-500">
                            in {expense.property.name}
                          </p>
                        </div>
                        <div className="mt-2 flex">
                          <div className="flex items-center text-sm text-gray-500">
                            <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 capitalize">
                              {expense.category.toLowerCase()}
                            </span>
                            <span className="mx-2 text-gray-300">•</span>
                            <p>{new Date(expense.date).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex-shrink-0 sm:mt-0 sm:ml-5">
                        <div className="flex items-center space-x-4">
                          <p className="text-sm font-bold text-gray-900">
                            -{Number(expense.amount).toFixed(3)} OMR
                          </p>
                          <ChevronRightIcon
                            className="h-5 w-5 text-gray-400"
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
