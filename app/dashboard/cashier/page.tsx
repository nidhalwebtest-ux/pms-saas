import { getTranslations, getLocale } from "next-intl/server";
import { format } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import { assertView } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getCashierSummary } from "@/lib/cashier";
import DateField from "./DateField";
import ReconcileForm from "./ReconcileForm";

const METHODS = ["CASH", "CARD", "BANK_TRANSFER", "CHEQUE", "ONLINE", "OTHER"] as const;

export default async function CashierPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const access = await assertView("reconciliation");
  const orgUser = await requireOrgUser();
  const sp = await searchParams;

  const today = new Date();
  const date = sp.date && !isNaN(new Date(sp.date).getTime()) ? new Date(sp.date) : today;
  const dateStr = format(date, "yyyy-MM-dd");

  const [summary, banks, recent] = await Promise.all([
    getCashierSummary({ orgId: orgUser.organizationId, date }),
    prisma.bankAccount.findMany({
      where: { organizationId: orgUser.organizationId, isActive: true },
      select: { id: true, bankName: true, label: true, isDefault: true, isActive: true },
      orderBy: [{ isDefault: "desc" }, { bankName: "asc" }],
    }),
    prisma.cashierSession.findMany({
      where: { organizationId: orgUser.organizationId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        cashier: { select: { firstName: true, lastName: true } },
        depositBankAccount: { select: { bankName: true } },
      },
    }),
  ]);

  const locale = await getLocale();
  const dfLocale = locale === "ar" ? arLocale : enLocale;
  const t = await getTranslations("settings.cashier");
  const tMethod = await getTranslations("payments.methods");
  const money = (n: number) => `${n.toFixed(3)} OMR`;

  const canReconcile = access.canCreate("reconciliation");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <BanknotesIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-sm text-gray-500">{t("subtitle")}</p>
          </div>
        </div>
        <DateField date={dateStr} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label={t("expectedCash")} value={money(summary.expectedCash)} tone="bold" hint={t("expectedCashHint")} />
        <Card label={tMethod("CARD")} value={money(summary.byMethod.CARD)} />
        <Card label={tMethod("BANK_TRANSFER")} value={money(summary.byMethod.BANK_TRANSFER)} />
        <Card label={t("totalCollected")} value={money(summary.totalCollected)} tone="green" />
      </div>

      {/* By method + by cashier */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">{t("byMethod")}</h3>
          <dl className="space-y-1.5">
            {METHODS.map((m) => (
              <div key={m} className="flex justify-between text-sm">
                <dt className="text-gray-500">{tMethod(m)}</dt>
                <dd className="font-medium text-gray-900 ltr-numbers">{money(summary.byMethod[m] ?? 0)}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-gray-100 pt-1.5 text-sm">
              <dt className="font-semibold text-gray-700">{t("totalCollected")}</dt>
              <dd className="font-bold text-gray-900 ltr-numbers">{money(summary.totalCollected)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">{t("byCashier")}</h3>
          {summary.byCashier.length === 0 ? (
            <p className="text-sm text-gray-400">{t("noPayments")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-1.5 text-start">{t("cashier")}</th>
                    <th className="py-1.5 text-end">{tMethod("CASH")}</th>
                    <th className="py-1.5 text-end">{t("total")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {summary.byCashier.map((c) => (
                    <tr key={c.userId}>
                      <td className="py-2 text-gray-700">{c.name}</td>
                      <td className="py-2 text-end text-gray-600 ltr-numbers">{money(c.cash)}</td>
                      <td className="py-2 text-end font-medium text-gray-900 ltr-numbers">{money(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Reconcile + deposit */}
      {canReconcile && (
        <ReconcileForm
          businessDate={dateStr}
          expectedCash={summary.expectedCash}
          banks={banks}
        />
      )}

      {/* Recent sessions */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-700">{t("recent")}</h3>
        </div>
        {recent.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">{t("noSessions")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr className="text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-2 text-start">{t("col.date")}</th>
                  <th className="px-4 py-2 text-start">{t("col.cashier")}</th>
                  <th className="px-4 py-2 text-end">{t("col.expected")}</th>
                  <th className="px-4 py-2 text-end">{t("col.counted")}</th>
                  <th className="px-4 py-2 text-end">{t("col.variance")}</th>
                  <th className="px-4 py-2 text-start">{t("col.deposit")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recent.map((s) => {
                  const v = Number(s.variance);
                  return (
                    <tr key={s.id}>
                      <td className="px-4 py-2.5 text-gray-700 ltr-numbers">{format(new Date(s.businessDate), "d MMM yyyy", { locale: dfLocale })}</td>
                      <td className="px-4 py-2.5 text-gray-600">{`${s.cashier.firstName ?? ""} ${s.cashier.lastName ?? ""}`.trim()}</td>
                      <td className="px-4 py-2.5 text-end text-gray-600 ltr-numbers">{money(Number(s.systemCash))}</td>
                      <td className="px-4 py-2.5 text-end text-gray-600 ltr-numbers">{money(Number(s.countedCash))}</td>
                      <td className={`px-4 py-2.5 text-end font-medium ltr-numbers ${Math.abs(v) < 0.001 ? "text-green-600" : "text-red-600"}`}>
                        {v > 0 ? "+" : ""}{money(v)}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">
                        {s.depositBankAccount ? `${s.depositBankAccount.bankName} · ${money(Number(s.depositedAmount ?? 0))}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, tone, hint }: { label: string; value: string; tone?: "green" | "bold"; hint?: string }) {
  const cls = tone === "green" ? "text-green-700" : tone === "bold" ? "text-gray-900 font-bold" : "text-gray-900";
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ltr-numbers ${cls}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-gray-400">{hint}</p>}
    </div>
  );
}
