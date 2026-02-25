import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PrismaClient, Prisma } from "@prisma/client";
import { BanknotesIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";

import ListActionBar from "@/components/ui/list/ListActionBar";
import SortableHeader from "@/components/ui/list/SortableHeader";
import PaymentFilters from "./paymentFilters";

export default async function PaymentsListPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const methodFilter = params.method || "";
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

  // 1. Build Prisma Where Clause
  const whereClause: Prisma.PaymentWhereInput = {
    // Restrict to this Organization's tenants
    tenant: { organizationId: dbUser?.organizationId! },
    ...(q && {
      OR: [
        { tenant: { firstName: { contains: q, mode: "insensitive" } } },
        { tenant: { lastName: { contains: q, mode: "insensitive" } } },
        { reference: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(methodFilter && { method: methodFilter as any }),
  };

  // 2. Build OrderBy
  let orderByClause: any = { date: "desc" };
  if (sortParam === "oldest") orderByClause = { date: "asc" };
  if (sortParam === "amount_asc") orderByClause = { amount: "asc" };
  if (sortParam === "amount_desc") orderByClause = { amount: "desc" };
  if (sortParam === "tenant_asc")
    orderByClause = { tenant: { firstName: "asc" } };
  if (sortParam === "tenant_desc")
    orderByClause = { tenant: { firstName: "desc" } };

  // 3. Fetch Data
  const payments = await prisma.payment.findMany({
    where: whereClause,
    include: {
      tenant: true,
      invoice: true,
      reservation: { include: { unit: true } },
    },
    orderBy: orderByClause,
  });

  // Calculate Total Revenue of *filtered* results
  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-8">
      {/* 1. Page Title & Action */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-md">
            <BanknotesIcon className="h-6 w-6 text-green-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              Payments & Receipts
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Filtered Revenue:{" "}
              <span className="font-bold text-green-600">
                {totalRevenue.toLocaleString("en-OM", {
                  style: "currency",
                  currency: "OMR",
                })}
              </span>
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Link
            href="/dashboard/payments/new"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            Record Payment
          </Link>
        </div>
      </div>

      {/* 2. Filter Section */}
      <PaymentFilters currentSearch={q} currentMethod={methodFilter} />

      {/* 3. Action Bar */}
      <ListActionBar totalResults={payments.length} currentSort={sortParam} />

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
                      Receipt #
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-20"
                    >
                      View
                    </th>
                    <SortableHeader label="Date" sortKey="date" />
                    <SortableHeader label="Tenant" sortKey="tenant" />
                    <SortableHeader label="Amount" sortKey="amount" />
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Method
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Allocation
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Reference
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {payments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-10 text-center text-sm text-gray-500"
                      >
                        No transactions found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    payments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="bg-white even:bg-gray-50 hover:bg-blue-50 transition-colors"
                      >
                        <td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm font-mono text-gray-500 sm:pl-6">
                          {payment.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm font-medium">
                          <Link
                            href={`/dashboard/payments/${payment.id}`}
                            className="text-blue-600 hover:text-blue-900 font-semibold"
                          >
                            Receipt
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500 font-medium">
                          {new Date(payment.date).toLocaleDateString()}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-900">
                          <Link
                            href={`/dashboard/tenants/${payment.tenantId}`}
                            className="hover:underline font-medium text-blue-600"
                          >
                            {payment.tenant.firstName} {payment.tenant.lastName}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm font-bold text-green-600">
                          +{Number(payment.amount).toFixed(3)} OMR
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500 capitalize">
                          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                            {payment.method.toLowerCase().replace("_", " ")}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500">
                          {payment.invoice ? (
                            <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded w-fit border border-blue-100">
                              <DocumentTextIcon className="h-3 w-3" />
                              Inv #
                              {payment.invoice.id?.slice(0, 4).toUpperCase()}
                            </span>
                          ) : payment.reservation ? (
                            <span className="text-xs text-gray-500">
                              Res #
                              {payment.reservation.id.slice(0, 4).toUpperCase()}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 italic">
                              Unapplied Credit
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500">
                          {payment.reference || "-"}
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
