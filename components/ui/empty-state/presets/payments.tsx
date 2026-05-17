"use client";

import { BanknotesIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";
import { EmptyState } from "../EmptyState";

export function NoPaymentsFirstTime({ onRecord }: { onRecord: () => void }) {
  const t = useTranslations("emptyState.payments.firstTime");
  return (
    <EmptyState
      variant="encouraging"
      illustration={<BanknotesIcon />}
      title={t("title")}
      description={t("description")}
      primaryAction={{ label: t("primary"), onClick: onRecord }}
    />
  );
}
