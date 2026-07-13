import { getTranslations } from "next-intl/server";

/* ============================================================================
 *  Hero dashboard mock — the product window on the hero. KPI grid + today's
 *  reservation list, matching the Binaya Landing redesign. Pure presentation.
 * ========================================================================= */

type HeroRow = {
  unit: string; guest: string; amount: string;
  color: string; status: string; badgeBg: string; badgeFg: string;
};

const KPIS: { value: string; key: "k1" | "k2" | "k3" | "k4"; valueColor: string; bg: string; small?: boolean }[] = [
  { value: "24",    key: "k1", valueColor: "#185FA5", bg: "#eaf3fc" },
  { value: "92%",   key: "k2", valueColor: "#1f9d64", bg: "#eafaf1" },
  { value: "7",     key: "k3", valueColor: "#d98315", bg: "#fff4e6" },
  { value: "2.100", key: "k4", valueColor: "#7c4ec2", bg: "#f3ecfb", small: true },
];

export async function HeroDashboardMock() {
  const t = await getTranslations("marketing.hero");
  const rows = t.raw("rows") as HeroRow[];

  return (
    <div className="bg-white">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-4 py-3">
        <i className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <i className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <i className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ms-2.5 text-[12.5px] font-semibold text-gray-600">{t("mockTitle")}</span>
      </div>

      <div className="p-[18px]">
        {/* KPI grid */}
        <div className="grid grid-cols-4 gap-2.5">
          {KPIS.map((k) => (
            <div key={k.key} className="rounded-[11px] px-[11px] py-3" style={{ background: k.bg }}>
              <div
                className={["font-mono font-semibold", k.small ? "mt-[5px] text-[15px]" : "text-[22px]"].join(" ")}
                style={{ color: k.valueColor }}
                dir="ltr"
              >
                {k.value}
              </div>
              <div className="mt-0.5 text-[11.5px] text-gray-600">{t(k.key)}</div>
            </div>
          ))}
        </div>

        {/* Reservation list */}
        <div className="mt-3.5 overflow-hidden rounded-xl border border-gray-200">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3.5 py-[11px]">
            <span className="text-[13px] font-semibold text-gray-900">{t("listTitle")}</span>
            <span className="text-[11.5px] text-gray-400">{t("today")}</span>
          </div>
          {rows.map((r) => (
            <div key={r.unit} className="flex items-center gap-[11px] border-b border-gray-200 px-3.5 py-[11px] last:border-b-0">
              <span className="h-[34px] w-2 flex-none rounded-[5px]" style={{ background: r.color }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-gray-900">{r.unit}</div>
                <div className="text-[11.5px] text-gray-400">{r.guest}</div>
              </div>
              <span className="font-mono text-[12.5px] font-semibold text-gray-900" dir="ltr">{r.amount}</span>
              <span
                className="rounded-full px-[9px] py-[3px] text-[11px] font-semibold"
                style={{ background: r.badgeBg, color: r.badgeFg }}
              >
                {r.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
