export { NoReservations } from "./NoReservations";
export { NoResults } from "./NoResults";
export { NoTenants } from "./NoTenants";
export { NoBuildings } from "./NoBuildings";
export { NoUnits } from "./NoUnits";
export { NoInvoices } from "./NoInvoices";
export { NoPayments } from "./NoPayments";
export { NoExpenses } from "./NoExpenses";
export { AllCaughtUp } from "./AllCaughtUp";
export { NoActivity } from "./NoActivity";
export { NoSearchResults } from "./NoSearchResults";
export { ComingSoon as ComingSoonIllustration } from "./ComingSoon";
export { UnitsAvailable as UnitsAvailableIllustration } from "./UnitsAvailable";
export { NoNotifications } from "./NoNotifications";

/**
 * Shared illustration prop shape. Per-component interfaces are structurally
 * identical so callers can swap illustrations freely.
 */
export interface IllustrationProps {
  className?: string;
  primaryColor?: string;
  secondaryColor?: string;
}
