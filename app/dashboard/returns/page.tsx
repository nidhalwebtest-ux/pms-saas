import { redirect } from "next/navigation";
import { assertView } from "@/lib/access";
import { Prisma } from "@prisma/client";
import { ArrowUturnLeftIcon } from "@heroicons/react/24/outline";
import { getTranslations } from "next-intl/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getCurrentCurrency } from "@/lib/get-org";
import { formatCurrency } from "@/lib/format-currency";
import ReturnsTable from "./ReturnsTable";
import ReturnsFilters from "./ReturnsFilters";
import type { ReturnRow } from "./columns";

type StatusFilter = "ALL" | "ACTIVE" | "REFUND_PENDING" | "REFUNDED" | "CANCELLED";

const PAGE_SIZE = 20;

function statusWhere(filter: StatusFilter): Prisma.ReturnWhereInput {
  switch (filter) {
    case "ACTIVE":         return { status: "active", refundStatus: "NOT_REQUIRED" };
    case "REFUND_PENDING": return { status: "active", refundStatus: "PENDING" };
    case "REFUNDED":       return { refundStatus: "COMPLETED" };
    case "CANCELLED":      return { status: "cancelled" };
    default:               return {};
  }
}

export default async function ReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  await assertView("returns");
  let orgUser: Awaited<ReturnType<typeof requireOrgUser>>;
  try {
    orgUser = await requireOrgUser();
  } catch {
    redirect("/login");
  }

  const params = await searchParams;
  const statusFilter = (params.status?.toUpperCase() as StatusFilter) || "ALL";
  const search = params.search || "";
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const propertyId = params.propertyId || "";

  const currency = await getCurrentCurrency();
  const t       = await getTranslations("returns");

  const baseWhere: Prisma.ReturnWhereInput = {
    organizationId: orgUser.organizationId,
    ...(propertyId && {
      reservation: {
        OR: [
          { unit: { propertyId } },
          { reservationUnits: { some: { unit: { propertyId } } } },
        ],
      },
    }),
    ...(search && {
      OR: [
        { returnNumber: { contains: search, mode: "insensitive" } },
        { tenant: { firstName: { contains: search, mode: "insensitive" } } },
        { tenant: { lastName: { contains: search, mode: "insensitive" } } },
        { reservation: { reservationNumber: { contains: search, mode: "insensitive" } } },
      ],
    }),
  };

  const where: Prisma.ReturnWhereInput = { ...baseWhere, ...statusWhere(statusFilter) };

  const [rows, total, cAll, cActive, cPending, cRefunded, cCancelled, sums] = await Promise.all([
    prisma.return.findMany({
      where,
      include: {
        tenant:      { select: { firstName: true, lastName: true, phone: true } },
        reservation: { select: { reservationNumber: true } },
        invoice:     { select: { invoiceNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.return.count({ where }),
    prisma.return.count({ where: { ...baseWhere, ...statusWhere("ALL") } }),
    prisma.return.count({ where: { ...baseWhere, ...statusWhere("ACTIVE") } }),
    prisma.return.count({ where: { ...baseWhere, ...statusWhere("REFUND_PENDING") } }),
    prisma.return.count({ where: { ...baseWhere, ...statusWhere("REFUNDED") } }),
    prisma.return.count({ where: { ...baseWhere, ...statusWhere("CANCELLED") } }),
    prisma.return.aggregate({ where, _sum: { returnAmount: true, refundAmount: true } }),
  ]);

  const returnRows: ReturnRow[] = rows.map((r) => ({
    id:             r.id,
    returnNumber:   r.returnNumber,
    status:         r.status,
    refundStatus:   r.refundStatus,
    returnType:     r.returnType,
    returnFrom:     r.returnFrom.toISOString(),
    returnTo:       r.returnTo.toISOString(),
    returnDays:     r.returnDays,
    returnAmount:   Number(r.returnAmount),
    refundRequired: r.refundRequired,
    refundAmount:   Number(r.refundAmount),
    createdAt:      r.createdAt.toISOString(),
    tenant: {
      firstName: r.tenant.firstName,
      lastName:  r.tenant.lastName,
      phone:     r.tenant.phone,
    },
    reservation:   { reservationNumber: r.reservation?.reservationNumber ?? null },
    reservationId: r.reservationId,
    invoice:       r.invoice ? { invoiceNumber: r.invoice.invoiceNumber } : null,
    invoiceId:     r.invoiceId,
  }));

  const sumReturn = Number(sums._sum.returnAmount ?? 0);
  const sumRefund = Number(sums._sum.refundAmount ?? 0);

  const tabs: { key: StatusFilter; count: number }[] = [
    { key: "ALL",            count: cAll },
    { key: "ACTIVE",         count: cActive },
    { key: "REFUND_PENDING", count: cPending },
    { key: "REFUNDED",       count: cRefunded },
    { key: "CANCELLED",      count: cCancelled },
  ];

  return (
    <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <ArrowUturnLeftIcon className="h-6 w-6 text-purple-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-sm text-gray-500">{t("recordsCount", { count: total })}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <ReturnsFilters
        currentStatus={statusFilter}
        currentSearch={search}
        counts={tabs}
      />

      {/* Table */}
      <ReturnsTable
        returns={returnRows}
        currency={currency}
        pageIndex={page - 1}
        pageSize={PAGE_SIZE}
        totalCount={total}
      />

      {/* Footer totals */}
      {total > 0 && (
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 text-xs text-fg-tertiary">
          <span>
            {t("footer.returned")}:{" "}
            <strong className="text-fg ltr-numbers">{formatCurrency(sumReturn, currency)}</strong>
          </span>
          <span>
            {t("footer.refunded")}:{" "}
            <strong className="text-success-700 ltr-numbers">{formatCurrency(sumRefund, currency)}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
