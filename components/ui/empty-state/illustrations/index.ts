/**
 * Inline React wrappers for the SVGs in `public/illustrations/`. Source
 * content is identical; the wrappers exist so the EmptyState variant tile
 * can pass `currentColor` through and so the bundle picks them up via the
 * normal JS module graph (importing from `public/` is not supported).
 */

export { BuildingIllustration } from "./Building";
export { CalendarIllustration } from "./Calendar";
export { CheckmarkIllustration } from "./Checkmark";
export { ClockIllustration } from "./Clock";
export { KeySuccessIllustration } from "./KeySuccess";
export { MailSuccessIllustration } from "./MailSuccess";
export { PersonIllustration } from "./Person";
export { ReceiptIllustration } from "./Receipt";
export { SearchIllustration } from "./Search";
export { SparklesIllustration } from "./Sparkles";
