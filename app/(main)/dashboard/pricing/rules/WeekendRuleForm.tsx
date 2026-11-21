"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/Button";
import { NumberField } from "@/components/ui/form/NumberField";
import { saveWeekendRule } from "../actions";

const WEEK = [0, 1, 2, 3, 4, 5, 6]; // JS weekdays, Sunday first (Oman week)
const SAMPLE_BAISA = 20000; // 20.000 OMR example night

export default function WeekendRuleForm({ canEdit, initialDays, initialPct }: { canEdit: boolean; initialDays: number[]; initialPct: number }) {
  const t = useTranslations("pricing.rules");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [days, setDays] = useState<number[]>(initialDays);
  const [pct, setPct] = useState<number>(initialPct);

  // 2023-01-01 was a Sunday → weekday names in the viewer's language
  const dayName = useMemo(() => {
    const long = new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB", { weekday: "long", timeZone: "UTC" });
    return (d: number) => long.format(new Date(Date.UTC(2023, 0, 1 + d)));
  }, [locale]);

  const toggle = (d: number) => setDays((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d].sort()));
  const active = days.length > 0 && pct !== 0;
  const adjusted = Math.max(0, Math.round((SAMPLE_BAISA * (100 + pct)) / 100));
  const dirty = pct !== initialPct || days.join() !== [...initialDays].sort().join();

  const save = () =>
    start(async () => {
      const res = await saveWeekendRule({ days, pct });
      if (!res.ok) return void toast.error(res.error);
      toast.success(t("saved"));
      router.refresh();
    });

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-brand-50 p-2">
          <CalendarDaysIcon className="h-5 w-5 text-brand-700" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{t("weekendTitle")}</h2>
          <p className="mt-0.5 text-xs text-gray-500">{t("weekendHint")}</p>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-700">{t("days")}</p>
            {canEdit && (
              <button type="button" onClick={() => setDays([4, 5])} className="text-xs font-medium text-brand-600 hover:underline">
                {t("suggest")}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {WEEK.map((d) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  disabled={!canEdit}
                  aria-pressed={on}
                  onClick={() => toggle(d)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed ${
                    on ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {dayName(d)}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-gray-500">{t("daysHint")}</p>
        </div>

        <div className="max-w-xs">
          <NumberField
            label={t("pct")}
            value={pct}
            min={-90}
            max={500}
            step={1}
            disabled={!canEdit}
            onValueChange={(n) => setPct(n === null ? 0 : Math.round(n))}
            helperText={t("pctHint")}
          />
        </div>

        <div className={`rounded-xl px-4 py-3 text-sm ${active ? "bg-brand-50 text-brand-800" : "bg-gray-50 text-gray-600"}`}>
          {active
            ? t("example", {
                rate: (SAMPLE_BAISA / 1000).toFixed(3),
                adjusted: (adjusted / 1000).toFixed(3),
                days: days.map(dayName).join(locale === "ar" ? "، " : ", "),
              })
            : t("off")}
          <p className="mt-1 text-xs opacity-80">{t("seasonsNote")}</p>
        </div>

        {canEdit && (
          <div className="flex justify-end">
            <Button variant="primary" onClick={save} loading={pending} disabled={!dirty}>
              {t("save")}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
