import { assertView } from "@/lib/access";
import { Prisma } from "@prisma/client";
import { UserGroupIcon, PlusIcon } from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
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
  totalStays: number;       // live: count of checked-in/completed stays
  totalSpent: string;       // live: net paid (Decimal → string)
  openBalance: string;      // live: outstanding invoice balance
  isActive: boolean;
  createdAt: string;        // Date → ISO string
  tags: string[];
  activeReservations: number;
  currentStay: { reservationId: string; reservationNumber: string | null } | null;
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function TenantsPage() {
  // assertView already resolves+caches the session and guarantees an org.
  const access = await assertView("tenants");
  const orgId = access.organizationId;

  const t = await getTranslations("tenants");

  // Load all tenants once (org-scoped) + live aggregates. All filtering/tabs
  // happen client-side over these rows — no DB refetch on search/tab change.
  const orgScope: Prisma.TenantWhereInput = { organizationId: orgId };
  const [raw, stayGroups, paymentGroups, balanceGroups, checkedInRes] = await Promise.all([
    prisma.tenant.findMany({
      where: orgScope,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, firstName: true, lastName: true, phone: true, email: true,
        nationality: true, idType: true, idNumber: true, tenantType: true,
        source: true, classification: true, isActive: true, createdAt: true, tags: true,
        _count: {
          select: {
            reservations: { where: { status: { in: ["CONFIRMED", "CHECKED_IN"] } } },
          },
        },
      },
      take: 2000,
    }),
    // Stays = reservations that actually happened (checked in or completed).
    prisma.reservation.groupBy({
      by: ["tenantId"],
      where: { organizationId: orgId, status: { in: ["CHECKED_IN", "COMPLETED"] } },
      _count: { _all: true },
    }),
    // Net spend = payments (non-refund) minus refunds, per tenant.
    prisma.payment.groupBy({
      by: ["tenantId", "isRefund"],
      where: { tenant: { organizationId: orgId } },
      _sum: { amount: true },
    }),
    // Outstanding balance = sum of open invoice balanceDue, per tenant.
    prisma.invoice.groupBy({
      by: ["tenantId"],
      where: { organizationId: orgId, status: { notIn: ["CANCELLED", "VOID", "DRAFT"] }, balanceDue: { gt: 0 } },
      _sum: { balanceDue: true },
    }),
    // The current in-house reservation per tenant (latest checked-in).
    prisma.reservation.findMany({
      where: { organizationId: orgId, status: "CHECKED_IN" },
      select: { tenantId: true, id: true, reservationNumber: true, startDate: true },
      orderBy: { startDate: "desc" },
    }),
  ]);

  const staysByTenant = new Map<string, number>();
  for (const g of stayGroups) if (g.tenantId) staysByTenant.set(g.tenantId, g._count._all);

  const spentByTenant = new Map<string, number>();
  for (const g of paymentGroups) {
    if (!g.tenantId) continue;
    const amt = Number(g._sum.amount ?? 0);
    spentByTenant.set(g.tenantId, (spentByTenant.get(g.tenantId) ?? 0) + (g.isRefund ? -amt : amt));
  }

  const balanceByTenant = new Map<string, number>();
  for (const g of balanceGroups) if (g.tenantId) balanceByTenant.set(g.tenantId, Number(g._sum.balanceDue ?? 0));

  const currentStayByTenant = new Map<string, { reservationId: string; reservationNumber: string | null }>();
  for (const r of checkedInRes) {
    if (!currentStayByTenant.has(r.tenantId)) {
      currentStayByTenant.set(r.tenantId, { reservationId: r.id, reservationNumber: r.reservationNumber });
    }
  }

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
    totalStays:         staysByTenant.get(t.id) ?? 0,
    totalSpent:         String(Math.max(0, spentByTenant.get(t.id) ?? 0)),
    openBalance:        String(balanceByTenant.get(t.id) ?? 0),
    isActive:           t.isActive,
    createdAt:          t.createdAt.toISOString(),
    tags:               t.tags,
    activeReservations: t._count.reservations,
    currentStay:        currentStayByTenant.get(t.id) ?? null,
  }));

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
        {access.canCreate("tenants") && (
          <Link
            href="/dashboard/tenants/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            {t("newTenantBtn")}
          </Link>
        )}
      </div>

      {/* Filters + view (all client-side) */}
      <TenantsView tenants={tenants} />
    </div>
  );
}
