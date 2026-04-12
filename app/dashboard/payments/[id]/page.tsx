import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  ArrowLeftIcon,
  PrinterIcon,
  UserIcon,
  DocumentTextIcon,
  BanknotesIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";

// ── Helpers ───────────────────────────────────────────────────────────────────

function methodLabel(m: string) {
  const map: Record<string, string> = {
    CASH: "Cash",
    CARD: "Card",
    BANK_TRANSFER: "Bank Transfer",
    CHEQUE: "Cheque",
    ONLINE: "Online",
    OTHER: "Other",
  };
  return map[m] ?? m;
}

function methodBadgeClass(m: string) {
  const map: Record<string, string> = {
    CASH: "bg-green-100 text-green-800",
    CARD: "bg-blue-100 text-blue-800",
    BANK_TRANSFER: "bg-purple-100 text-purple-800",
    CHEQUE: "bg-orange-100 text-orange-800",
    ONLINE: "bg-cyan-100 text-cyan-800",
    OTHER: "bg-gray-100 text-gray-600",
  };
  return map[m] ?? "bg-gray-100 text-gray-600";
}

function invoiceStatusBadge(status: string) {
  const map: Record<string, string> = {
    PAID:           "bg-green-100 text-green-800",
    PARTIALLY_PAID: "bg-orange-100 text-orange-800",
    PENDING:        "bg-yellow-100 text-yellow-800",
    CANCELLED:      "bg-gray-100 text-gray-500",
    RETURNED:       "bg-red-100 text-red-700",
    PARTIAL:        "bg-orange-100 text-orange-800",
    ISSUED:         "bg-yellow-100 text-yellow-800",
    DUE:            "bg-yellow-100 text-yellow-800",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
}

function fmtDate(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
}
function fmtDateTime(d: Date | string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) +
    " at " + dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function fmtPeriod(start: Date | null, end: Date | null) {
  if (!start || !end) return "";
  const s = new Date(start).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const e = new Date(end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${s} – ${e}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PaymentDetailPage({
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
  if (!dbUser?.organizationId) redirect("/login");

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      tenant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          fullNameArabic: true,
          phone: true,
          idType: true,
          idNumber: true,
          nationalId: true,
          organizationId: true,
        },
      },
      allocations: {
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              periodStart: true,
              periodEnd: true,
              totalAmount: true,
              amountPaid: true,
              balanceDue: true,
              status: true,
              reservationId: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      receivedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  if (!payment || payment.tenant.organizationId !== dbUser.organizationId) {
    return notFound();
  }

  const receiptNum   = payment.paymentNumber ?? payment.id.slice(0, 8).toUpperCase();
  const amount       = Number(payment.amount);
  const totalApplied = payment.allocations.reduce((s, a) => s + Number(a.amount), 0);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">

      {/* ── Nav ── */}
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <Link
          href="/dashboard/payments"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Back to Payments
        </Link>
        <div className="flex items-center gap-2">
          <a
            href={`/api/payments/${id}/receipt-pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            <PrinterIcon className="h-4 w-4" />
            Print Receipt
          </a>
          <Link
            href={`/dashboard/tenants/${payment.tenant.id}`}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <UserIcon className="h-4 w-4" />
            Back to Tenant
          </Link>
        </div>
      </div>

      {/* ── Receipt Header ── */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl px-6 py-6 text-white mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest mb-1">Receipt</p>
            <p className="text-2xl font-bold font-mono">{receiptNum}</p>
            <div className="flex items-center gap-2 mt-2 text-blue-100 text-sm">
              <CalendarDaysIcon className="h-4 w-4" />
              {fmtDate(payment.date)}
            </div>
          </div>
          <div className="text-right">
            <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest mb-1">Amount</p>
            <p className="text-3xl font-bold">{amount.toFixed(3)} <span className="text-xl font-normal text-blue-200">OMR</span></p>
            <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${methodBadgeClass(payment.method)} bg-opacity-90`}>
              {methodLabel(payment.method)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Transaction Details */}
        <div className="bg-white rounded-lg shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            <DocumentTextIcon className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Transaction Details</h3>
          </div>
          <dl className="px-4 py-3 divide-y divide-gray-100 text-sm">
            <div className="flex justify-between py-2.5">
              <dt className="text-gray-500">Receipt Number</dt>
              <dd className="font-mono font-semibold text-gray-900">{receiptNum}</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-gray-500">Date & Time</dt>
              <dd className="font-medium text-gray-900">{fmtDateTime(payment.date)}</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-gray-500">Payment Method</dt>
              <dd>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${methodBadgeClass(payment.method)}`}>
                  {methodLabel(payment.method)}
                </span>
              </dd>
            </div>
            {payment.reference && (
              <div className="flex justify-between py-2.5">
                <dt className="text-gray-500">Reference</dt>
                <dd className="font-medium text-gray-900">{payment.reference}</dd>
              </div>
            )}
            {payment.notes && (
              <div className="flex justify-between py-2.5">
                <dt className="text-gray-500">Notes</dt>
                <dd className="font-medium text-gray-900 text-right max-w-[200px]">{payment.notes}</dd>
              </div>
            )}
            {payment.receivedBy && (
              <div className="flex justify-between py-2.5">
                <dt className="text-gray-500">Recorded by</dt>
                <dd className="font-medium text-gray-900">
                  {payment.receivedBy.firstName ?? ""} {payment.receivedBy.lastName ?? ""}
                </dd>
              </div>
            )}
            {payment.isRefund && (
              <div className="flex justify-between py-2.5">
                <dt className="text-gray-500">Type</dt>
                <dd>
                  <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-700">
                    Refund
                  </span>
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Tenant */}
        <div className="bg-white rounded-lg shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Tenant</h3>
          </div>
          <div className="px-4 py-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-blue-700">
                  {payment.tenant.firstName[0]}{payment.tenant.lastName[0]}
                </span>
              </div>
              <div>
                <Link
                  href={`/dashboard/tenants/${payment.tenant.id}`}
                  className="text-base font-semibold text-blue-600 hover:underline"
                >
                  {payment.tenant.firstName} {payment.tenant.lastName}
                </Link>
                {payment.tenant.fullNameArabic && (
                  <p className="text-sm text-gray-500 mt-0.5" dir="rtl">{payment.tenant.fullNameArabic}</p>
                )}
              </div>
            </div>
            <dl className="divide-y divide-gray-100 text-sm">
              <div className="flex justify-between py-2.5">
                <dt className="text-gray-500">Phone</dt>
                <dd className="font-medium text-gray-900">{payment.tenant.phone}</dd>
              </div>
              {(payment.tenant.idNumber || payment.tenant.nationalId) && (
                <div className="flex justify-between py-2.5">
                  <dt className="text-gray-500">ID Number</dt>
                  <dd className="font-medium text-gray-900 font-mono">
                    {payment.tenant.idNumber ?? payment.tenant.nationalId}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>

      {/* ── Applied to invoices ── */}
      {payment.allocations.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            <BanknotesIcon className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Applied to Invoices</h3>
          </div>
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 pl-4 pr-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Invoice #</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Period</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Amount Applied</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Invoice Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payment.allocations.map((alloc) => {
                const inv = alloc.invoice;
                return (
                  <tr key={alloc.id} className="hover:bg-gray-50">
                    <td className="py-3 pl-4 pr-3 text-sm font-mono font-semibold">
                      <Link
                        href={`/dashboard/invoices/${inv.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-500">
                      {fmtPeriod(inv.periodStart, inv.periodEnd)}
                    </td>
                    <td className="px-3 py-3 text-sm text-right font-semibold text-green-700">
                      {Number(alloc.amount).toFixed(3)} OMR
                    </td>
                    <td className="px-3 py-3 text-sm text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${invoiceStatusBadge(inv.status)}`}>
                        {inv.status === "PARTIALLY_PAID" ? "Partially Paid" : inv.status.charAt(0) + inv.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={2} className="py-3 pl-4 text-sm font-semibold text-gray-700">Total Applied</td>
                <td className="px-3 py-3 text-right text-sm font-bold text-green-700">
                  {totalApplied.toFixed(3)} OMR
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Unapplied credit note */}
      {payment.allocations.length === 0 && (
        <div className="mt-6 bg-amber-50 rounded-lg border border-amber-200 px-4 py-4 text-sm text-amber-800">
          This payment has not been applied to any invoices — it is recorded as unapplied credit.
        </div>
      )}
    </div>
  );
}
