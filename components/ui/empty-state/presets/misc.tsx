"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "../EmptyState";
import ClockIllustration from "@/public/illustrations/clock.svg?react";
import SearchIllustration from "@/public/illustrations/search.svg?react";
import KeySuccessIllustration from "@/public/illustrations/key-success.svg?react";

export function NoActivityYet({ onTakeTour }: { onTakeTour?: () => void }) {
  const t = useTranslations("emptyState.activity");
  return (
    <EmptyState
      variant="encouraging"
      illustration={<ClockIllustration />}
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
      illustration={<SearchIllustration />}
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
      illustration={<ClockIllustration />}
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
      illustration={<KeySuccessIllustration />}
      title={t("title")}
      description={t("description", { dateRange })}
    />
  );
}
