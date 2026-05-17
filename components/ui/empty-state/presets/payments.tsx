"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "../EmptyState";
import { NoPayments } from "../illustrations/NoPayments";

export function NoPaymentsFirstTime({ onRecord }: { onRecord: () => void }) {
  const t = useTranslations("emptyState.payments.firstTime");
  return (
    <EmptyState
      variant="encouraging"
      illustration={<NoPayments />}
      title={t("title")}
      description={t("description")}
      primaryAction={{ label: t("primary"), onClick: onRecord }}
    />
  );
}
