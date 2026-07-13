import { getTranslations } from "next-intl/server";
import { Check, X } from "lucide-react";

/* ============================================================================
 *  Phone expenses mock — a styled mobile "approve expenses" screen inside a
 *  device frame. Replaces the redesign's image-slot placeholder with a real
 *  self-contained UI, consistent with the other feature mocks.
 * ========================================================================= */

type ExpenseRow = { title: string; meta: string; amt: string; tint: string };

// Category labels come from i18n; amounts/meta are illustrative and locale-agnostic.
export async function PhoneExpensesMock() {
  const t = await getTranslations("marketing.expenses");
  const rows = t.raw("rows") as ExpenseRow[];

  return (
    <div className="flex justify-center">
      <div className="relative h-[552px] w-[270px] rounded-[42px] bg-[#0f2740] p-3 shadow-[0_30px_60px_-26px_rgba(15,39,64,.45)]">
        {/* Notch */}
        <div className="absolute start-1/2 top-3.5 z-10 h-6 w-[110px] -translate-x-1/2 rounded-b-[14px] bg-[#0f2740] rtl:translate-x-1/2" />
        {/* Screen */}
        <div className="relative h-full w-full overflow-hidden rounded-[32px] bg-gray-50">
          {/* App header */}
          <div className="bg-brand-500 px-4 pb-4 pt-9 text-white">
            <div className="text-[11px] font-medium uppercase tracking-wide text-white/70">{t("app")}</div>
            <div className="mt-0.5 text-[17px] font-bold">{t("title")}</div>
            <div className="mt-3 rounded-xl bg-white/12 px-3 py-2.5 backdrop-blur">
              <div className="text-[10.5px] text-white/70">{t("pendingLabel")}</div>
              <div className="font-mono text-[20px] font-semibold" dir="ltr">OMR 268.500</div>
            </div>
          </div>

          {/* Expense cards */}
          <div className="space-y-2.5 p-3.5">
            {rows.map((r) => (
              <div key={r.title} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-gray-900">{r.title}</div>
                    <div className="mt-0.5 text-[11px] text-gray-400">{r.meta}</div>
                  </div>
                  <span className="font-mono text-[13px] font-semibold text-gray-900" dir="ltr">{r.amt}</span>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="h-9 w-9 flex-none rounded-lg" style={{ background: r.tint }} />
                  <div className="flex flex-1 gap-2">
                    <span className="flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-[#eafaf1] text-[12px] font-semibold text-[#1f9d64]">
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> {t("approve")}
                    </span>
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#fdeeeb] text-[#d9542b]">
                      <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
