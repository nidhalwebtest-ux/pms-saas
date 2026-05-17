"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "../EmptyState";
import { ReceiptIllustration } from "../illustrations";

export function NoPaymentsFirstTime({ onRecord }: { onRecord: () => void }) {
  const t = useTranslations("emptyState.payments.firstTime");
  return (
    <EmptyState
      variant="encouraging"
      illustration={<ReceiptIllustration />}
      title={t("title")}
      description={t("description")}
      primaryAction={{ label: t("primary"), onClick: onRecord }}
    />
  );
}
