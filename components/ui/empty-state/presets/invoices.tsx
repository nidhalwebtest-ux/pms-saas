"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "../EmptyState";
import { NoInvoices } from "../illustrations/NoInvoices";
import { NoResults } from "../illustrations/NoResults";

export function NoInvoicesFirstTime({ onCreate }: { onCreate: () => void }) {
  const t = useTranslations("emptyState.invoices.firstTime");
  return (
    <EmptyState
      variant="encouraging"
      illustration={<NoInvoices />}
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
      illustration={<NoResults />}
      title={t("title")}
      description={t("description")}
      primaryAction={{ label: t("primary"), onClick: onClearFilters }}
    />
  );
}
