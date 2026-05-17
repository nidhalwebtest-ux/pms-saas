"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "../EmptyState";
import { NoReservations } from "../illustrations/NoReservations";
import { NoResults } from "../illustrations/NoResults";

export function NoReservationsFirstTime({
  onCreate,
  onImport,
}: {
  onCreate: () => void;
  onImport?: () => void;
}) {
  const t = useTranslations("emptyState.reservations.firstTime");
  return (
    <EmptyState
      variant="encouraging"
      illustration={<NoReservations />}
      title={t("title")}
      description={t("description")}
      primaryAction={{ label: t("primary"), onClick: onCreate }}
      secondaryAction={
        onImport ? { label: t("secondary"), onClick: onImport } : undefined
      }
    />
  );
}

export function NoReservationsForFilters({
  onClearFilters,
}: {
  /**
   * Spec passes a `filters: FilterSummary` here so the description can echo
   * active facets. Until FilterBar lands the description is generic — wire
   * up the prop when the spec for FilterSummary stabilizes.
   */
  onClearFilters: () => void;
}) {
  const t = useTranslations("emptyState.reservations.filtered");
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
