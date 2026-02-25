import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import { deleteExpense } from "../actions";
import Link from "next/link";
import {
  TrashIcon,
  CalendarDaysIcon,
  TagIcon,
  BanknotesIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";

import { prisma } from "@/lib/prisma";

export default async function ExpenseDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { property: true },
  });

  if (!expense || expense.property.organizationId !== dbUser?.organizationId) {
    return notFound();
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href="/dashboard/expenses"
          className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Back to Expenses
        </Link>
      </div>

      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-6 border-b border-gray-100 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{expense.title}</h2>
            <p className="text-sm text-gray-500 mt-1">
              Recorded on {new Date(expense.createdAt).toLocaleDateString()}
            </p>
          </div>
          <span className="inline-flex items-center rounded-md bg-white px-2.5 py-1 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-300 capitalize">
            {expense.category.toLowerCase()}
          </span>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-8">
          {/* Amount */}
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-50 rounded-lg">
              <BanknotesIcon className="h-8 w-8 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Amount Paid</p>
              <p className="text-3xl font-bold text-gray-900">
                {Number(expense.amount).toFixed(3)} OMR
              </p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-gray-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CalendarDaysIcon className="h-5 w-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">
                  Expense Date
                </span>
              </div>
              <p className="text-base text-gray-900 pl-7">
                {new Date(expense.date).toLocaleDateString()}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <TagIcon className="h-5 w-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">
                  Property
                </span>
              </div>
              <p className="text-base text-gray-900 pl-7">
                {expense.property.name}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end">
          <form action={deleteExpense}>
            <input type="hidden" name="id" value={expense.id} />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-inset ring-red-300 hover:bg-red-50 sm:w-auto"
            >
              <TrashIcon
                className="-ml-0.5 mr-1.5 h-5 w-5"
                aria-hidden="true"
              />
              Delete Expense
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
