"use client";

import {
  BuildingOffice2Icon,
  HomeModernIcon,
} from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";
import { EmptyState } from "../EmptyState";

export function NoBuildingsFirstTime({ onCreate }: { onCreate: () => void }) {
  const t = useTranslations("emptyState.buildings.firstTime");
  return (
    <EmptyState
      variant="encouraging"
      illustration={<BuildingOffice2Icon />}
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
      illustration={<HomeModernIcon />}
      title={t("title", { buildingName })}
      description={t("description")}
      primaryAction={{ label: t("primary"), onClick: onCreate }}
    />
  );
}
