"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "../EmptyState";
import MailSuccessIllustration from "@/public/illustrations/mail-success.svg?react";
import SearchIllustration from "@/public/illustrations/search.svg?react";

export function NoExpensesPending({
  onViewApproved,
}: {
  onViewApproved?: () => void;
}) {
  const t = useTranslations("emptyState.expenses.pending");
  return (
    <EmptyState
      variant="positive"
      illustration={<MailSuccessIllustration />}
      title={t("title")}
      description={t("description")}
      primaryAction={
        onViewApproved
          ? { label: t("primary"), onClick: onViewApproved }
          : undefined
      }
    />
  );
}

export function NoExpensesForFilters({
  onClearFilters,
}: {
  onClearFilters: () => void;
}) {
  const t = useTranslations("emptyState.expenses.filtered");
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
