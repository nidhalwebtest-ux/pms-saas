import { getTranslations } from "next-intl/server";

/* ============================================================================
 *  Revenue overview mock — KPI row + a simple gradient bar chart. The chart is
 *  forced dir="ltr" so the month sequence reads left-to-right in both locales.
 * ========================================================================= */

const BARS = [
  { m: "S", h: "46%" }, { m: "O", h: "58%" }, { m: "N", h: "52%" },
  { m: "D", h: "70%" }, { m: "J", h: "64%" }, { m: "F", h: "82%" }, { m: "M", h: "95%" },
];

const KPIS = [
  { key: "k1", value: "88%",    color: "#0f2740" },
  { key: "k2", value: "18.640", color: "#1f9d64" },
  { key: "k3", value: "2.310",  color: "#d98315" },
];

export async function ReportsChartMock() {
  const t = await getTranslations("marketing.rep");

  return (
    <div className="bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <span className="text-[14px] font-semibold text-gray-900">{t("title")}</span>
        <span className="font-mono text-[12px] text-gray-400">{t("range")}</span>
      </div>
      <div className="px-5 py-[18px]">
        <div className="mb-[18px] grid grid-cols-3 gap-3">
          {KPIS.map((k) => (
            <div key={k.key}>
              <div className="text-[12px] text-gray-400">{t(k.key)}</div>
              <div className="font-mono text-[19px] font-semibold" style={{ color: k.color }} dir="ltr">{k.value}</div>
            </div>
          ))}
        </div>
        <div className="flex h-[130px] items-end gap-[9px] pt-1.5" dir="ltr">
          {BARS.map((bar, i) => (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <div
                className="w-full rounded-t-[6px] bg-gradient-to-t from-brand-500 to-brand-300"
                style={{ height: bar.h }}
              />
              <span className="font-mono text-[10px] text-gray-400">{bar.m}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
