"use client";

/* ============================================================================
 *  Shared transaction sections for entity detail pages (Unit, Tenant).
 *
 *  Two rendering modes off the same serialized data:
 *   - <TransactionsOverview>  → three compact cards (latest ~5 each) with a
 *     "View all" link that switches the parent tab to the full list.
 *   - <ReservationsList> / <InvoicesList> / <PaymentsList> → full lists for the
 *     dedicated in-page tabs.
 *
 *  All amounts arrive as plain numbers and dates as ISO strings (serialized on
 *  the server) so the client/server boundary stays clean.
 * ========================================================================= */

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { format as fmtDateFns } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import {
  CalendarDaysIcon,
  DocumentTextIcon,
  BanknotesIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import {
  Badge,
  getReservationStatusBadge,
  reservationStatusKeyFromDisplayLabel,
  resolveInvoiceBadge,
  getPaymentMethodBadge,
  type PaymentMethodKey,
} from "@/components/ui";
import { formatCurrency } from "@/lib/format-currency";

/* ── Serialized row types ─────────────────────────────────────────────────── */

export type TxnReservation = {
  id: string;
  reservationNumber: string | null;
  status: string;
  /** Computed display label (In House / Overstay / …). */
  displayStatus: string;
  startDate: string;
  endDate: string;
  /** Unit name(s) — for the tenant view. */
  unitLabel: string | null;
  grandTotal: number;
};

export type TxnInvoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  dueDate: string;
  issueDate: string | null;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  reservationId: string;
};

export type TxnPayment = {
  id: string;
  amount: number;
  method: string;
  date: string;
  reference: string | null;
  isRefund: boolean;
  reservationId: string | null;
  reservationNumber: string | null;
};

export type TransactionData = {
  reservations: TxnReservation[];
  invoices: TxnInvoice[];
  payments: TxnPayment[];
  /** Totals across ALL records (not just the loaded page), for the counts. */
  counts: { reservations: number; invoices: number; payments: number };
  currency: string;
};

export type TxnSection = "reservations" | "invoices" | "payments";

const PREVIEW_COUNT = 5;

/* ── Shared formatting hook ───────────────────────────────────────────────── */

function useFmt() {
  const locale = useLocale();
  const dfLoc = locale === "ar" ? arLocale : enLocale;
  return (iso: string | null, fmt = "d MMM yyyy") =>
    iso ? fmtDateFns(new Date(iso), fmt, { locale: dfLoc }) : "—";
}

/* ── Row renderers (shared between preview cards and full lists) ───────────── */

function ReservationRow({ r, fmt }: { r: TxnReservation; fmt: ReturnType<typeof useFmt> }) {
  const key = reservationStatusKeyFromDisplayLabel(r.displayStatus);
  return (
    <Link
      href={`/dashboard/reservations/${r.id}`}
      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-brand-600 truncate ltr-numbers">
          {r.reservationNumber ?? r.unitLabel ?? r.id.slice(0, 8)}
        </p>
        <p className="mt-0.5 text-xs text-gray-500 ltr-numbers">
          {fmt(r.startDate)} → {fmt(r.endDate)}
          {r.unitLabel && r.reservationNumber ? <span className="text-gray-400"> · {r.unitLabel}</span> : null}
        </p>
      </div>
      <Badge {...getReservationStatusBadge(key)} size="sm">{r.displayStatus}</Badge>
    </Link>
  );
}

function InvoiceRow({ i, fmt, currency }: { i: TxnInvoice; fmt: ReturnType<typeof useFmt>; currency: string }) {
  const tStatus = useTranslations("invoices.statuses");
  const { props, key } = resolveInvoiceBadge(i.status, new Date(i.dueDate));
  const labelKey =
    key === "overdue" ? "overdue" :
    key === "draft" ? "draft" :
    key === "pending" ? (i.status === "PENDING" ? "pending" : "issued") :
    key === "partially-paid" ? "partial" :
    key === "paid" ? "paid" :
    key === "returned" ? "returned" : "cancelled";
  return (
    <Link
      href={`/dashboard/invoices/${i.id}`}
      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-brand-600 truncate font-mono ltr-numbers">{i.invoiceNumber}</p>
        <p className="mt-0.5 text-xs text-gray-500 ltr-numbers">{fmt(i.dueDate)}</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-end">
          <p className="text-sm font-semibold text-gray-900 tabular-nums" dir="ltr">{formatCurrency(i.totalAmount, currency)}</p>
          {i.balanceDue > 0 && (
            <p className="text-xs text-error-600 tabular-nums" dir="ltr">{formatCurrency(i.balanceDue, currency)}</p>
          )}
        </div>
        <Badge {...props} size="sm">{tStatus(labelKey)}</Badge>
      </div>
    </Link>
  );
}

function PaymentRow({ p, fmt, currency }: { p: TxnPayment; fmt: ReturnType<typeof useFmt>; currency: string }) {
  const tPay = useTranslations("invoices.paymentMethods");
  const tryPay = (m: string) => { try { return tPay(m as never); } catch { return m; } };
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className={`text-sm font-semibold tabular-nums ${p.isRefund ? "text-error-600" : "text-success-700"}`} dir="ltr">
          {p.isRefund ? "−" : ""}{formatCurrency(p.amount, currency)}
        </p>
        <p className="mt-0.5 text-xs text-gray-500 ltr-numbers">
          {fmt(p.date)}
          {p.reservationNumber && (
            <Link href={`/dashboard/reservations/${p.reservationId}`} className="ms-1 text-brand-600 hover:underline">
              · {p.reservationNumber}
            </Link>
          )}
        </p>
      </div>
      <div className="text-end flex-shrink-0">
        <Badge {...getPaymentMethodBadge(p.method as PaymentMethodKey)} size="sm">{tryPay(p.method)}</Badge>
        {p.reference && <p className="mt-0.5 text-xs text-gray-400 truncate max-w-[120px]">{p.reference}</p>}
      </div>
    </div>
  );
}

