"use client";

import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";
import { EmptyState } from "../EmptyState";

export function NoInvoicesFirstTime({ onCreate }: { onCreate: () => void }) {
  const t = useTranslations("emptyState.invoices.firstTime");
  return (
    <EmptyState
      variant="encouraging"
      illustration={<DocumentTextIcon />}
      title={t("title")}
      description={t("description")}
      primaryAction={{ label: t("primary"), onClick: onCreate }}
    />
  );
}

export function NoInvoicesForFilters({
  onClearFilters,
}: {
  onClearFilters: () => void;
}) {
  const t = useTranslations("emptyState.invoices.filtered");
  return (
    <EmptyState
      variant="exploratory"
      illustration={<DocumentTextIcon />}
      title={t("title")}
      description={t("description")}
      primaryAction={{ label: t("primary"), onClick: onClearFilters }}
    />
  );
}
