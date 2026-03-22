import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Prisma } from "@prisma/client";
import {
  UserGroupIcon,
  EyeIcon,
  PencilSquareIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";
import TenantFilters from "./TenantFilters";

// ── Helpers ───────────────────────────────────────────────────────────────────

function ClassificationBadge({ value }: { value: string | null }) {
  if (!value || value === "regular")
    return <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Regular</span>;
  if (value === "vip")
    return <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">⭐ VIP</span>;
  if (value === "blacklisted")
    return <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">🚫 Blacklisted</span>;
  return <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 capitalize">{value}</span>;
}

function TypeBadge({ value }: { value: string | null }) {
  const map: Record<string, string> = {
    individual: "bg-blue-50 text-blue-700",
    family: "bg-purple-50 text-purple-700",
    corporate: "bg-orange-50 text-orange-700",
    government: "bg-teal-50 text-teal-700",
  };
  const cls = map[value ?? ""] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {(value ?? "—").replace("_", " ")}
    </span>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  walk_in: "Walk-In",
  referral: "Referral",
  online: "Online",
  agent: "Agent",
  returning: "Returning",
  corporate_contract: "Corporate",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const q              = params.q              || "";
  const classification = params.classification || "";
  const tenantType     = params.tenantType     || "";
  const source         = params.source         || "";
  const sortParam      = params.sort           || "newest";

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  const where: Prisma.TenantWhereInput = {
    organizationId: dbUser?.organizationId!,
    ...(q && {
      OR: [
        { firstName:   { contains: q, mode: "insensitive" } },
        { lastName:    { contains: q, mode: "insensitive" } },
        { phone:       { contains: q, mode: "insensitive" } },
        { idNumber:    { contains: q, mode: "insensitive" } },
        { email:       { contains: q, mode: "insensitive" } },
        { nationality: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(classification && { classification }),
    ...(tenantType     && { tenantType }),
    ...(source         && { source }),
  };

  let orderBy: Prisma.TenantOrderByWithRelationInput = { createdAt: "desc" };
  if (sortParam === "oldest")        orderBy = { createdAt: "asc" };
  if (sortParam === "firstName_asc") orderBy = { firstName: "asc" };
  if (sortParam === "lastName_asc")  orderBy = { lastName:  "asc" };
  if (sortParam === "stays_desc")    orderBy = { totalStays: "desc" };

  const tenants = await prisma.tenant.findMany({
    where,
    orderBy,
    select: {
      id: true, firstName: true, lastName: true, phone: true, email: true,
      nationality: true, idType: true, idNumber: true, tenantType: true,
      source: true, classification: true, totalStays: true, isActive: true,
      createdAt: true, tags: true,
    },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-md">
            <UserGroupIcon className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tenants & Guests</h1>
            <p className="text-sm text-gray-500">{tenants.length} record{tenants.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <Link
          href="/dashboard/tenants/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
        >
          <PlusIcon className="h-4 w-4" />
          New Tenant
        </Link>
      </div>

      {/* Filters */}
      <TenantFilters
        currentSearch={q}
        currentClassification={classification}
        currentTenantType={tenantType}
        currentSource={source}
      />

      {/* Table */}
      <div className="mt-2 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide sm:pl-6">
                      Tenant
                    </th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Contact
                    </th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      ID Number
                    </th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Type
                    </th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Class
                    </th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Source
                    </th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Stays
                    </th>
                    <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {tenants.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-sm text-gray-500">
                        No tenants found.
                      </td>
                    </tr>
                  ) : (
                    tenants.map((t) => (
                      <tr key={t.id} className="hover:bg-blue-50/30 transition-colors">
                        {/* Name + nationality + tags */}
                        <td className="whitespace-nowrap py-3 pl-4 pr-3 sm:pl-6">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-semibold text-blue-700">
                                {t.firstName[0]}{t.lastName[0]}
                              </span>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {t.firstName} {t.lastName}
                              </div>
                              <div className="text-xs text-gray-400">{t.nationality || "—"}</div>
                            </div>
                          </div>
                          {t.tags && t.tags.length > 0 && (
                            <div className="mt-1 ml-10 flex flex-wrap gap-1">
                              {t.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                                  {tag}
                                </span>
                              ))}
                              {t.tags.length > 3 && (
                                <span className="text-[10px] text-gray-400">+{t.tags.length - 3}</span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Contact */}
                        <td className="whitespace-nowrap px-3 py-3 text-sm">
                          <div className="text-gray-900">{t.phone}</div>
                          {t.email && <div className="text-xs text-gray-400 truncate max-w-[160px]">{t.email}</div>}
                        </td>

                        {/* ID */}
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-600 font-mono">
                          {t.idNumber || "—"}
                          {t.idType && t.idType !== "national_id" && (
                            <div className="text-[10px] text-gray-400 font-sans capitalize">{t.idType.replace("_", " ")}</div>
                          )}
                        </td>

                        {/* Type */}
                        <td className="whitespace-nowrap px-3 py-3 text-sm">
                          <TypeBadge value={t.tenantType} />
                        </td>

                        {/* Classification */}
                        <td className="whitespace-nowrap px-3 py-3 text-sm">
                          <ClassificationBadge value={t.classification} />
                        </td>

                        {/* Source */}
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-500">
                          {SOURCE_LABELS[t.source ?? ""] ?? t.source ?? "—"}
                        </td>

                        {/* Stays */}
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-center text-gray-700">
                          {t.totalStays ?? 0}
                        </td>

                        {/* Actions */}
                        <td className="whitespace-nowrap py-3 pl-3 pr-4 text-right sm:pr-6">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/dashboard/tenants/${t.id}`}
                              className="rounded p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="View profile"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </Link>
                            <Link
                              href={`/dashboard/tenants/${t.id}/edit`}
                              className="rounded p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Edit"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                            </Link>
                          </div>
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
