/**
 * Demo product tour — step definitions. Each step targets an existing
 * `data-tour="..."` attribute already added to the real UI (not a fake
 * mock-up), so the tour walks the actual app a visitor will keep using.
 *
 * `route`, when set, means this step's target only exists on that page —
 * the tour advances by navigating there first, then waiting for the
 * selector to appear (see TourOverlay's poll loop) before positioning.
 */
export interface TourStep {
  selector: string;
  titleKey: string;
  bodyKey: string;
  /** Route to navigate to before this step's target can exist. */
  route?: string;
  /** Placement of the tooltip relative to the target. */
  placement: "top" | "bottom" | "left" | "right";
}

export const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="today-tabs"]',
    titleKey: "todayTabs.title",
    bodyKey: "todayTabs.body",
    route: "/dashboard",
    placement: "bottom",
  },
  {
    selector: '[data-tour="availability-fab"]',
    titleKey: "calendarFab.title",
    bodyKey: "calendarFab.body",
    route: "/dashboard",
    placement: "top",
  },
  {
    selector: '[data-tour="calendar-units-list"]',
    titleKey: "calendarUnits.title",
    bodyKey: "calendarUnits.body",
    placement: "right",
  },
  {
    selector: '[data-tour="calendar-reservation-block"]',
    titleKey: "calendarReservation.title",
    bodyKey: "calendarReservation.body",
    placement: "top",
  },
  {
    selector: '[data-tour="calendar-date-filters"]',
    titleKey: "calendarFilters.title",
    bodyKey: "calendarFilters.body",
    placement: "bottom",
  },
  {
    selector: '[data-tour="reservations-table"]',
    titleKey: "reservationsTable.title",
    bodyKey: "reservationsTable.body",
    route: "/dashboard/reservations",
    placement: "top",
  },
];
