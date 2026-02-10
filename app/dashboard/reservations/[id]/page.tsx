import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server"; // Now this is allowed!
import { PrismaClient } from "@prisma/client";
import Link from "next/link";
import {
  MapPinIcon,
  UserIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  ClockIcon,
  DocumentTextIcon,
  CreditCardIcon,
} from "@heroicons/react/24/outline";

// Import Client Components
import StatusActions from "@/components/reservations/StatusActions";
import ConfirmReservationCard from "@/components/reservations/ConfirmReservationCard";

const prisma = new PrismaClient();

export default async function ReservationDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 1. Fetch Data (Server Side)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      tenant: true,
      unit: { include: { property: true } },
      payments: { orderBy: { date: "desc" } },
      invoices: { orderBy: { dueDate: "asc" } },
    },
  });

  // 2. Security Check
  if (
    !reservation ||
    reservation.unit.property.organizationId !== dbUser?.organizationId
  ) {
    return notFound();
  }

  // 3. Helper Calculations
  const startDate = new Date(reservation.startDate);
  const endDate = new Date(reservation.endDate);
  const days = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24),
  );

  const totalContractValue = Number(reservation.totalPrice);
  const totalPaid = reservation.payments.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );
  const remainingBalance = totalContractValue - totalPaid;
  const progressPercent = Math.min((totalPaid / totalContractValue) * 100, 100);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* --- HEADER --- */}
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900">
              Reservation #{reservation.id.slice(0, 8).toUpperCase()}
            </h2>
            <span
              className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-sm font-medium border ${
                reservation.status === "CONFIRMED"
                  ? "bg-green-50 text-green-700 border-green-200"
                  : reservation.status === "CANCELLED"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : reservation.status === "CHECKED_IN"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-gray-100 text-gray-800 border-gray-200"
              }`}
            >
              {reservation.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Created on {new Date(reservation.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* Management Actions (Client Component) */}
        <StatusActions id={reservation.id} status={reservation.status} />
      </div>

      {/* Confirmation Banner (Client Component) */}
      {reservation.status === "PENDING" && (
        <ConfirmReservationCard
          reservationId={reservation.id}
          frequency={reservation.frequency}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ... (Rest of the JSX remains exactly the same as before) ... */}

        {/* --- LEFT COLUMN (2/3 Width) --- */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Property & Tenant Details */}
          <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* ... */}
            {/* Note: Ensure imports like MapPinIcon are present in this file */}
            {/* ... */}
            <div>
              <h3 className="text-xs font-semibold uppercase text-gray-500 mb-3 tracking-wider">
                Property Information
              </h3>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <MapPinIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {reservation.unit.property.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {reservation.unit.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {reservation.unit.property.city}
                  </p>
                </div>
              </div>
            </div>

            {/* Tenant */}
            <div>
              <h3 className="text-xs font-semibold uppercase text-gray-500 mb-3 tracking-wider">
                Tenant Information
              </h3>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <UserIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <Link
                    href={`/dashboard/tenants/${reservation.tenantId}`}
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    {reservation.tenant.firstName} {reservation.tenant.lastName}
                  </Link>
                  <p className="text-sm text-gray-500">
                    {reservation.tenant.phone}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {reservation.tenant.email || "No email provided"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Contract Terms */}
          <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl p-6">
            {/* ... (Keep existing JSX) ... */}
            <h3 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              Lease Terms
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-500">Duration</p>
                <div className="flex items-center gap-2 mt-1">
                  <CalendarDaysIcon className="h-5 w-5 text-gray-400" />
                  <span className="font-medium text-gray-900">{days} Days</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {startDate.toLocaleDateString()} -{" "}
                  {endDate.toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Payment Frequency</p>
                <div className="flex items-center gap-2 mt-1">
                  <ClockIcon className="h-5 w-5 text-gray-400" />
                  <span className="font-medium text-gray-900 capitalize">
                    {reservation.frequency.toLowerCase()}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Rate</p>
                <div className="flex items-center gap-2 mt-1">
                  <BanknotesIcon className="h-5 w-5 text-gray-400" />
                  <span className="font-medium text-gray-900">
                    {Number(reservation.amount).toFixed(3)} OMR
                  </span>
                  <span className="text-xs text-gray-500">/ Period</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. PAYMENT SCHEDULE (Invoices) */}
          <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl overflow-hidden">
            {/* ... (Keep existing JSX) ... */}
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-2">
                <DocumentTextIcon className="h-5 w-5 text-gray-500" />
                <h3 className="text-base font-semibold text-gray-900">
                  Payment Schedule
                </h3>
              </div>
              <span className="text-xs font-medium bg-white border border-gray-200 text-gray-600 px-2.5 py-1 rounded-full shadow-sm">
                {reservation.invoices.length} Installments
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reservation.invoices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-8 text-center text-sm text-gray-500"
                      >
                        No invoices generated for this reservation.
                      </td>
                    </tr>
                  ) : (
                    reservation.invoices.map((inv) => {
                      // Smart Status Logic: Check if Overdue visually
                      const isOverdue =
                        inv.status === "PENDING" &&
                        new Date(inv.dueDate) < new Date();
                      const displayStatus = isOverdue ? "OVERDUE" : inv.status;

                      return (
                        <tr
                          key={inv.id}
                          className={isOverdue ? "bg-red-50/30" : ""}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(inv.dueDate).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">
                            {inv.description || "Installment"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {Number(inv.amount).toFixed(3)} OMR
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                                displayStatus === "PAID"
                                  ? "bg-green-50 text-green-700 ring-green-600/20"
                                  : displayStatus === "OVERDUE" ||
                                      displayStatus === "DUE"
                                    ? "bg-red-50 text-red-700 ring-red-600/20"
                                    : displayStatus === "VOID"
                                      ? "bg-gray-50 text-gray-600 ring-gray-500/10"
                                      : "bg-yellow-50 text-yellow-800 ring-yellow-600/20"
                              }`}
                            >
                              {displayStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {inv.status === "PENDING" ||
                            inv.status === "DUE" ? (
                              <Link
                                href={`/dashboard/reservations/${id}/payments/new?invoiceId=${inv.id}`}
                                className="text-blue-600 hover:text-blue-900 hover:underline"
                              >
                                Pay Now
                              </Link>
                            ) : (
                              <span className="text-gray-400 text-xs">
                                Closed
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* --- RIGHT COLUMN (Financial Summary) --- */}
        <div className="space-y-6">
          {/* ... (Keep existing Financial Card) ... */}
          <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <CreditCardIcon className="h-5 w-5 text-gray-500" />
              Financial Overview
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Contract Value</span>
                <span className="font-medium text-gray-900">
                  {totalContractValue.toFixed(3)} OMR
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Collected</span>
                <span className="font-medium text-green-600">
                  {totalPaid > 0 ? "+" : ""}
                  {totalPaid.toFixed(3)} OMR
                </span>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                <span className="font-medium text-gray-900">Balance Due</span>
                <span className="text-2xl font-bold text-gray-900">
                  {remainingBalance.toFixed(3)}{" "}
                  <span className="text-sm font-normal text-gray-500">OMR</span>
                </span>
              </div>

              {/* Progress Bar */}
              <div className="relative pt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Payment Progress</span>
                  <span className="font-medium text-gray-700">
                    {progressPercent.toFixed(0)}%
                  </span>
                </div>
                <div className="overflow-hidden h-2 text-xs flex rounded-full bg-gray-100">
                  <div
                    style={{ width: `${progressPercent}%` }}
                    className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ${
                      progressPercent === 100 ? "bg-green-500" : "bg-blue-600"
                    }`}
                  ></div>
                </div>
              </div>

              <Link
                href={`/dashboard/reservations/${id}/payments/new`}
                className="block w-full text-center rounded-md bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors mt-4"
              >
                Record General Payment
              </Link>
            </div>
          </div>

          {/* Payment History */}
          <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl p-6">
            {/* ... (Keep existing JSX) ... */}
            <h3 className="text-sm font-semibold text-gray-900 mb-4 border-b border-gray-100 pb-2">
              Recent Transactions
            </h3>
            <ul className="space-y-4">
              {reservation.payments.length === 0 ? (
                <p className="text-sm text-gray-500 italic py-2 text-center">
                  No transactions recorded yet.
                </p>
              ) : (
                reservation.payments.slice(0, 5).map((p) => (
                  <li
                    key={p.id}
                    className="flex justify-between items-center text-sm"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        +{Number(p.amount).toFixed(3)} OMR
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(p.date).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded capitalize">
                      {p.method.toLowerCase().replace("_", " ")}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
