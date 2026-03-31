import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  UserIcon,
  HomeModernIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  BuildingOfficeIcon,
  BanknotesIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import InvoiceActions from "./InvoiceActions";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PriceSegment {
  days?: number;
  nights?: number;
  label: string;
  rate?: number;
  subtotal: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function StatusBadge({ status, dueDate }: { status: string; dueDate: Date }) {
  const overdue =
    (status === "ISSUED" || status === "PARTIALLY_PAID") &&
    new Date(dueDate) < new Date();

  if (overdue) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
        Overdue
      </span>
    );
  }

  const map: Record<string, string> = {
    DRAFT:          "bg-gray-100 text-gray-600 ring-gray-500/20",
    ISSUED:         "bg-blue-100 text-blue-700 ring-blue-700/20",
    PARTIALLY_PAID: "bg-amber-100 text-amber-700 ring-amber-600/20",
    PAID:           "bg-green-100 text-green-700 ring-green-600/20",
    CANCELLED:      "bg-red-50 text-red-400 ring-red-400/20",
  };

  const labels: Record<string, string> = {
    DRAFT: "Draft", ISSUED: "Issued", PARTIALLY_PAID: "Partially Paid",
    PAID: "Paid", CANCELLED: "Cancelled",
  };

  const cls = map[status] || "bg-gray-100 text-gray-600 ring-gray-400/20";
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${cls}`}>
      {labels[status] || status}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  let orgUser: Awaited<ReturnType<typeof requireOrgUser>>;
  try {
    orgUser = await requireOrgUser();
  } catch {
    redirect("/login");
  }

  const { id } = await params;
  const sp = await searchParams;
  const openPayment = sp.action === "payment";

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      tenant: true,
      reservation: {
        include: {
          reservationUnits: {
            include: { unit: true },
          },
        },
      },
      property: true,
      lineItems: {
        include: { unit: true },
        orderBy: { sortOrder: "asc" },
      },
      allocations: {
        include: {
          payment: {
            select: {
              id: true,
              date: true,
              method: true,
              reference: true,
              amount: true,
              isRefund: true,
              paymentNumber: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      createdBy: { select: { firstName: true, lastName: true } },
    },
  });

  if (!invoice || invoice.organizationId !== orgUser.organizationId) {
    notFound();
  }

  const totalAmount = Number(invoice.totalAmount);
  const amountPaid  = Number(invoice.amountPaid);
  const balanceDue  = Number(invoice.balanceDue);
  const subtotal    = Number(invoice.subtotal);
  const discount    = Number(invoice.discountAmount);
  const tax         = Number(invoice.taxAmount);

  const typeLabels: Record<string, string> = {
    SHORT_TERM: "Short-term",
    MONTHLY:    "Monthly",
    OVERSTAY:   "Overstay",
    ADDITIONAL: "Additional",
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard/invoices" className="flex items-center gap-1 hover:text-gray-900 transition-colors">
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Invoices
        </Link>
        <span>/</span>
        <span className="font-mono text-gray-900">{invoice.invoiceNumber}</span>
      </div>

      {/* Header bar */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <DocumentTextIcon className="h-6 w-6 text-indigo-700" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 font-mono">
                {invoice.invoiceNumber}
              </h1>
              <StatusBadge status={invoice.status} dueDate={invoice.dueDate} />
            </div>
            <p className="mt-0.5 text-sm text-gray-500">
              {typeLabels[invoice.invoiceType] || invoice.invoiceType}
              {invoice.monthNumber ? ` · Month ${invoice.monthNumber}` : ""}
              {" · "}
              Due {format(new Date(invoice.dueDate), "d MMM yyyy")}
            </p>
          </div>
        </div>
      </div>

      {/* Action buttons (client component) */}
      <InvoiceActions
        invoiceId={invoice.id}
        status={invoice.status}
        balanceDue={balanceDue}
        openPaymentPanel={openPayment}
      />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* ── Left column (2/3) ──────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Invoice Info card */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Invoice Details</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Type</dt>
                <dd className="mt-1 text-gray-900">{typeLabels[invoice.invoiceType] || invoice.invoiceType}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Period</dt>
                <dd className="mt-1 text-gray-900">
                  {format(new Date(invoice.periodStart), "d MMM yyyy")} –{" "}
                  {format(new Date(invoice.periodEnd), "d MMM yyyy")}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Issue Date</dt>
                <dd className="mt-1 text-gray-900">{format(new Date(invoice.issueDate), "d MMM yyyy")}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Due Date</dt>
                <dd className="mt-1 text-gray-900">{format(new Date(invoice.dueDate), "d MMM yyyy")}</dd>
              </div>
              {invoice.createdBy && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created By</dt>
                  <dd className="mt-1 text-gray-900">
                    {invoice.createdBy.firstName} {invoice.createdBy.lastName}
                  </dd>
                </div>
              )}
              {invoice.cancelledAt && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cancelled At</dt>
                  <dd className="mt-1 text-red-600">{format(new Date(invoice.cancelledAt), "d MMM yyyy")}</dd>
                </div>
              )}
            </dl>
            {invoice.cancelledReason && (
              <p className="mt-3 text-xs text-red-500 bg-red-50 rounded-md px-3 py-2">
                Cancellation reason: {invoice.cancelledReason}
              </p>
            )}
          </div>

          {/* Line Items table */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Line Items</h2>
            </div>
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-2.5 pl-5 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Description</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 w-16">Qty</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 w-28">Unit Price</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 w-32">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {invoice.lineItems.map((item) => {
                  const breakdown = item.priceBreakdown as PriceSegment[] | null;
                  return (
                    <>
                      <tr key={item.id}>
                        <td className="py-3 pl-5 pr-3 text-sm text-gray-900">
                          <div className="font-medium">
                            {item.unit ? `${item.unit.name} — ` : ""}{item.description}
                          </div>
                          {item.seasonalPriceName && (
                            <div className="text-xs text-indigo-600 mt-0.5">{item.seasonalPriceName}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm text-right text-gray-600">
                          {breakdown ? "—" : Number(item.quantity).toFixed(0)}
                        </td>
                        <td className="px-3 py-3 text-sm text-right text-gray-600">
                          {breakdown ? "—" : `${Number(item.unitPrice).toFixed(3)} OMR`}
                        </td>
                        <td className="px-5 py-3 text-sm text-right font-semibold text-gray-900">
                          {Number(item.lineTotal).toFixed(3)} OMR
                        </td>
                      </tr>
                      {breakdown && breakdown.map((seg, si) => (
                        <tr key={`${item.id}-seg-${si}`} className="bg-gray-50/60">
                          <td className="py-1.5 pl-9 pr-3 text-xs text-gray-500">
                            <span className="text-gray-400 mr-1.5">└</span>
                            {seg.label}
                          </td>
                          <td className="px-3 py-1.5 text-xs text-right text-gray-500">
                            {seg.days ?? seg.nights ?? "—"}
                          </td>
                          <td className="px-3 py-1.5 text-xs text-right text-gray-500">
                            {seg.rate !== undefined ? `${Number(seg.rate).toFixed(3)} OMR` : "—"}
                          </td>
                          <td className="px-5 py-1.5 text-xs text-right text-gray-600 font-medium">
                            {Number(seg.subtotal).toFixed(3)} OMR
                          </td>
                        </tr>
                      ))}
                    </>
                  );
                })}
                {invoice.lineItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-gray-400">
                      No line items
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Totals */}
            <div className="border-t border-gray-200 bg-gray-50/50 px-5 py-4">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <dt>Subtotal</dt>
                  <dd>{subtotal.toFixed(3)} OMR</dd>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <dt>Discount</dt>
                    <dd>−{discount.toFixed(3)} OMR</dd>
                  </div>
                )}
                {tax > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <dt>Tax</dt>
                    <dd>{tax.toFixed(3)} OMR</dd>
                  </div>
                )}
                <div className="flex justify-between text-gray-900 font-bold text-base pt-1.5 border-t border-gray-200">
                  <dt>Total</dt>
                  <dd>{totalAmount.toFixed(3)} OMR</dd>
                </div>
                <div className="flex justify-between text-green-700 font-medium pt-1">
                  <dt>Amount Paid</dt>
                  <dd>−{amountPaid.toFixed(3)} OMR</dd>
                </div>
                <div className={`flex justify-between font-bold text-base ${balanceDue > 0 ? "text-red-600" : "text-green-700"}`}>
                  <dt>Balance Due</dt>
                  <dd>{balanceDue.toFixed(3)} OMR</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Payment History */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <BanknotesIcon className="h-4 w-4 text-green-600" />
              <h2 className="text-sm font-semibold text-gray-900">Payment History</h2>
            </div>
            {invoice.allocations.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">No payments recorded yet.</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-2.5 pl-5 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Date</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Method</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Reference</th>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {invoice.allocations.map((alloc) => (
                    <tr key={alloc.id} className={alloc.payment.isRefund ? "bg-red-50" : ""}>
                      <td className="py-3 pl-5 pr-3 text-sm text-gray-900">
                        {format(new Date(alloc.payment.date), "d MMM yyyy")}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                          {alloc.payment.method.toLowerCase().replace("_", " ")}
                        </span>
                        {alloc.payment.isRefund && (
                          <span className="ml-1.5 inline-flex items-center rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                            Refund
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-500">
                        {alloc.payment.reference || "—"}
                      </td>
                      <td className={`px-5 py-3 text-sm text-right font-semibold ${alloc.payment.isRefund ? "text-red-600" : "text-green-600"}`}>
                        {alloc.payment.isRefund ? "−" : "+"}{Number(alloc.amount).toFixed(3)} OMR
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Right column (1/3) ────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Tenant card */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <UserIcon className="h-4 w-4 text-gray-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tenant</h3>
            </div>
            <Link
              href={`/dashboard/tenants/${invoice.tenantId}`}
              className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
            >
              {invoice.tenant.firstName} {invoice.tenant.lastName}
            </Link>
            {invoice.tenant.fullNameArabic && (
              <p className="text-sm text-gray-500 mt-0.5 font-arabic">{invoice.tenant.fullNameArabic}</p>
            )}
            <p className="text-sm text-gray-600 mt-1">{invoice.tenant.phone}</p>
            {invoice.tenant.email && (
              <p className="text-sm text-gray-500">{invoice.tenant.email}</p>
            )}
            {invoice.tenant.idType && invoice.tenant.idNumber && (
              <p className="text-xs text-gray-400 mt-1.5 capitalize">
                {invoice.tenant.idType.replace("_", " ")}: {invoice.tenant.idNumber}
              </p>
            )}
          </div>

          {/* Reservation card */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reservation</h3>
            </div>
            {invoice.reservation.reservationNumber && (
              <Link
                href={`/dashboard/reservations/${invoice.reservationId}`}
                className="font-mono font-semibold text-indigo-600 hover:text-indigo-900 transition-colors"
              >
                {invoice.reservation.reservationNumber}
              </Link>
            )}
            <p className="text-sm text-gray-600 mt-1">
              {format(new Date(invoice.reservation.startDate), "d MMM yyyy")} –{" "}
              {format(new Date(invoice.reservation.endDate), "d MMM yyyy")}
            </p>
            {invoice.reservation.reservationUnits.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {invoice.reservation.reservationUnits.map((ru) => (
                  <p key={ru.id} className="text-xs text-gray-500">
                    Unit: <span className="font-medium text-gray-700">{ru.unit.name}</span>
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Property card */}
          {invoice.property && (
            <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Property</h3>
              </div>
              <Link
                href={`/dashboard/properties/${invoice.propertyId}`}
                className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
              >
                {invoice.property.name}
              </Link>
              {invoice.property.address && (
                <p className="text-xs text-gray-500 mt-0.5">{invoice.property.address}</p>
              )}
            </div>
          )}

          {/* Notes card */}
          {invoice.notes && (
            <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Notes</h3>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
