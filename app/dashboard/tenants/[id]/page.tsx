import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  UserIcon,
  PencilSquareIcon,
  BanknotesIcon,
  PhoneIcon,
  IdentificationIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";

import { prisma } from "@/lib/prisma";

export default async function TenantDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 1. Auth & Data Fetching
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  // Fetch Tenant + Reservations + Payments
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      reservations: {
        include: {
          unit: { include: { property: true } },
          // Fetch invoices to calc balance
          invoices: { include: { payments: true } },
        },
        orderBy: { startDate: "desc" },
      },
      // Fetch Payments history
      payments: {
        orderBy: { date: "desc" },
      },
    },
  });

  // 2. Security Check
  if (!tenant || tenant.organizationId !== dbUser?.organizationId) {
    return notFound();
  }

  // 3. CALCULATE FINANCIALS (Real-time)

  let openBalance = 0;
  tenant.reservations.forEach((res) => {
    res.invoices.forEach((inv) => {
      if (inv.status === "PENDING" || inv.status === "DUE") {
        const invoiceTotal = Number(inv.amount);
        // Sum all payments made towards THIS specific invoice
        const paidTowardsInvoice = inv.payments.reduce(
          (sum, p) => sum + Number(p.amount),
          0,
        );

        const remaining = invoiceTotal - paidTowardsInvoice;
        if (remaining > 0) {
          openBalance += remaining;
        }
      }
    });
  });

  // Adjustment: If we have partial payments linked to open invoices, we subtract them to show accurate "Remaining Balance"
  // This requires a deeper query (fetching payments per invoice), which we didn't do above for simplicity.
  // For precise balance, 'getTenantFinancials' action logic is best, but let's estimate here or accept the 'Total Invoice Amount' for MVP.

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* --- Header Section --- */}
      <div className="md:flex md:items-center md:justify-between mb-8 border-b border-gray-200 pb-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <UserIcon className="h-7 w-7 text-blue-600" />
            </span>
            {tenant.firstName} {tenant.lastName}
          </h2>
          <div className="mt-2 flex items-center text-sm text-gray-500 ml-16">
            <span>
              Customer since {new Date(tenant.createdAt).toLocaleDateString()}
            </span>
            <span className="mx-2">•</span>
            <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium border border-green-200">
              Active
            </span>
          </div>
        </div>
        <div className="mt-4 flex gap-3 md:ml-4 md:mt-0">
          <Link
            href={`/dashboard/tenants/${id}/edit`}
            className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            <PencilSquareIcon className="-ml-0.5 mr-1.5 h-5 w-5 text-gray-400" />
            Edit Profile
          </Link>
          <Link
            href={`/dashboard/payments/new`} // Could pass query param ?tenantId=...
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            <BanknotesIcon className="-ml-0.5 mr-1.5 h-5 w-5 text-blue-100" />
            Accept Payment
          </Link>
        </div>
      </div>

      {/* --- Key Metrics Grid --- */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {/* Contact */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <PhoneIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Phone
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-sm font-semibold text-gray-900">
                      {tenant.phone}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* ID */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <IdentificationIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    ID / Passport
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-sm font-semibold text-gray-900">
                      {tenant.nationalId || "-"}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Open Balance */}
        <div
          className={`bg-white overflow-hidden shadow rounded-lg border-l-4 ${openBalance > 0 ? "border-red-500" : "border-gray-200"}`}
        >
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DocumentTextIcon
                  className={`h-6 w-6 ${openBalance > 0 ? "text-red-500" : "text-gray-400"}`}
                />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Current Balance
                  </dt>
                  <dd className="flex items-baseline">
                    <div
                      className={`text-xl font-bold ${openBalance > 0 ? "text-red-600" : "text-gray-900"}`}
                    >
                      {openBalance.toFixed(3)} OMR
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* --- LEFT: Reservation History --- */}
        <div className="bg-white shadow sm:rounded-lg overflow-hidden flex flex-col h-full">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50">
            <h3 className="text-base font-semibold leading-6 text-gray-900">
              Lease History
            </h3>
          </div>
          <ul role="list" className="divide-y divide-gray-200 flex-grow">
            {tenant.reservations.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-gray-500">
                No history found.
              </li>
            ) : (
              tenant.reservations.map((res) => (
                <li key={res.id} className="hover:bg-gray-50 transition-colors">
                  <Link
                    href={`/dashboard/reservations/${res.id}`}
                    className="block px-4 py-4 sm:px-6"
                  >
                    <div className="flex items-center justify-between">
                      <div className="truncate">
                        <div className="flex text-sm">
                          <p className="truncate font-medium text-blue-600">
                            {res.unit.name}
                          </p>
                          <p className="ml-1 flex-shrink-0 font-normal text-gray-500">
                            in {res.unit.property.name}
                          </p>
                        </div>
                        <div className="mt-2 flex">
                          <div className="flex items-center text-sm text-gray-500">
                            <CalendarDaysIcon className="mr-1.5 h-4 w-4 text-gray-400" />
                            <p>
                              {new Date(res.startDate).toLocaleDateString()}{" "}
                              &rarr;{" "}
                              {new Date(res.endDate).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="ml-2 flex flex-shrink-0 flex-col items-end gap-1">
                        <span
                          className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                            res.status === "CONFIRMED"
                              ? "bg-green-100 text-green-800"
                              : res.status === "CANCELLED"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {res.status}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* --- RIGHT: Payment History --- */}
        <div className="bg-white shadow sm:rounded-lg overflow-hidden flex flex-col h-full">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50">
            <h3 className="text-base font-semibold leading-6 text-gray-900">
              Recent Transactions
            </h3>
          </div>
          <ul role="list" className="divide-y divide-gray-200 flex-grow">
            {tenant.payments.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-gray-500">
                No payments recorded.
              </li>
            ) : (
              tenant.payments.slice(0, 10).map((pay) => (
                <li key={pay.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        +{Number(pay.amount).toFixed(3)} OMR
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(pay.date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 capitalize">
                        {pay.method.toLowerCase().replace("_", " ")}
                      </span>
                      {pay.reference && (
                        <p className="text-xs text-gray-400 mt-1 max-w-[100px] truncate">
                          {pay.reference}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
