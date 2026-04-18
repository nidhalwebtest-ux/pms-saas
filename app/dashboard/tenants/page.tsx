import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Prisma } from "@prisma/client";
import { UserGroupIcon, PlusIcon } from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import TenantFilters from "./TenantFilters";
import TenantsView from "./TenantsView";

// ── Exported types ─────────────────────────────────────────────────────────────

export type TenantRow = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  nationality: string | null;
  idType: string | null;
  idNumber: string | null;
  tenantType: string | null;
  source: string | null;
  classification: string | null;
  totalStays: number;
  totalSpent: string;       // Decimal → string for client
  isActive: boolean;
  createdAt: string;        // Date → ISO string
  tags: string[];
  activeReservations: number;
};

export type TenantStats = {
  total: number;
  vip: number;
  blacklisted: number;
  active: number;
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params         = await searchParams;
  const q              = params.q              || "";
  const classification = params.classification || "";
  const tenantType     = params.tenantType     || "";
  const source         = params.source         || "";

  const t = await getTranslations("tenants");

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");

  const where: Prisma.TenantWhereInput = {
    organizationId: dbUser.organizationId,
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

  const raw = await prisma.tenant.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, firstName: true, lastName: true, phone: true, email: true,
      nationality: true, idType: true, idNumber: true, tenantType: true,
      source: true, classification: true, totalStays: true, totalSpent: true,
      isActive: true, createdAt: true, tags: true,
      _count: {
        select: {
          reservations: { where: { status: { in: ["CONFIRMED", "CHECKED_IN"] } } },
        },
      },
    },
    take: 300,
  });

  const tenants: TenantRow[] = raw.map((t) => ({
    id:                 t.id,
    firstName:          t.firstName,
    lastName:           t.lastName,
    phone:              t.phone,
    email:              t.email,
    nationality:        t.nationality,
    idType:             t.idType,
    idNumber:           t.idNumber,
    tenantType:         t.tenantType,
    source:             t.source,
    classification:     t.classification,
    totalStays:         t.totalStays ?? 0,
    totalSpent:         t.totalSpent?.toString() ?? "0",
    isActive:           t.isActive,
    createdAt:          t.createdAt.toISOString(),
    tags:               t.tags,
    activeReservations: t._count.reservations,
  }));

  const stats: TenantStats = {
    total:       tenants.length,
    vip:         tenants.filter((t) => t.classification === "vip").length,
    blacklisted: tenants.filter((t) => t.classification === "blacklisted").length,
    active:      tenants.filter((t) => t.isActive).length,
  };

  return (
    <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-8 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <UserGroupIcon className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-sm text-gray-500">{t("recordsCount", { count: tenants.length })}</p>
          </div>
        </div>
        <Link
          href="/dashboard/tenants/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          {t("newTenantBtn")}
        </Link>
      </div>

      {/* Filters */}
      <TenantFilters
        currentSearch={q}
        currentClassification={classification}
        currentTenantType={tenantType}
        currentSource={source}
      />

      {/* Main view */}
      <TenantsView tenants={tenants} stats={stats} />
    </div>
  );
}
