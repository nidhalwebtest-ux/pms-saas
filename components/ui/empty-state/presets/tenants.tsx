"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "../EmptyState";
import {
  PersonIllustration,
  SearchIllustration,
} from "../illustrations";

export function NoTenantsFirstTime({
  onCreate,
  onImport,
}: {
  onCreate: () => void;
  onImport?: () => void;
}) {
  const t = useTranslations("emptyState.tenants.firstTime");
  return (
    <EmptyState
      variant="encouraging"
      illustration={<PersonIllustration />}
      title={t("title")}
      description={t("description")}
      primaryAction={{ label: t("primary"), onClick: onCreate }}
      secondaryAction={
        onImport ? { label: t("secondary"), onClick: onImport } : undefined
      }
    />
  );
}

export function NoTenantsForSearch({
  query,
  onClear,
  onCreate,
}: {
  query: string;
  onClear: () => void;
  onCreate?: () => void;
}) {
  const t = useTranslations("emptyState.tenants.filtered");
  return (
    <EmptyState
      variant="exploratory"
      illustration={<SearchIllustration />}
      title={t("title", { query })}
      description={t("description")}
      primaryAction={{ label: t("primary"), onClick: onClear }}
      secondaryAction={
        onCreate ? { label: t("secondary"), onClick: onCreate } : undefined
      }
    />
  );
}