/* ── Empty + card chrome ──────────────────────────────────────────────────── */

function Empty({ label }: { label: string }) {
  return <p className="px-4 py-8 text-center text-sm text-gray-400">{label}</p>;
}

function PreviewCard({
  title, icon, count, onViewAll, viewAllLabel, children, empty,
}: {
  title: string; icon: React.ReactNode; count: number;
  onViewAll: () => void; viewAllLabel: string;
  children: React.ReactNode; empty: boolean;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
      <header className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
        {icon}
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <span className="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-200 px-1.5 text-xs font-semibold text-gray-600 ltr-numbers">
          {count}
        </span>
      </header>
      <div className="divide-y divide-gray-100 flex-1">{children}</div>
      {!empty && count > PREVIEW_COUNT && (
        <button
          type="button"
          onClick={onViewAll}
          className="flex items-center justify-center gap-1 border-t border-gray-100 px-4 py-2.5 text-xs font-semibold text-brand-600 hover:bg-brand-50/50 transition-colors"
        >
          {viewAllLabel} <ArrowRightIcon className="h-3.5 w-3.5 rtl:rotate-180" />
        </button>
      )}
    </section>
  );
}

/* ── Public: Overview (three compact cards) ───────────────────────────────── */

export function TransactionsOverview({
  data, onViewAll,
}: {
  data: TransactionData;
  onViewAll: (section: TxnSection) => void;
}) {
  const t = useTranslations("transactions");
  const fmt = useFmt();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <PreviewCard
        title={t("reservations")}
        icon={<CalendarDaysIcon className="h-4 w-4 text-gray-400" />}
        count={data.counts.reservations}
        onViewAll={() => onViewAll("reservations")}
        viewAllLabel={t("viewAll")}
        empty={data.reservations.length === 0}
      >
        {data.reservations.length === 0
          ? <Empty label={t("noReservations")} />
          : data.reservations.slice(0, PREVIEW_COUNT).map((r) => <ReservationRow key={r.id} r={r} fmt={fmt} />)}
      </PreviewCard>

      <PreviewCard
        title={t("invoices")}
        icon={<DocumentTextIcon className="h-4 w-4 text-gray-400" />}
        count={data.counts.invoices}
        onViewAll={() => onViewAll("invoices")}
        viewAllLabel={t("viewAll")}
        empty={data.invoices.length === 0}
      >
        {data.invoices.length === 0
          ? <Empty label={t("noInvoices")} />
          : data.invoices.slice(0, PREVIEW_COUNT).map((i) => <InvoiceRow key={i.id} i={i} fmt={fmt} currency={data.currency} />)}
      </PreviewCard>

      <PreviewCard
        title={t("payments")}
        icon={<BanknotesIcon className="h-4 w-4 text-gray-400" />}
        count={data.counts.payments}
        onViewAll={() => onViewAll("payments")}
        viewAllLabel={t("viewAll")}
        empty={data.payments.length === 0}
      >
        {data.payments.length === 0
          ? <Empty label={t("noPayments")} />
          : data.payments.slice(0, PREVIEW_COUNT).map((p) => <PaymentRow key={p.id} p={p} fmt={fmt} currency={data.currency} />)}
      </PreviewCard>
    </div>
  );
}

/* ── Public: full lists for the dedicated tabs ────────────────────────────── */

function ListShell({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <header className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <span className="ms-auto text-xs text-gray-400 ltr-numbers">{count}</span>
      </header>
      <div className="divide-y divide-gray-100">{children}</div>
    </section>
  );
}

export function ReservationsList({ data }: { data: TransactionData }) {
  const t = useTranslations("transactions");
  const fmt = useFmt();
  return (
    <ListShell title={t("reservations")} count={data.counts.reservations}>
      {data.reservations.length === 0
        ? <Empty label={t("noReservations")} />
        : data.reservations.map((r) => <ReservationRow key={r.id} r={r} fmt={fmt} />)}
    </ListShell>
  );
}

export function InvoicesList({ data }: { data: TransactionData }) {
  const t = useTranslations("transactions");
  const fmt = useFmt();
  return (
    <ListShell title={t("invoices")} count={data.counts.invoices}>
      {data.invoices.length === 0
        ? <Empty label={t("noInvoices")} />
        : data.invoices.map((i) => <InvoiceRow key={i.id} i={i} fmt={fmt} currency={data.currency} />)}
    </ListShell>
  );
}

export function PaymentsList({ data }: { data: TransactionData }) {
  const t = useTranslations("transactions");
  const fmt = useFmt();
  return (
    <ListShell title={t("payments")} count={data.counts.payments}>
      {data.payments.length === 0
        ? <Empty label={t("noPayments")} />
        : data.payments.map((p) => <PaymentRow key={p.id} p={p} fmt={fmt} currency={data.currency} />)}
    </ListShell>
  );
}
