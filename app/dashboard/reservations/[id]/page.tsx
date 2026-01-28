import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import {
  CalendarDaysIcon,
  MapPinIcon,
  UserIcon,
  BanknotesIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { updateReservationStatus } from "../actions";

const prisma = new PrismaClient();

export default async function ReservationDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 1. Fetch Data
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
    },
  });

  // 2. Security Check
  if (
    !reservation ||
    reservation.unit.property.organizationId !== dbUser?.organizationId
  ) {
    return notFound();
  }

  // Helper to calculate duration
  const days = Math.ceil(
    (new Date(reservation.endDate).getTime() -
      new Date(reservation.startDate).getTime()) /
      (1000 * 3600 * 24),
  );

  const totalPaid = reservation.payments.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );

  return (
    <div className="max-w-4xl mx-auto py-8">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900">
              Reservation #{reservation.id.slice(0, 6)}
            </h2>
            <span
              className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-sm font-medium border ${
                reservation.status === "CONFIRMED"
                  ? "bg-green-50 text-green-700 border-green-200"
                  : reservation.status === "CANCELLED"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
              }`}
            >
              {reservation.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Created on {new Date(reservation.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Card 1: The Unit & Tenant (The "Who & Where") */}
        <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl p-6">
          <h3 className="text-base font-semibold leading-6 text-gray-900 mb-4 border-b pb-2">
            Property Details
          </h3>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPinIcon className="h-5 w-5 text-gray-400 mt-1" />
              <div>
                <p className="font-medium text-gray-900">
                  {reservation.unit.property.name}
                </p>
                <p className="text-sm text-gray-500">
                  {reservation.unit.name} • {reservation.unit.property.city}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 pt-4">
              <UserIcon className="h-5 w-5 text-gray-400 mt-1" />
              <div>
                <p className="font-medium text-gray-900">
                  <Link
                    href={`/dashboard/tenants/${reservation.tenantId}`}
                    className="hover:underline text-blue-600"
                  >
                    {reservation.tenant.firstName} {reservation.tenant.lastName}
                  </Link>
                </p>
                <p className="text-sm text-gray-500">
                  {reservation.tenant.phone}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: The Contract (The "When & How Much") */}
        <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl p-6">
          <h3 className="text-base font-semibold leading-6 text-gray-900 mb-4 border-b pb-2">
            Lease Terms
          </h3>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <CalendarDaysIcon className="h-5 w-5 text-gray-400" />
              <div className="text-sm text-gray-700">
                <span className="font-medium">
                  {new Date(reservation.startDate).toLocaleDateString()}
                </span>
                <span className="mx-2">to</span>
                <span className="font-medium">
                  {new Date(reservation.endDate).toLocaleDateString()}
                </span>
                <span className="ml-2 text-gray-500">({days} Days)</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4">
              <BanknotesIcon className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">
                  {Number(reservation.amount).toFixed(3)} OMR
                </p>
                <p className="text-xs text-gray-500 uppercase">
                  {reservation.frequency}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 overflow-hidden bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold leading-6 text-gray-900">
              Payment History
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Total Collected:{" "}
              <span className="font-bold text-green-600">
                {totalPaid.toFixed(3)} OMR
              </span>
            </p>
          </div>
          <Link
            href={`/dashboard/reservations/${id}/payments/new`}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            + Add Payment
          </Link>
        </div>

        <ul role="list" className="divide-y divide-gray-200">
          {reservation.payments.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-gray-500">
              No payments recorded yet.
            </li>
          ) : (
            reservation.payments.map((payment) => (
              <li
                key={payment.id}
                className="px-4 py-4 sm:px-6 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {Number(payment.amount).toFixed(3)} OMR
                      <span className="ml-2 inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                        {payment.method.replace("_", " ")}
                      </span>
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(payment.date).toLocaleDateString()}
                      {payment.reference && ` • Ref: ${payment.reference}`}
                    </p>
                  </div>
                  {payment.notes && (
                    <p className="text-sm text-gray-500 italic max-w-xs truncate hidden sm:block">
                      "{payment.notes}"
                    </p>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* --- Action Buttons (Status Management) --- */}
      <div className="mt-8 border-t border-gray-200 pt-6">
        <h3 className="text-sm font-medium text-gray-900 mb-4">
          Management Actions
        </h3>

        <div className="flex gap-4">
          {/* 1. Check In / Complete Button */}
          {reservation.status === "CONFIRMED" && (
            <form action={updateReservationStatus}>
              <input type="hidden" name="id" value={reservation.id} />
              <input type="hidden" name="status" value="CHECKED_IN" />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
              >
                <CheckCircleIcon className="h-4 w-4" />
                Check In Guest
              </button>
            </form>
          )}

          {reservation.status === "CHECKED_IN" && (
            <form action={updateReservationStatus}>
              <input type="hidden" name="id" value={reservation.id} />
              <input type="hidden" name="status" value="COMPLETED" />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500"
              >
                <CheckCircleIcon className="h-4 w-4" />
                Mark Completed (Check Out)
              </button>
            </form>
          )}

          {/* 2. Cancel Button (Only if not already cancelled or completed) */}
          {["CONFIRMED", "PENDING"].includes(reservation.status) && (
            <form action={updateReservationStatus}>
              <input type="hidden" name="id" value={reservation.id} />
              <input type="hidden" name="status" value="CANCELLED" />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-inset ring-red-300 hover:bg-red-50"
              >
                <XCircleIcon className="h-4 w-4" />
                Cancel Reservation
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
