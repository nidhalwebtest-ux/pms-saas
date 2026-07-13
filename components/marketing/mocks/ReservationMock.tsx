import { getTranslations } from "next-intl/server";

/* ============================================================================
 *  Reservations calendar mock — timeline grid with colour-coded booking bars.
 *  The grid is forced dir="ltr" so bars read left-to-right in both locales.
 * ========================================================================= */

type CalRow = { unit: string; start: number; span: number; color: string; label: string };

export async function ReservationMock() {
  const t = await getTranslations("marketing.cal");
  const days = t.raw("days") as string[];
  const rows = t.raw("rows") as CalRow[];

  return (
    <div className="bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-[18px] py-3.5">
        <span className="text-[14px] font-semibold text-gray-900">{t("title")}</span>
        <span className="font-mono text-[12.5px] font-semibold text-gray-500">{t("month")}</span>
      </div>
      <div className="px-[18px] py-4">
        <div className="grid grid-cols-[70px_repeat(7,1fr)] gap-[5px]" dir="ltr">
          <div />
          {days.map((d, i) => (
            <div key={i} className="pb-[5px] text-center font-mono text-[11px] font-semibold text-gray-400">{d}</div>
          ))}
        </div>
        {rows.map((row) => (
          <div key={row.unit} className="mt-[5px] grid grid-cols-[70px_repeat(7,1fr)] items-center gap-[5px]" dir="ltr">
            <div className="truncate text-[11.5px] font-semibold text-gray-900">{row.unit}</div>
            <div
              className="flex h-[26px] items-center overflow-hidden whitespace-nowrap rounded-[7px] px-[9px] text-[11px] font-semibold text-white"
              style={{ gridColumn: `${row.start} / span ${row.span}`, background: row.color }}
            >
              {row.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
