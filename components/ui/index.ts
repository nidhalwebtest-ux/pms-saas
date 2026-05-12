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
