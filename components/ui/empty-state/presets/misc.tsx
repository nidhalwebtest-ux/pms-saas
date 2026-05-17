"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "../EmptyState";
import { NoActivity } from "../illustrations/NoActivity";
import { NoSearchResults as NoSearchResultsIllustration } from "../illustrations/NoSearchResults";
import { ComingSoon as ComingSoonIllustration } from "../illustrations/ComingSoon";
import { UnitsAvailable as UnitsAvailableIllustration } from "../illustrations/UnitsAvailable";

export function NoActivityYet({ onTakeTour }: { onTakeTour?: () => void }) {
  const t = useTranslations("emptyState.activity");
  return (
    <EmptyState
      variant="encouraging"
      illustration={<NoActivity />}
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
      illustration={<NoSearchResultsIllustration />}
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
      illustration={<ComingSoonIllustration />}
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
      illustration={<UnitsAvailableIllustration />}
      title={t("title")}
      description={t("description", { dateRange })}
    />
  );
}
