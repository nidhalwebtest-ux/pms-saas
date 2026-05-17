"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "../EmptyState";
import { NoBuildings } from "../illustrations/NoBuildings";
import { NoUnits } from "../illustrations/NoUnits";

export function NoBuildingsFirstTime({ onCreate }: { onCreate: () => void }) {
  const t = useTranslations("emptyState.buildings.firstTime");
  return (
    <EmptyState
      variant="encouraging"
      illustration={<NoBuildings />}
      title={t("title")}
      description={t("description")}
      primaryAction={{ label: t("primary"), onClick: onCreate }}
    />
  );
}

export function NoUnitsForBuilding({
  buildingName,
  onCreate,
}: {
  buildingName: string;
  onCreate: () => void;
}) {
  const t = useTranslations("emptyState.buildings.noUnits");
  return (
    <EmptyState
      variant="encouraging"
      illustration={<NoUnits />}
      title={t("title", { buildingName })}
      description={t("description")}
      primaryAction={{ label: t("primary"), onClick: onCreate }}
    />
  );
}
