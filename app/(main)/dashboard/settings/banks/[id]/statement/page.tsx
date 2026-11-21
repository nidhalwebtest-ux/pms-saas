import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { format, startOfMonth, endOfMonth, startOfYear, subMonths } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import { ArrowLeftIcon, BuildingLibraryIcon } from "@heroicons/react/24/outline";
import { requireOrgUser } from "@/lib/tenant";
import { getBankStatement } from "@/lib/bank-statement";
import StatementExport from "./StatementExport";

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

export default async function BankStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; preset?: string }>;
}) {
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { redirect("/login"); }

  const { id } = await params;
  const sp = await searchParams;
  const now = new Date();

  const from = parseDate(sp.from, startOfMonth(now));
  const to   = endOfDay(parseDate(sp.to, endOfMonth(now)));

  const stmt = await getBankStatement({ orgId: orgUser!.organizationId, bankAccountId: id, from, to });
  if (!stmt) notFound();

  const locale = await getLocale();
  const dfLocale = locale === "ar" ? arLocale : enLocale;
  const t = await getTranslations("settings.banks.statement");

  const cur = stmt.account.currency;
  const money = (n: number) => `${n.toFixed(3)} ${cur}`;
  const fmtD = (iso: string) => format(new Date(iso), "d MMM yyyy", { locale: dfLocale });

  // Date-range presets (links carry from/to in the query).
  const iso = (d: Date) => format(d, "yyyy-MM-dd");
  const presets = [
    { key: "thisMonth", from: startOfMonth(now), to: endOfMonth(now) },
    { key: "lastMonth", from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) },
    { key: "thisYear",  from: startOfYear(now), to: now },
    { key: "all",       from: new Date(2000, 0, 1), to: now },
  ];

  const typeLabel = (ty: string) => (t.has(`types.${ty}`) ? t(`types.${ty}`) : ty);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link href="/dashboard/settings/banks" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeftIcon className="h-5 w-5 text-gray-500 rtl:rotate-180" />
        </Link>
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <BuildingLibraryIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {stmt.account.bankName}{stmt.account.label ? ` — ${stmt.account.label}` : ""}
            </h1>
            <p className="text-xs text-gray-500">
              {t("title")}
              {stmt.account.accountNumber ? ` · ${stmt.account.accountNumber}` : ""}
              {" · "}{fmtD(stmt.from)} – {fmtD(stmt.to)}
            </p>
          </div>
        </div>
        <div className="ms-auto">
          <StatementExport bankId={id} from={iso(from)} to={iso(to)} statement={stmt} />
        </div>
      </div>

      {/* Presets */}
      <div className="mb-4 flex flex-wrap gap-2">
        {presets.map((p) => (
          <Link
            key={p.key}
            href={`?from=${iso(p.from)}&to=${iso(p.to)}`}
            className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            {t(`presets.${p.key}`)}
          </Link>
        ))}
      </div>

      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label={t("opening")} value={money(stmt.openingBalance)} />
        <SummaryCard label={t("totalIn")} value={money(stmt.totalIn)} tone="green" />
        <SummaryCard label={t("totalOut")} value={money(stmt.totalOut)} tone="red" />
        <SummaryCard label={t("closing")} value={money(stmt.closingBalance)} tone="bold" />
      </div>

      {/* Ledger */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {["date", "type", "description", "reference", "in", "out", "balance"].map((c) => (
                  <th key={c} className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap ${c === "in" || c === "out" || c === "balance" ? "text-end" : "text-start"}`}>
                    {t(`col.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <tr className="bg-gray-50/60">
                <td className="px-4 py-2.5 text-sm text-gray-500" colSpan={6}>{t("openingRow")}</td>
                <td className="px-4 py-2.5 text-sm font-semibold text-gray-700 text-end ltr-numbers">{money(stmt.openingBalance)}</td>
              </tr>
              {stmt.rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 text-sm text-gray-600 whitespace-nowrap ltr-numbers">{fmtD(r.date)}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-700 whitespace-nowrap">{typeLabel(r.type)}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{r.description || "—"}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-400 ltr-numbers">{r.reference || "—"}</td>
                  <td className="px-4 py-2.5 text-sm text-green-700 text-end ltr-numbers">{r.amount > 0 ? money(r.amount) : ""}</td>
                  <td className="px-4 py-2.5 text-sm text-red-600 text-end ltr-numbers">{r.amount < 0 ? money(Math.abs(r.amount)) : ""}</td>
                  <td className="px-4 py-2.5 text-sm font-medium text-gray-900 text-end ltr-numbers">{money(r.balance)}</td>
                </tr>
              ))}
              {stmt.rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">{t("empty")}</td></tr>
              )}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td className="px-4 py-3 text-sm font-semibold text-gray-700" colSpan={4}>{t("closing")}</td>
                <td className="px-4 py-3 text-sm font-semibold text-green-700 text-end ltr-numbers">{money(stmt.totalIn)}</td>
                <td className="px-4 py-3 text-sm font-semibold text-red-600 text-end ltr-numbers">{money(stmt.totalOut)}</td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900 text-end ltr-numbers">{money(stmt.closingBalance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" | "bold" }) {
  const valueCls =
    tone === "green" ? "text-green-700" :
    tone === "red"   ? "text-red-600" :
    tone === "bold"  ? "text-gray-900 font-bold" : "text-gray-900";
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ltr-numbers ${valueCls}`}>{value}</p>
    </div>
  );
}
