import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BanknotesIcon,
  CreditCardIcon,
  UserIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";

const prisma = new PrismaClient();

export default async function PaymentsListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  // Fetch Payments (Latest First)
  const payments = await prisma.payment.findMany({
    where: {
      tenant: { organizationId: dbUser?.organizationId! },
    },
    include: {
      tenant: true,
      invoice: true, // To see if it paid a specific invoice
      reservation: {
        include: { unit: true },
      },
    },
    orderBy: { date: "desc" },
  });

  // Calculate Total Revenue (Simple Sum)
  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Payments & Transactions
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Total Revenue Collected:{" "}
            <span className="font-bold text-green-600">
              {totalRevenue.toLocaleString("en-OM", {
                style: "currency",
                currency: "OMR",
              })}
            </span>
          </p>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0">
          <Link
            href="/dashboard/payments/new"
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <BanknotesIcon
              className="-ml-0.5 mr-1.5 h-5 w-5"
              aria-hidden="true"
            />
            Record Payment
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                >
                  Date
                </th>
                <th
                  scope="col"
                  className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                >
                  Tenant
                </th>
                <th
                  scope="col"
                  className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                >
                  Amount
                </th>
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
                <th
                  scope="col"
                  className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                ></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {payments.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-sm text-gray-500"
                  >
                    No payments recorded yet.
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-500 sm:pl-6">
                      <div className="flex items-center gap-2">
                        <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
                        {new Date(payment.date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-gray-400" />
                        <Link
                          href={`/dashboard/tenants/${payment.tenantId}`}
                          className="hover:underline hover:text-blue-600"
                        >
                          {payment.tenant.firstName} {payment.tenant.lastName}
                        </Link>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-green-600">
                      +{Number(payment.amount).toFixed(3)} OMR
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 capitalize">
                      <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium ring-1 ring-inset ring-gray-500/10">
                        {payment.method.toLowerCase().replace("_", " ")}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {payment.invoice ? (
                        <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded w-fit">
                          <DocumentTextIcon className="h-3 w-3" />
                          Inv #
                          {payment.invoice.invoiceNumber?.slice(-4) || "..."}
                        </span>
                      ) : payment.reservation ? (
                        <span className="text-xs text-gray-500">
                          General (Res #{payment.reservation.id.slice(0, 4)})
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">
                          Unapplied Credit
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {payment.reference || "-"}
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <Link
                        href={`/dashboard/payments/${payment.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
