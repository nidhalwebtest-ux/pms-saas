import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import Link from "next/link";
import {
  PrinterIcon,
  CheckCircleIcon,
  UserIcon,
  HomeModernIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import PrintButton from "@/components/ui/PrintButton";

import { prisma } from "@/lib/prisma";

export default async function PaymentDetailsPage({
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

  // Fetch Payment with all relations (Reservation, Tenant, Unit, Property, Invoice)
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      reservation: {
        include: {
          unit: { include: { property: true } },
        },
      },
      invoice: true,
      tenant: true,
    },
  });

  // 2. Security Check (Ensure payment belongs to the user's organization)
  if (!payment || payment.tenant.organizationId !== dbUser?.organizationId) {
    return notFound();
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* --- Action Bar --- */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link
            href="/dashboard/payments"
            className="hover:text-gray-900 hover:underline"
          >
            Payments
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">
            Receipt {payment.id.slice(0, 8).toUpperCase()}
          </span>
        </div>

        {/* Simple browser print function for MVP */}
        <PrintButton />
      </div>

      {/* --- The Receipt Card --- */}
      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl overflow-hidden">
        {/* Header / Amount */}
        <div className="bg-blue-600 px-6 py-8 text-center text-white sm:px-10">
          <CheckCircleIcon className="mx-auto h-12 w-12 text-blue-200 mb-4" />
          <p className="text-sm font-medium text-blue-100 uppercase tracking-widest mb-1">
            Payment Successful
          </p>
          <h1 className="text-4xl font-bold tracking-tight">
            {Number(payment.amount).toFixed(3)}{" "}
            <span className="text-2xl font-normal opacity-80">OMR</span>
          </h1>
          <p className="mt-4 text-sm text-blue-100">
            Paid on {new Date(payment.date).toLocaleDateString()} at{" "}
            {new Date(payment.date).toLocaleTimeString()}
          </p>
        </div>

        {/* Details Grid */}
        <div className="px-6 py-8 sm:p-10">
          <div className="grid grid-cols-1 gap-y-8 sm:grid-cols-2 sm:gap-x-8">
            {/* 1. Transaction Info */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2 border-b pb-2">
                <DocumentTextIcon className="h-4 w-4" /> Transaction Details
              </h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Receipt No.</dt>
                  <dd className="font-medium text-gray-900 font-mono">
                    #{payment.id.slice(0, 8).toUpperCase()}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Payment Method</dt>
                  <dd className="font-medium text-gray-900 capitalize">
                    {payment.method.toLowerCase().replace("_", " ")}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Reference / Cheque</dt>
                  <dd className="font-medium text-gray-900">
                    {payment.reference || "N/A"}
                  </dd>
                </div>
                {payment.invoice && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Linked Invoice</dt>
                    <dd className="font-medium text-gray-900">
                      {payment.invoice.invoiceNumber}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* 2. Tenant Info */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2 border-b pb-2">
                <UserIcon className="h-4 w-4" /> Received From
              </h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Name</dt>
                  <dd className="font-medium text-blue-600 hover:underline">
                    <Link href={`/dashboard/tenants/${payment.tenant.id}`}>
                      {payment.tenant.firstName} {payment.tenant.lastName}
                    </Link>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Phone</dt>
                  <dd className="font-medium text-gray-900">
                    {payment.tenant.phone}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">ID / Passport</dt>
                  <dd className="font-medium text-gray-900">
                    {payment.tenant.nationalId || "N/A"}
                  </dd>
                </div>
              </dl>
            </div>

            {/* 3. Property / Contract Info */}
            {payment.reservation && (
              <div className="sm:col-span-2 mt-4">
                <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2 border-b pb-2">
                  <HomeModernIcon className="h-4 w-4" /> Payment For
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between border border-gray-100">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {payment.reservation.unit.property.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      Unit: {payment.reservation.unit.name}
                    </p>
                  </div>
                  <div className="mt-4 sm:mt-0 text-right">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Contract ID
                    </p>
                    <Link
                      href={`/dashboard/reservations/${payment.reservation.id}`}
                      className="font-medium font-mono text-blue-600 hover:underline"
                    >
                      #{payment.reservation.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 text-center text-xs text-gray-500">
          This is a computer-generated receipt and does not require a physical
          signature.
        </div>
      </div>
    </div>
  );
}
