"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MoonIcon, ReceiptPercentIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/Button";
import { NumberField } from "@/components/ui/form/NumberField";
import { MAX_TIERS, longStayDiscount, type LongStayTier } from "@/lib/stay-rules";
import { saveDefaultMinNights, saveLongStayTiers } from "../actions";

function CardHead({ icon: Icon, title, hint }: { icon: React.ComponentType<{ className?: string }>; title: string; hint: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-brand-50 p-2">
        <Icon className="h-5 w-5 text-brand-700" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
      </div>
    </div>
  );
}

/** Organization default minimum stay (seasons can set their own). */
export function MinNightsCard({ canEdit, initial }: { canEdit: boolean; initial: number }) {
  const t = useTranslations("pricing.rules");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [n, setN] = useState(initial);

  const save = () =>
    start(async () => {
      const res = await saveDefaultMinNights(n);
      if (!res.ok) return void toast.error(res.error);
      toast.success(t("minSaved"));
      router.refresh();
    });

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <CardHead icon={MoonIcon} title={t("minTitle")} hint={t("minHint")} />
      <div className="mt-5 flex flex-wrap items-end gap-4">
        <div className="w-40">
          <NumberField label={t("minLabel")} value={n} min={1} max={365} step={1} disabled={!canEdit} onValueChange={(v) => setN(v === null ? 1 : Math.round(v))} reserveMessageSpace={false} />
        </div>
        <p className="flex-1 pb-2 text-xs text-gray-500">{n <= 1 ? t("minOff") : t("minOn", { n })}</p>
        {canEdit && (
          <Button variant="primary" onClick={save} loading={pending} disabled={n === initial}>
            {t("save")}
          </Button>
        )}
      </div>
    </section>
  );
}

type Row = { minNights: string; percent: string };
const toRows = (tiers: LongStayTier[]): Row[] => tiers.map((x) => ({ minNights: String(x.minNights), percent: String(x.percent) }));

/** Long-stay discount tiers for nightly stays. */
export function LongStayCard({ canEdit, initial }: { canEdit: boolean; initial: LongStayTier[] }) {
  const t = useTranslations("pricing.rules");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(toRows(initial));

  const setRow = (i: number, k: keyof Row, v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const tiers: LongStayTier[] = rows.map((r) => ({ minNights: Number(r.minNights), percent: Number(r.percent) }));
  const dirty = JSON.stringify(rows) !== JSON.stringify(toRows(initial));
  const example = [...tiers].filter((x) => x.minNights >= 2 && x.percent > 0).sort((a, b) => a.minNights - b.minNights)[0];

  const save = () =>
    start(async () => {
      const res = await saveLongStayTiers(tiers);
      if (!res.ok) return void toast.error(res.error);
      toast.success(t("tiersSaved"));
      router.refresh();
    });

  const input = "w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm tabular-nums focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50";

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <CardHead icon={ReceiptPercentIcon} title={t("lsTitle")} hint={t("lsHint")} />

      <div className="mt-5 space-y-2">
        {rows.length === 0 && <p className="text-sm text-gray-500">{t("lsEmpty")}</p>}
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <span>{t("lsFrom")}</span>
            <input className={`${input} w-20`} inputMode="numeric" dir="ltr" value={r.minNights} disabled={!canEdit} onChange={(e) => setRow(i, "minNights", e.target.value)} aria-label={t("lsNights")} />
            <span>{t("lsNightsOrMore")}</span>
            <input className={`${input} w-20`} inputMode="decimal" dir="ltr" value={r.percent} disabled={!canEdit} onChange={(e) => setRow(i, "percent", e.target.value)} aria-label={t("lsPercent")} />
            <span>{t("lsOff")}</span>
            {canEdit && (
              <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label={t("lsRemove")}>
                <TrashIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {canEdit && rows.length < MAX_TIERS && (
          <button
            type="button"
            onClick={() => setRows((x) => [...x, { minNights: x.length === 0 ? "7" : "", percent: x.length === 0 ? "5" : "" }])}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
          >
            <PlusIcon className="h-4 w-4" /> {t("lsAdd")}
          </button>
        )}
      </div>

      <div className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-600">
        {example
          ? t("lsExample", { nights: example.minNights, total: (example.minNights * 20).toFixed(3), discount: longStayDiscount(example.minNights * 20, example.minNights, [example]).amount.toFixed(3) })
          : t("lsOffNote")}
        <p className="mt-1">{t("lsWhere")}</p>
      </div>

      {canEdit && (
        <div className="mt-4 flex justify-end">
          <Button variant="primary" onClick={save} loading={pending} disabled={!dirty}>
            {t("save")}
          </Button>
        </div>
      )}
    </section>
  );
}
