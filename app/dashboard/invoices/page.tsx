import { redirect } from "next/navigation";
import { assertView } from "@/lib/access";
import { getEffectivePropertyIds } from "@/lib/property-scope";
import { getSelectedPropertyId } from "@/lib/selected-property";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { DocumentTextIcon, PlusIcon } from "@heroicons/react/24/outline";
import { getTranslations } from "next-intl/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getCurrentCurrency } from "@/lib/get-org";
import InvoicesTable from "./InvoicesTable";
import type { InvoiceRow } from "./columns";

// Cap the all-rows fetch for safety. Filtering/tabs/pagination happen
// client-side over these rows — no DB refetch on search/tab/page change.
const MAX_ROWS = 5000;

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function InvoicesPage() {
  await assertView("invoices");
  // Auth
  let orgUser: Awaited<ReturnType<typeof requireOrgUser>>;
  try {
    orgUser = await requireOrgUser();
  } catch {
    redirect("/login");
  }

  // Building view: sidebar-selected building (null = unrestricted).
  const propertyId = await getSelectedPropertyId();
  const propIds = await getEffectivePropertyIds(propertyId);

  // ── i18n ──────────────────────────────────────────────────────────────────────
  const currency = await getCurrentCurrency();
  const t = await getTranslations("invoices");

  // ── Fetch ALL invoices in scope (org + building) in one query ──────────────────
  const where: Prisma.InvoiceWhereInput = {
    organizationId: orgUser.organizationId,
    ...(propIds ? { propertyId: { in: propIds } } : {}),
  };

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      tenant: { select: { firstName: true, lastName: true, phone: true } },
      reservation: { select: { reservationNumber: true, startDate: true, endDate: true } },
      property: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
  });

  // Serialize prisma → plain InvoiceRow for the client table. Decimal → number,
  // Date → ISO string. Anything the table does not consume is dropped.
  const invoiceRows: InvoiceRow[] = invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    dueDate: inv.dueDate.toISOString(),
    issueDate: inv.issueDate.toISOString(),
    periodStart: inv.periodStart.toISOString(),
    periodEnd: inv.periodEnd.toISOString(),
    totalAmount: Number(inv.totalAmount),
    amountPaid: Number(inv.amountPaid),
    balanceDue: Number(inv.balanceDue),
    tenant: {
      firstName: inv.tenant.firstName,
      lastName: inv.tenant.lastName,
      phone: inv.tenant.phone,
    },
    reservation: {
      reservationNumber: inv.reservation.reservationNumber,
    },
    reservationId: inv.reservationId,
  }));

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <DocumentTextIcon className="h-6 w-6 text-indigo-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-sm text-gray-500">{t("recordsCount", { count: invoiceRows.length })}</p>
          </div>
        </div>
        <Link
          href="/dashboard/reservations"
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          {t("newInvoice")}
        </Link>
      </div>

      {/* Filters + table + footer (all client-side, instant) */}
      <InvoicesTable invoices={invoiceRows} currency={currency} />
    </div>
  );
}
