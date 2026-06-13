"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import SalesTargetsGrid from "./SalesTargetsGrid";
import SalesPerformance from "./SalesPerformance";
import type { SavedTarget } from "./actions";

interface Entity { id: string; name: string; role?: string; group?: string }
interface Props {
  receptionists: Entity[];
  buildings: Entity[];
  units: Entity[];
  initialTargets: SavedTarget[];
}

export default function SalesTargetsView(props: Props) {
  const t = useTranslations("salesTargets");
  const [tab, setTab] = useState<"set" | "performance">("set");

  const tabCls = (active: boolean) =>
    `px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
      active ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
    }`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button type="button" onClick={() => setTab("set")} className={tabCls(tab === "set")}>{t("tabs.set")}</button>
        <button type="button" onClick={() => setTab("performance")} className={tabCls(tab === "performance")}>{t("tabs.performance")}</button>
      </div>

      {tab === "set" ? (
        <SalesTargetsGrid
          receptionists={props.receptionists}
          buildings={props.buildings}
          units={props.units}
          initialTargets={props.initialTargets}
        />
      ) : (
        <SalesPerformance />
      )}
    </div>
  );
}
