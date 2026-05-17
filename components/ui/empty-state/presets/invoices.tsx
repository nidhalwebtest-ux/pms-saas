"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "../EmptyState";
import ReceiptIllustration from "@/public/illustrations/receipt.svg?react";
import SearchIllustration from "@/public/illustrations/search.svg?react";

export function NoInvoicesFirstTime({ onCreate }: { onCreate: () => void }) {
  const t = useTranslations("emptyState.invoices.firstTime");
  return (
    <EmptyState
      variant="encouraging"
      illustration={<ReceiptIllustration />}
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
      illustration={<SearchIllustration />}
      title={t("title")}
      description={t("description")}
      primaryAction={{ label: t("primary"), onClick: onClearFilters }}
    />
  );
}
