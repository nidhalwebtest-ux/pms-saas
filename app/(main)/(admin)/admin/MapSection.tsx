"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { MapIcon } from "@heroicons/react/24/outline";
import type { MapProspect } from "./ProspectsMap";

const ProspectsMap = dynamic(() => import("./ProspectsMap"), {
  ssr: false,
  loading: () => <div className="h-[380px] w-full animate-pulse rounded-xl bg-subtle" />,
});

export type AreaLegend = { id: string; label: string; color: string; count: number };

export default function MapSection({
  prospects,
  legend,
  unmappedCount,
}: {
  prospects: MapProspect[];
  legend: AreaLegend[];
  unmappedCount: number;
}) {
  const t = useTranslations("admin");

  return (
    <div className="rounded-2xl border border-border-default bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapIcon className="h-5 w-5 text-brand-600" />
          <h3 className="text-sm font-semibold text-fg">{t("map.title")}</h3>
        </div>
        {unmappedCount > 0 && (
          <span className="text-xs text-fg-tertiary">{t("map.unmapped", { n: unmappedCount })}</span>
        )}
      </div>

      {prospects.length === 0 ? (
        <div className="flex h-[200px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border-default text-center">
          <MapIcon className="h-9 w-9 text-fg-tertiary/40" />
          <p className="text-sm text-fg-tertiary">{t("map.empty")}</p>
        </div>
      ) : (
        <>
          <ProspectsMap prospects={prospects} />
          {legend.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {legend.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1.5 text-xs text-fg-secondary">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                  {a.label}
                  <span className="text-fg-tertiary">({a.count})</span>
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
