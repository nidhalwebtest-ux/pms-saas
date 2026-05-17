"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "../EmptyState";
import { BuildingIllustration } from "../illustrations";

export function NoBuildingsFirstTime({ onCreate }: { onCreate: () => void }) {
  const t = useTranslations("emptyState.buildings.firstTime");
  return (
    <EmptyState
      variant="encouraging"
      illustration={<BuildingIllustration />}
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
      illustration={<BuildingIllustration />}
      title={t("title", { buildingName })}
      description={t("description")}
      primaryAction={{ label: t("primary"), onClick: onCreate }}
    />
  );
}
