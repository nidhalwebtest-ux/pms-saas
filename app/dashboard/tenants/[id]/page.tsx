import { createClient } from "@/utils/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  UserIcon,
  PencilSquareIcon,
  BanknotesIcon,
  PhoneIcon,
  IdentificationIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  EnvelopeIcon,
  MapPinIcon,
  ExclamationTriangleIcon,
  StarIcon,
  ShieldExclamationIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";

// ── Helpers ───────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">{value}</dd>
    </div>
  );
}

function ClassificationBadge({ value }: { value: string | null }) {
  if (value === "vip")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-sm font-semibold text-yellow-800 ring-1 ring-yellow-300">
        <StarIcon className="h-4 w-4" /> VIP Guest
      </span>
    );
  if (value === "blacklisted")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700 ring-1 ring-red-300">
        <ShieldExclamationIcon className="h-4 w-4" /> Blacklisted
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
      Regular
    </span>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  walk_in: "Walk-In",
  referral: "Referral",
  online: "Online",
  agent: "Agent",
  returning: "Returning",
  corporate_contract: "Corporate Contract",
};

const TYPE_LABELS: Record<string, string> = {
  individual: "Individual",
  family: "Family",
  corporate: "Corporate",
  government: "Government",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TenantProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      reservations: {
        include: {
          unit: { include: { property: { select: { name: true } } } },
          invoices: { include: { payments: true } },
        },
        orderBy: { startDate: "desc" },
      },
      payments: { orderBy: { date: "desc" }, take: 10 },
    },
  });

  if (!tenant || tenant.organizationId !== dbUser?.organizationId) {
    return notFound();
  }

  // Compute open balance
  let openBalance = 0;
  tenant.reservations.forEach((res) => {
    res.invoices.forEach((inv) => {
      if (inv.status === "PENDING" || inv.status === "DUE") {
        const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
        const rem = Number(inv.amount) - paid;
        if (rem > 0) openBalance += rem;
      }
    });
  });

  const isIdExpired = tenant.idExpiryDate && new Date(tenant.idExpiryDate) < new Date();

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">

      {/* Back nav */}
      <div className="mb-4">
        <Link href="/dashboard/tenants" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeftIcon className="h-4 w-4" /> Back to Tenants
        </Link>
      </div>

      {/* ── Header ── */}
      <div className="md:flex md:items-start md:justify-between mb-6 border-b border-gray-200 pb-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-blue-700">
              {tenant.firstName[0]}{tenant.lastName[0]}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">
                {tenant.firstName} {tenant.lastName}
              </h1>
              <ClassificationBadge value={tenant.classification} />
              {!tenant.isActive && (
                <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                  Inactive
                </span>
              )}
            </div>
            {tenant.fullNameArabic && (
              <p className="text-lg text-gray-500 mt-0.5" dir="rtl">{tenant.fullNameArabic}</p>
            )}
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
              <span>
                {TYPE_LABELS[tenant.tenantType ?? ""] ?? tenant.tenantType ?? "—"}
              </span>
              <span>•</span>
              <span>
                Since {new Date(tenant.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
              </span>
              {tenant.nationality && (
                <>
                  <span>•</span>
                  <span>{tenant.nationality}</span>
                </>
              )}
            </div>
            {/* Tags */}
            {tenant.tags && tenant.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {tenant.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex gap-3 md:mt-0 flex-shrink-0">
          <Link
            href={`/dashboard/tenants/${id}/edit`}
            className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            <PencilSquareIcon className="-ml-0.5 mr-1.5 h-4 w-4 text-gray-400" />
            Edit Profile
          </Link>
          <Link
            href={`/dashboard/payments/new?tenantId=${id}`}
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            <BanknotesIcon className="-ml-0.5 mr-1.5 h-4 w-4 text-blue-100" />
            Accept Payment
          </Link>
        </div>
      </div>

      {/* Blacklisted warning */}
      {tenant.classification === "blacklisted" && (
        <div className="mb-6 flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">This tenant is blacklisted.</p>
            {tenant.internalNotes && (
              <p className="text-sm text-red-700 mt-0.5">{tenant.internalNotes}</p>
            )}
          </div>
        </div>
      )}

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className={`bg-white rounded-lg shadow-sm p-4 border-l-4 ${openBalance > 0 ? "border-red-400" : "border-green-400"}`}>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Open Balance</p>
          <p className={`text-xl font-bold mt-1 ${openBalance > 0 ? "text-red-600" : "text-green-700"}`}>
            {openBalance.toFixed(3)} OMR
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-400">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Stays</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{tenant.totalStays ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-purple-400">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Spent</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{Number(tenant.totalSpent ?? 0).toFixed(3)} OMR</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-gray-300">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Source</p>
          <p className="text-sm font-semibold text-gray-900 mt-1">{SOURCE_LABELS[tenant.source ?? ""] ?? tenant.source ?? "—"}</p>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: Info cards */}
        <div className="lg:col-span-1 space-y-4">

          {/* Contact */}
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <PhoneIcon className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700">Contact</h3>
            </div>
            <dl className="px-4 divide-y divide-gray-100">
              <InfoRow label="Phone" value={tenant.phone} />
              <InfoRow label="Secondary" value={tenant.phoneSecondary} />
              <InfoRow label="WhatsApp" value={tenant.whatsappNumber} />
              <InfoRow label="Email" value={tenant.email} />
            </dl>
          </div>

          {/* Identification */}
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <IdentificationIcon className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700">Identification</h3>
            </div>
            <dl className="px-4 divide-y divide-gray-100">
              <InfoRow label="ID Type" value={tenant.idType?.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())} />
              <InfoRow label="ID Number" value={tenant.idNumber} />
              {tenant.idExpiryDate && (
                <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Expiry</dt>
                  <dd className={`mt-1 text-sm sm:col-span-2 sm:mt-0 flex items-center gap-1.5 ${isIdExpired ? "text-red-600 font-medium" : "text-gray-900"}`}>
                    {new Date(tenant.idExpiryDate).toLocaleDateString("en-GB")}
                    {isIdExpired && <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />}
                  </dd>
                </div>
              )}
              <InfoRow label="Gender" value={tenant.gender ? (tenant.gender === "M" ? "Male" : tenant.gender === "F" ? "Female" : tenant.gender) : null} />
              <InfoRow label="Date of Birth" value={tenant.dateOfBirth ? new Date(tenant.dateOfBirth).toLocaleDateString("en-GB") : null} />
            </dl>
            {/* ID document photos */}
            {(tenant.idDocumentFront || tenant.idDocumentBack) && (
              <div className="px-4 py-3 border-t border-gray-100 flex gap-3">
                {tenant.idDocumentFront && (
                  <a href={tenant.idDocumentFront} target="_blank" rel="noopener noreferrer">
                    <Image src={tenant.idDocumentFront} alt="ID Front" width={80} height={50} className="rounded object-cover ring-1 ring-gray-200" />
                  </a>
                )}
                {tenant.idDocumentBack && (
                  <a href={tenant.idDocumentBack} target="_blank" rel="noopener noreferrer">
                    <Image src={tenant.idDocumentBack} alt="ID Back" width={80} height={50} className="rounded object-cover ring-1 ring-gray-200" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Address */}
          {(tenant.country || tenant.city || tenant.addressLine) && (
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                <MapPinIcon className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">Address</h3>
              </div>
              <dl className="px-4 divide-y divide-gray-100">
                <InfoRow label="Country" value={tenant.country} />
                <InfoRow label="City" value={tenant.city} />
                <InfoRow label="Address" value={tenant.addressLine} />
              </dl>
            </div>
          )}

          {/* Emergency Contact */}
          {(tenant.emergencyContactName || tenant.emergencyContactPhone) && (
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                <ExclamationTriangleIcon className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">Emergency Contact</h3>
              </div>
              <dl className="px-4 divide-y divide-gray-100">
                <InfoRow label="Name" value={tenant.emergencyContactName} />
                <InfoRow label="Phone" value={tenant.emergencyContactPhone} />
                <InfoRow label="Relation" value={tenant.emergencyContactRelation} />
              </dl>
            </div>
          )}

          {/* Corporate */}
          {(tenant.tenantType === "corporate" || tenant.tenantType === "government") && tenant.corporateName && (
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">Organisation</h3>
              </div>
              <dl className="px-4 divide-y divide-gray-100">
                <InfoRow label="Company" value={tenant.corporateName} />
                <InfoRow label="Contact" value={tenant.corporateContact} />
              </dl>
            </div>
          )}

          {/* Preferences */}
          {(tenant.preferredFloor || tenant.preferredUnitType || tenant.preferredPaymentMethod || tenant.specialRequests) && (
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">Preferences</h3>
              </div>
              <dl className="px-4 divide-y divide-gray-100">
                <InfoRow label="Floor" value={tenant.preferredFloor} />
                <InfoRow label="Unit Type" value={tenant.preferredUnitType} />
                <InfoRow label="Payment" value={tenant.preferredPaymentMethod?.replace("_", " ")} />
                <InfoRow label="Requests" value={tenant.specialRequests} />
              </dl>
            </div>
          )}

          {/* Internal notes */}
          {tenant.internalNotes && tenant.classification !== "blacklisted" && (
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
              <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Internal Notes</p>
              <p className="text-sm text-amber-900 whitespace-pre-wrap">{tenant.internalNotes}</p>
            </div>
          )}
        </div>

        {/* RIGHT: History */}
        <div className="lg:col-span-2 space-y-4">

          {/* Lease history */}
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="px-4 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700">Lease / Reservation History</h3>
              <span className="ml-auto text-xs text-gray-400">{tenant.reservations.length} records</span>
            </div>
            {tenant.reservations.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">No reservations yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {tenant.reservations.map((res) => (
                  <li key={res.id} className="hover:bg-gray-50 transition-colors">
                    <Link href={`/dashboard/reservations/${res.id}`} className="block px-4 py-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-blue-600 truncate">
                            {res.unit.name}
                            <span className="ml-1 text-gray-500 font-normal">in {res.unit.property.name}</span>
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
                            <CalendarDaysIcon className="h-3.5 w-3.5" />
                            {new Date(res.startDate).toLocaleDateString("en-GB")} → {new Date(res.endDate).toLocaleDateString("en-GB")}
                          </div>
                        </div>
                        <span className={`flex-shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          res.status === "CONFIRMED" || res.status === "CHECKED_IN"
                            ? "bg-green-100 text-green-800"
                            : res.status === "CANCELLED"
                            ? "bg-red-100 text-red-800"
                            : res.status === "COMPLETED"
                            ? "bg-gray-100 text-gray-700"
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {res.status}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Payment history */}
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="px-4 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <BanknotesIcon className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700">Recent Payments</h3>
            </div>
            {tenant.payments.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">No payments recorded.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {tenant.payments.map((pay) => (
                  <li key={pay.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {Number(pay.amount).toFixed(3)} OMR
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(pay.date).toLocaleDateString("en-GB")}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 capitalize">
                        {pay.method.toLowerCase().replace("_", " ")}
                      </span>
                      {pay.reference && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[120px]">{pay.reference}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
