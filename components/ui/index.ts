export { Button } from "./Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./Button";

export { Spinner } from "./Spinner";

export { Badge } from "./Badge";
export type {
  BadgeProps,
  BadgeTone,
  BadgeAppearance,
  BadgeSize,
} from "./Badge";

export {
  getReservationStatusBadge,
  reservationStatusKeyFromDisplayLabel,
  getInvoiceStatusBadge,
  resolveInvoiceBadge,
  getUnitStatusBadge,
  getUnitTypeBadge,
  getTenantClassBadge,
  getTenantTypeBadge,
  getPaymentMethodBadge,
  getExpenseStatusBadge,
  getPropertyTypeBadge,
  getUserRoleBadge,
} from "./badge-helpers";
export type {
  BadgeVariantProps,
  ReservationStatusKey,
  InvoiceStatusKey,
  UnitStatusKey,
  UnitTypeKey,
  TenantClassKey,
  TenantTypeKey,
  PaymentMethodKey,
  ExpenseStatusKey,
  PropertyTypeKey,
  UserRoleKey,
} from "./badge-helpers";

/* ── Form fields (Tier 1) ───────────────────────────────────────────── */
export { FormField, useFieldA11y } from "./form";
export type { FormFieldProps, FieldSize, BaseFieldProps } from "./form";

export { TextField } from "./form";
export type { TextFieldProps } from "./form";

export { TextArea } from "./form";
export type { TextAreaProps } from "./form";

export { Select } from "./form";
export type { SelectProps, SelectOption } from "./form";

export { NumberField } from "./form";
export type { NumberFieldProps } from "./form";

/* ── Form fields (Tier 2) ───────────────────────────────────────────── */
export { PasswordField } from "./form";
export type { PasswordFieldProps } from "./form";

export { PhoneField } from "./form";
export type { PhoneFieldProps } from "./form";

export { Checkbox, CheckboxGroup } from "./form";
export type { CheckboxProps, CheckboxGroupProps } from "./form";

export { Radio, RadioGroup } from "./form";
export type { RadioProps, RadioGroupProps } from "./form";

/* ── Form fields (Tier 3) ───────────────────────────────────────────── */
export { Toggle } from "./form";
export type { ToggleProps } from "./form";

export { DatePicker } from "./form";
export type { DatePickerProps } from "./form";

export { DateRangePicker } from "./form";
export type { DateRangePickerProps, DateRangeValue } from "./form";

export { SearchableSelect } from "./form";
export type { SearchableSelectProps, SearchableSelectOption } from "./form";

export { MultiSelect } from "./form";
export type { MultiSelectProps, MultiSelectOption } from "./form";

export { FileUpload } from "./form";
export type { FileUploadProps } from "./form";

export { ImageUpload } from "./form";
export type { ImageUploadProps } from "./form";

/* ── Modal ───────────────────────────────────────────────────────────── */
export {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useModal,
  useModalContext,
} from "./modal";
export type {
  ModalProps,
  ModalSize,
  ModalVariant,
  ModalTone,
  ModalHeaderProps,
  ModalBodyProps,
  ModalFooterProps,
} from "./modal";

/* ── ConfirmDialog ───────────────────────────────────────────────────── */
export {
  ConfirmDialog,
  ConfirmDialogProvider,
  ConfirmDialogContext,
  useConfirmDialog,
} from "./confirm-dialog";
export type {
  ConfirmDialogProps,
  ConfirmDialogContextValue,
  ConfirmDialogOptions,
  ConfirmDialogResult,
  ConfirmDialogTone,
  ConfirmDialogReasonConfig,
  ConfirmDialogReasonOption,
  ConfirmDialogTypeToConfirmConfig,
} from "./confirm-dialog";

/* ── Skeleton ────────────────────────────────────────────────────────── */
export {
  Skeleton,
  SkeletonLine,
  SkeletonText,
  SkeletonCircle,
  SkeletonRectangle,
  SkeletonCard,
  SkeletonTableRow,
} from "./skeleton";
export type {
  SkeletonBaseProps,
  SkeletonProps,
  SkeletonShape,
  SkeletonRounded,
  SkeletonLineProps,
  SkeletonLineSize,
  SkeletonTextProps,
  SkeletonCircleProps,
  SkeletonCircleSize,
  SkeletonRectangleProps,
  SkeletonCardProps,
  SkeletonTableColumn,
  SkeletonTableCellType,
  SkeletonTableAlign,
  SkeletonTableRowProps,
} from "./skeleton";

/* ── EmptyState ──────────────────────────────────────────────────────── */
export {
  EmptyState,
  NoReservationsFirstTime,
  NoReservationsForFilters,
  NoTenantsFirstTime,
  NoTenantsForSearch,
  NoBuildingsFirstTime,
  NoUnitsForBuilding,
  NoInvoicesFirstTime,
  NoInvoicesForFilters,
  NoPaymentsFirstTime,
  NoExpensesPending,
  NoExpensesForFilters,
  NoActivityYet,
  NoSearchResults,
  ComingSoon,
  UnitsAvailable,
} from "./empty-state";
export type {
  EmptyStateProps,
  EmptyStateAction,
  EmptyStateVariant,
  EmptyStateSize,
} from "./empty-state";

/* ── Alert ───────────────────────────────────────────────────────────── */
export {
  Alert,
  FormErrorSummary,
  TrialExpiryBanner,
  MaintenanceBanner,
  FeatureAnnouncement,
  PendingApprovalsBanner,
  PaymentRecorded,
  NetworkErrorRetry,
  TenantBlacklistedWarning,
} from "./alert";
export type {
  AlertProps,
  AlertVariant,
  AlertSize,
  AlertAppearance,
  FormErrorSummaryProps,
  FormErrorSummaryItem,
  TrialExpiryBannerProps,
  MaintenanceBannerProps,
  FeatureAnnouncementProps,
  PendingApprovalsBannerProps,
  PaymentRecordedProps,
  NetworkErrorRetryProps,
  TenantBlacklistedWarningProps,
} from "./alert";

/* ── DataTable ───────────────────────────────────────────────────────── */
export {
  DataTable,
  useDataTable,
  defineColumns,
  TextCell,
  NumberCell,
  CurrencyCell,
  DateCell,
  StatusCell,
  UserCell,
  ActionsCell,
} from "./data-table";
export type {
  DataTableProps,
  TableMode,
  TableDensity,
  RowVariant,
  PaginationConfig,
  SortingConfig,
  SelectionConfig,
  BulkAction,
  RowAction,
  TableErrorState,
  TextCellProps,
  NumberCellProps,
  CurrencyCellProps,
  DateCellProps,
  StatusCellProps,
  UserCellProps,
  ActionsCellProps,
} from "./data-table";
