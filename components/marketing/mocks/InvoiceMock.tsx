import { getTranslations } from "next-intl/server";

/* ============================================================================
 *  Invoice mock — a clean OMR invoice card with line items and a total.
 *  Amounts stay dir="ltr" so the numerals read correctly in Arabic too.
 * ========================================================================= */

type InvRow = { name: string; amt: string };

export async function InvoiceMock() {
  const t = await getTranslations("marketing.inv");
  const rows = t.raw("rows") as InvRow[];

  return (
    <div className="mx-auto max-w-[440px] bg-white">
      <div className="flex items-start justify-between border-b border-gray-200 px-5 py-[18px]">
        <div>
          <div className="text-[15px] font-semibold text-gray-900">{t("title")}</div>
          <div className="mt-[3px] font-mono text-[12px] text-gray-400">{t("no")}</div>
        </div>
        <span className="rounded-full bg-[#eafaf1] px-[11px] py-1 text-[11.5px] font-bold text-[#1f9d64]">
          {t("paid")}
        </span>
      </div>

      <div className="px-5 py-2">
        {rows.map((l) => (
          <div key={l.name} className="flex items-center justify-between border-b border-gray-200 py-[11px] last:border-b-0">
            <span className="text-[14px] text-gray-600">{l.name}</span>
            <span className="font-mono text-[14px] font-semibold text-gray-900" dir="ltr">{l.amt}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between bg-gray-50 px-5 py-4">
        <span className="text-[14px] font-bold text-gray-900">{t("total")}</span>
        <span className="font-mono text-[22px] font-semibold text-brand-500" dir="ltr">{t("totalAmt")}</span>
      </div>
    </div>
  );
}
