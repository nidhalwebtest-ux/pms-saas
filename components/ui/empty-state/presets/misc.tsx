"use client";

import {
  CheckCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";
import { EmptyState } from "../EmptyState";

export function NoActivityYet({ onTakeTour }: { onTakeTour?: () => void }) {
  const t = useTranslations("emptyState.activity");
  return (
    <EmptyState
      variant="encouraging"
      illustration={<ClockIcon />}
      title={t("title")}
      description={t("description")}
      primaryAction={
        onTakeTour ? { label: t("primary"), onClick: onTakeTour } : undefined
      }
    />
  );
}

export function NoSearchResults({
  query,
  onClear,
}: {
  query: string;
  onClear: () => void;
}) {
  const t = useTranslations("emptyState.search");
  return (
    <EmptyState
      variant="exploratory"
      illustration={<MagnifyingGlassIcon />}
      title={t("title", { query })}
      description={t("description")}
      primaryAction={{ label: t("primary"), onClick: onClear }}
    />
  );
}

export function ComingSoon({
  feature,
  onJoinWaitlist,
}: {
  feature: string;
  onJoinWaitlist?: () => void;
}) {
  const t = useTranslations("emptyState.comingSoon");
  return (
    <EmptyState
      variant="neutral"
      illustration={<SparklesIcon />}
      title={t("title", { feature })}
      description={t("description")}
      primaryAction={
        onJoinWaitlist
          ? { label: t("primary"), onClick: onJoinWaitlist }
          : undefined
      }
    />
  );
}

export function UnitsAvailable({ dateRange }: { dateRange: string }) {
  const t = useTranslations("emptyState.unitsAvailable");
  return (
    <EmptyState
      variant="positive"
      illustration={<CheckCircleIcon />}
      title={t("title")}
      description={t("description", { dateRange })}
    />
  );
}
