import Link from "next/link";
import { assertView } from "@/lib/access";
import { getEffectivePropertyIds } from "@/lib/property-scope";
import { getSelectedPropertyId } from "@/lib/selected-property";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getCurrentCurrency } from "@/lib/get-org";
import { formatAmount } from "@/lib/format-currency";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import PaymentsView from "./PaymentsView";
import type { PaymentRow } from "./columns";

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PaymentsListPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const access = await assertView("payments");
  const params = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });
  if (!dbUser?.organizationId) redirect("/login");

  const orgId = dbUser.organizationId;

  const currency = await getCurrentCurrency();
  const t = await getTranslations("payments");
  const tList = await getTranslations("payments.list");

  // Building scope: a payment belongs to a building via its invoice or its
  // reservation's unit(s). Honor the sidebar-selected building; null = all.
  const propIds = await getEffectivePropertyIds(params.propertyId || (await getSelectedPropertyId()));
  const propScope: Prisma.PaymentWhereInput[] = propIds
    ? [{
        OR: [
          { invoice: { propertyId: { in: propIds } } },
          { reservation: { OR: [
            { unit: { propertyId: { in: propIds } } },
            { reservationUnits: { some: { unit: { propertyId: { in: propIds } } } } },
          ] } },
        ],
      }]
    : [];

  const where: Prisma.PaymentWhereInput = {
    organizationId: orgId,
    ...(propScope.length ? { AND: propScope } : {}),
  };

  // Load ALL payments in scope in one query. Tabs / search / method filter and
  // footer totals are all computed client-side over these rows — no refetch.
  const payments = await prisma.payment.findMany({
    where,
    include: {
      tenant: { select: { id: true, firstName: true, lastName: true } },
      receivedBy: { select: { id: true, firstName: true, lastName: true } },
      allocations: {
        include: { invoice: { select: { id: true, invoiceNumber: true } } },
      },
    },
    orderBy: { date: "desc" },
    take: 5000,
  });

  // Serialize prisma → plain PaymentRow for the client. Decimal → number,
  // Date → ISO, allocations pre-joined to a comma-separated string.
  const paymentRows: PaymentRow[] = payments.map((p) => ({
    id: p.id,
    paymentNumber: p.paymentNumber,
    date: p.date.toISOString(),
    amount: Number(p.amount),
    method: p.method,
    reference: p.reference,
    tenant: {
      id: p.tenant.id,
      firstName: p.tenant.firstName,
      lastName: p.tenant.lastName,
    },
    receivedBy: p.receivedBy
      ? { firstName: p.receivedBy.firstName, lastName: p.receivedBy.lastName }
      : null,
    appliedTo: p.allocations.map((a) => a.invoice.invoiceNumber).join(", "),
  }));

  const grandTotal = paymentRows.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-8">

      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-md">
            <BanknotesIcon className="h-6 w-6 text-green-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("titleFull")}</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {tList("summary", {
                count: paymentRows.length,
                total: formatAmount(grandTotal, currency),
              })}
            </p>
          </div>
        </div>
        {access.canCreate("payments") && (
        <Link
          href="/dashboard/payments/new"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
        >
          {t("newPayment")}
        </Link>
        )}
      </div>

      {/* ── Filters + table + footer (all client-side) ── */}
      <PaymentsView payments={paymentRows} currency={currency} />
    </div>
  );
}
