import { redirect } from "next/navigation";
import { assertView } from "@/lib/access";
import { getEffectivePropertyIds } from "@/lib/property-scope";
import { getSelectedPropertyId } from "@/lib/selected-property";
import { Prisma } from "@prisma/client";
import { ArrowUturnLeftIcon } from "@heroicons/react/24/outline";
import { getTranslations } from "next-intl/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getCurrentCurrency } from "@/lib/get-org";
import ReturnsView from "./ReturnsView";
import type { ReturnRow } from "./columns";

export default async function ReturnsPage() {
  await assertView("returns");
  let orgUser: Awaited<ReturnType<typeof requireOrgUser>>;
  try {
    orgUser = await requireOrgUser();
  } catch {
    redirect("/login");
  }

  // Building scope: sidebar-selected building, limited to accessible buildings.
  const propertyId = await getSelectedPropertyId();
  const propIds = await getEffectivePropertyIds(propertyId);

  const currency = await getCurrentCurrency();
  const t        = await getTranslations("returns");

  // Load ALL returns in scope in ONE query. Tabs/filters/search all run
  // client-side over these rows — no DB refetch on filter change.
  const where: Prisma.ReturnWhereInput = {
    organizationId: orgUser.organizationId,
    ...(propIds && {
      reservation: {
        OR: [
          { unit: { propertyId: { in: propIds } } },
          { reservationUnits: { some: { unit: { propertyId: { in: propIds } } } } },
        ],
      },
    }),
  };

  const rows = await prisma.return.findMany({
    where,
    include: {
      tenant:      { select: { firstName: true, lastName: true, phone: true } },
      reservation: { select: { reservationNumber: true } },
      invoice:     { select: { invoiceNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

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
            <p className="text-sm text-gray-500">{t("recordsCount", { count: returnRows.length })}</p>
          </div>
        </div>
      </div>

      {/* Filters + table + footer (all client-side) */}
      <ReturnsView returns={returnRows} currency={currency} />
    </div>
  );
}
