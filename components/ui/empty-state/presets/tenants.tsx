"use client";

import {
  MagnifyingGlassIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";
import { EmptyState } from "../EmptyState";

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
      illustration={<UserGroupIcon />}
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
      illustration={<MagnifyingGlassIcon />}
      title={t("title", { query })}
      description={t("description")}
      primaryAction={{ label: t("primary"), onClick: onClear }}
      secondaryAction={
        onCreate ? { label: t("secondary"), onClick: onCreate } : undefined
      }
    />
  );
}
