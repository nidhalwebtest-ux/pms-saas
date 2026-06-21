import { getTranslations, getLocale } from "next-intl/server";
import { format } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import { assertView } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getSelectedPropertyId } from "@/lib/selected-property";
import { getSessionAccessibleProperties } from "@/lib/property-scope";
import { getCashierDaybook } from "@/lib/cashier-daybook";
import DateField from "./DateField";
import BuildingField from "./BuildingField";
import ReconcileForm from "./ReconcileForm";

export default async function CashierPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; propertyId?: string }>;
}) {
  const access = await assertView("reconciliation");
  const orgUser = await requireOrgUser();
  const sp = await searchParams;
  const orgId = orgUser.organizationId;

  const today = new Date();
  const date = sp.date && !isNaN(new Date(sp.date).getTime()) ? new Date(sp.date) : today;
  const dateStr = format(date, "yyyy-MM-dd");

  // Buildings the user may see (null = unrestricted).
  const accessible = await getSessionAccessibleProperties();
  const buildings = await prisma.property.findMany({
    where: {
      organizationId: orgId,
      isArchived: false,
      ...(accessible ? { id: { in: accessible } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const t = await getTranslations("settings.cashier");
  const tMethod = await getTranslations("payments.methods");
  const locale = await getLocale();
  const dfLocale = locale === "ar" ? arLocale : enLocale;
  const money = (n: number) => `${n.toFixed(3)} OMR`;

  if (buildings.length === 0) {
    return (
      <div className="max-w-5xl mx-auto">
        <Header t={t} />
        <div className="mt-6 rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-200">
          <p className="text-sm text-gray-400">{t("noBuildings")}</p>
        </div>
      </div>
    );
  }

  // Resolve the active building: URL → sidebar cookie → first accessible.
  const cookieProp = await getSelectedPropertyId();
  const requested = sp.propertyId || cookieProp || "";
  const propertyId = buildings.some((b) => b.id === requested) ? requested : buildings[0].id;

  const daybook = await getCashierDaybook({ orgId, propertyId, date });

  // Day bounds for the selected business date.
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);

  // Is this building/day already locked?
  const lockedSession = await prisma.cashierSession.findFirst({
    where: { organizationId: orgId, propertyId, status: "LOCKED", businessDate: { gte: dayStart, lte: dayEnd } },
  });

  const recent = await prisma.cashierSession.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      cashier: { select: { firstName: true, lastName: true } },
      property: { select: { name: true } },
      depositBankAccount: { select: { bankName: true } },
    },
  });

  const canReconcile = access.canCreate("reconciliation");
  const canManage = access.canDelete("reconciliation"); // FULL → unlock

  const locked = lockedSession
    ? {
        id: lockedSession.id,
        countedCash: Number(lockedSession.countedCash),
        variance: Number(lockedSession.variance),
        closingBalance: Number(lockedSession.closingBalance),
        lockedByName: lockedSession.lockedByName,
        lockedAtText: lockedSession.lockedAt
          ? format(new Date(lockedSession.lockedAt), "d MMM yyyy, HH:mm", { locale: dfLocale })
          : null,
        hasAdjustment: !!lockedSession.adjustmentTxnId,
      }
    : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Header t={t} />
        <div className="flex flex-wrap items-center gap-3">
          <BuildingField propertyId={propertyId} date={dateStr} buildings={buildings} />
          <DateField date={dateStr} propertyId={propertyId} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card label={t("openingBalance")} value={money(daybook.openingBalance)} />
        <Card label={t("cashIn")} value={money(daybook.cashIn)} tone="green" />
        <Card label={t("cashOut")} value={money(daybook.cashOut)} tone="red" />
        <Card label={t("closingBalance")} value={money(daybook.closingBalance)} tone="bold" hint={t("closingHint")} />
        <Card label={t("nonCashCollected")} value={money(daybook.nonCashTotal)} hint={t("nonCashHint")} />
      </div>

      {!daybook.hasDrawer && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-700 ring-1 ring-amber-200">
          {t("noDrawerNotice")}
        </div>
      )}

      {/* Daybook */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-700">{t("daybookTitle")}</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">{t("daybookSubtitle")}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr className="text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-2 text-start">{t("col.time")}</th>
                <th className="px-4 py-2 text-start">{t("col.description")}</th>
                <th className="px-4 py-2 text-start">{t("col.method")}</th>
                <th className="px-4 py-2 text-end">{t("col.debit")}</th>
                <th className="px-4 py-2 text-end">{t("col.credit")}</th>
                <th className="px-4 py-2 text-end">{t("col.balance")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {/* Opening balance */}
              <tr className="bg-gray-50/50 font-medium">
                <td className="px-4 py-2.5 text-gray-500" colSpan={5}>{t("openingBalance")}</td>
                <td className="px-4 py-2.5 text-end text-gray-700 ltr-numbers">{money(daybook.openingBalance)}</td>
              </tr>

              {daybook.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">{t("noMovements")}</td>
                </tr>
              ) : (
                daybook.rows.map((r) => (
                  <tr key={r.id} className={r.kind === "NONCASH" ? "bg-blue-50/20" : ""}>
                    <td className="px-4 py-2.5 text-gray-500 ltr-numbers whitespace-nowrap">{format(new Date(r.time), "HH:mm")}</td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {r.description ?? (r.kind === "CASH" ? t(`ledgerType.${r.type}`) : tMethod(r.method ?? "OTHER"))}
                      {r.reference && <span className="ml-1.5 text-xs text-gray-400 ltr-numbers">· {r.reference}</span>}
                      {r.kind === "NONCASH" && (
                        <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">{t("nonCashTag")}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{r.method ? tMethod(r.method) : t(`ledgerType.${r.type}`)}</td>
                    <td className="px-4 py-2.5 text-end text-green-700 ltr-numbers">{r.debit ? money(r.debit) : "—"}</td>
                    <td className="px-4 py-2.5 text-end text-red-600 ltr-numbers">{r.credit ? money(r.credit) : "—"}</td>
                    <td className="px-4 py-2.5 text-end font-medium text-gray-900 ltr-numbers">
                      {r.kind === "CASH" ? money(r.balance) : <span className="text-gray-300">{money(r.balance)}</span>}
                    </td>
                  </tr>
                ))
              )}

              {/* Closing balance */}
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                <td className="px-4 py-2.5 text-gray-700" colSpan={3}>{t("closingBalance")}</td>
                <td className="px-4 py-2.5 text-end text-green-700 ltr-numbers">{money(daybook.cashIn)}</td>
                <td className="px-4 py-2.5 text-end text-red-600 ltr-numbers">{money(daybook.cashOut)}</td>
                <td className="px-4 py-2.5 text-end text-gray-900 ltr-numbers">{money(daybook.closingBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Reconcile & lock (Phase 4 adds the drawer→bank deposit) */}
      {(canReconcile || locked) && (
        <ReconcileForm
          businessDate={dateStr}
          propertyId={propertyId}
          closingBalance={daybook.closingBalance}
          locked={locked}
          canManage={canManage}
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
                  <th className="px-4 py-2 text-start">{t("col.building")}</th>
                  <th className="px-4 py-2 text-start">{t("col.cashier")}</th>
                  <th className="px-4 py-2 text-end">{t("col.expected")}</th>
                  <th className="px-4 py-2 text-end">{t("col.counted")}</th>
                  <th className="px-4 py-2 text-end">{t("col.variance")}</th>
                  <th className="px-4 py-2 text-start">{t("col.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recent.map((s) => {
                  const v = Number(s.variance);
                  const isLocked = s.status === "LOCKED";
                  return (
                    <tr key={s.id}>
                      <td className="px-4 py-2.5 text-gray-700 ltr-numbers">{format(new Date(s.businessDate), "d MMM yyyy", { locale: dfLocale })}</td>
                      <td className="px-4 py-2.5 text-gray-600">{s.property?.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-gray-600">{`${s.cashier.firstName ?? ""} ${s.cashier.lastName ?? ""}`.trim()}</td>
                      <td className="px-4 py-2.5 text-end text-gray-600 ltr-numbers">{money(Number(s.systemCash))}</td>
                      <td className="px-4 py-2.5 text-end text-gray-600 ltr-numbers">{money(Number(s.countedCash))}</td>
                      <td className={`px-4 py-2.5 text-end font-medium ltr-numbers ${Math.abs(v) < 0.001 ? "text-green-600" : "text-red-600"}`}>
                        {v > 0 ? "+" : ""}{money(v)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isLocked ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-700"}`}>
                          {t(`status.${s.status}`)}
                        </span>
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

function Header({ t }: { t: Awaited<ReturnType<typeof getTranslations>> }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        <BanknotesIcon className="h-5 w-5" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <p className="text-sm text-gray-500">{t("subtitle")}</p>
      </div>
    </div>
  );
}

function Card({ label, value, tone, hint }: { label: string; value: string; tone?: "green" | "red" | "bold"; hint?: string }) {
  const cls =
    tone === "green" ? "text-green-700" :
    tone === "red" ? "text-red-600" :
    tone === "bold" ? "text-gray-900 font-bold" : "text-gray-900";
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ltr-numbers ${cls}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-gray-400">{hint}</p>}
    </div>
  );
}
