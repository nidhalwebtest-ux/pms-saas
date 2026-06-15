import Link from "next/link";
import { assertView } from "@/lib/access";
import { getEffectivePropertyIds } from "@/lib/property-scope";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getCurrentCurrency } from "@/lib/get-org";
import { formatAmount } from "@/lib/format-currency";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import PaymentsTable from "./PaymentsTable";
import PaymentsFilters from "./PaymentsFilters";
import type { PaymentRow } from "./columns";

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}
function endOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PaymentsListPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  await assertView("payments");
  const params = await searchParams;
  const q        = params.q      ?? "";
  const method   = params.method ?? "";
  const period   = params.period ?? "all";

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
  const t       = await getTranslations("payments");
  const tList = await getTranslations("payments.list");

  // ── Date range for period filter ──────────────────────────────────────────
  const now   = new Date();
  const today = startOfDay(now);

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // Sunday

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  function periodRange(p: string): { gte?: Date; lte?: Date } {
    if (p === "today") return { gte: today, lte: endOfDay(now) };
    if (p === "week")  return { gte: weekStart, lte: endOfDay(now) };
    if (p === "month") return { gte: monthStart, lte: endOfDay(now) };
    return {};
  }

  // ── Tab counts ────────────────────────────────────────────────────────────
  // Building scope: a payment belongs to a building via its invoice or its
  // reservation's unit(s). null propIds = unrestricted.
  const propIds = await getEffectivePropertyIds("");
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

  const baseWhere: Prisma.PaymentWhereInput = {
    organizationId: orgId,
    ...(propScope.length ? { AND: propScope } : {}),
  };
  const [allCount, todayCount, weekCount, monthCount] = await Promise.all([
    prisma.payment.count({ where: baseWhere }),
    prisma.payment.count({ where: { ...baseWhere, date: periodRange("today") } }),
    prisma.payment.count({ where: { ...baseWhere, date: periodRange("week") } }),
    prisma.payment.count({ where: { ...baseWhere, date: periodRange("month") } }),
  ]);

  // ── Main query ────────────────────────────────────────────────────────────
  const dateRange = periodRange(period);
  const where: Prisma.PaymentWhereInput = {
    organizationId: orgId,
    ...(propScope.length ? { AND: propScope } : {}),
    ...(dateRange.gte || dateRange.lte ? { date: dateRange } : {}),
    ...(method ? { method: method as Prisma.EnumPaymentMethodFilter } : {}),
    ...(q
      ? {
          OR: [
            { tenant: { firstName: { contains: q, mode: "insensitive" } } },
            { tenant: { lastName:  { contains: q, mode: "insensitive" } } },
            { paymentNumber: { contains: q, mode: "insensitive" } },
            { reference:     { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

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
    take: 200,
  });

  // ── Footer totals ─────────────────────────────────────────────────────────
  const totals = { all: 0, CASH: 0, CARD: 0, BANK_TRANSFER: 0, CHEQUE: 0 };
  for (const p of payments) {
    const amt = Number(p.amount);
    totals.all += amt;
    if (p.method === "CASH")          totals.CASH          += amt;
    if (p.method === "CARD")          totals.CARD          += amt;
    if (p.method === "BANK_TRANSFER") totals.BANK_TRANSFER += amt;
    if (p.method === "CHEQUE")        totals.CHEQUE        += amt;
  }

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

  const hasActiveFilters = !!q || !!method || period !== "all";

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
                count: payments.length,
                total: formatAmount(totals.all, currency),
              })}
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/payments/new"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
        >
          {t("newPayment")}
        </Link>
      </div>

      {/* ── Filters ── */}
      <div className="mb-4">
        <PaymentsFilters
          currentPeriod={period}
          currentQ={q}
          currentMethod={method}
          counts={{ all: allCount, today: todayCount, week: weekCount, month: monthCount }}
        />
      </div>

      {/* ── Table ── */}
      <PaymentsTable
        payments={paymentRows}
        currency={currency}
        hasActiveFilters={hasActiveFilters}
      />

      {/* ── Footer totals (by method) ── */}
      {payments.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 px-1 text-xs text-fg-tertiary">
          <span className="font-medium text-fg">
            {tList("totalsLabel", { count: payments.length })}{" "}
            <strong className="text-success-700 tabular-nums ltr-numbers ms-2">
              {formatAmount(totals.all, currency)}
            </strong>
          </span>
          <div className="flex flex-wrap gap-3">
            <span className="text-success-700 ltr-numbers">
              {tList("cashTotal", { total: formatAmount(totals.CASH, currency) })}
            </span>
            <span className="text-brand-700 ltr-numbers">
              {tList("cardTotal", { total: formatAmount(totals.CARD, currency) })}
            </span>
            <span className="text-fg-secondary ltr-numbers">
              {tList("bankTotal", { total: formatAmount(totals.BANK_TRANSFER, currency) })}
            </span>
            <span className="text-warning-700 ltr-numbers">
              {tList("chequeTotal", { total: formatAmount(totals.CHEQUE, currency) })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
