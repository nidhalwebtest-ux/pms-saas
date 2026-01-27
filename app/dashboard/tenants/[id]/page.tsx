import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import {
  UserIcon,
  PhoneIcon,
  EnvelopeIcon,
  IdentificationIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";

const prisma = new PrismaClient();

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

  // Fetch Tenant + Their Reservations (History)
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      reservations: {
        include: {
          unit: {
            include: { property: true },
          },
        },
        orderBy: { startDate: "desc" },
      },
    },
  });

  // 2. Security Check
  if (!tenant || tenant.organizationId !== dbUser?.organizationId) {
    return notFound();
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* --- Header Section --- */}
      <div className="md:flex md:items-center md:justify-between mb-8 border-b border-gray-200 pb-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <UserIcon className="h-6 w-6 text-blue-600" />
            </span>
            {tenant.firstName} {tenant.lastName}
          </h2>
          <p className="mt-2 text-sm text-gray-500 ml-14">
            Added on {new Date(tenant.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0">
          <Link
            href={`/dashboard/tenants/${id}/edit`}
            className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            <PencilSquareIcon
              className="-ml-0.5 mr-1.5 h-5 w-5 text-gray-400"
              aria-hidden="true"
            />
            Edit Profile
          </Link>
        </div>
      </div>

      {/* --- Details Grid --- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-8">
        {/* Card 1: Contact Info */}
        <div className="overflow-hidden bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 bg-gray-50">
            <h3 className="text-base font-semibold leading-6 text-gray-900">
              Contact Information
            </h3>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <PhoneIcon className="h-5 w-5 text-gray-400" />
              <a
                href={`tel:${tenant.phone}`}
                className="hover:text-blue-600 underline decoration-dotted"
              >
                {tenant.phone}
              </a>
            </div>
            {tenant.email && (
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                <a
                  href={`mailto:${tenant.email}`}
                  className="hover:text-blue-600 underline decoration-dotted"
                >
                  {tenant.email}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Identity (Oman Context) */}
        <div className="overflow-hidden bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 bg-gray-50">
            <h3 className="text-base font-semibold leading-6 text-gray-900">
              Identity Details
            </h3>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <IdentificationIcon className="h-5 w-5 text-gray-400" />
              <span className="font-medium">Civil ID / Passport:</span>
              <span>{tenant.nationalId || "Not Provided"}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <span className="h-5 w-5 flex items-center justify-center text-gray-400 text-xs font-bold border rounded-full border-gray-400">
                N
              </span>
              <span className="font-medium">Nationality:</span>
              <span>{tenant.nationality || "Not Provided"}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Financial Summary (Placeholder for future) */}
        <div className="overflow-hidden bg-white shadow sm:rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-sm font-medium text-gray-500">Total Spent</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            0.00 <span className="text-sm font-normal text-gray-500">OMR</span>
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Calculated from completed payments
          </p>
        </div>
      </div>

      {/* --- Reservation History Table --- */}
      <div className="overflow-hidden bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-semibold leading-6 text-gray-900">
            Lease & Booking History
          </h3>
          {/* We will link this button later */}
          <button
            disabled
            className="text-sm font-semibold text-gray-400 cursor-not-allowed"
          >
            + New Reservation
          </button>
        </div>

        <ul role="list" className="divide-y divide-gray-200">
          {tenant.reservations.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-gray-500">
              No history found. This tenant has not rented any units yet.
            </li>
          ) : (
            tenant.reservations.map((res) => (
              <li key={res.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
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
                        <p>
                          {new Date(res.startDate).toLocaleDateString()} &rarr;{" "}
                          {new Date(res.endDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="ml-2 flex flex-shrink-0 flex-col items-end gap-1">
                    <p
                      className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                        res.status === "CONFIRMED"
                          ? "bg-green-100 text-green-800"
                          : res.status === "CANCELLED"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {res.status}
                    </p>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
