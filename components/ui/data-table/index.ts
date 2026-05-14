export { DataTable } from "./DataTable";

export { useDataTable } from "./hooks/useDataTable";

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
  EmptyStateConfig,
  TableErrorState,
} from "./types";

/* ── Cells ───────────────────────────────────────────────────────────── */

export { TextCell } from "./cells/TextCell";
export type { TextCellProps } from "./cells/TextCell";

export { NumberCell } from "./cells/NumberCell";
export type { NumberCellProps } from "./cells/NumberCell";

export { CurrencyCell } from "./cells/CurrencyCell";
export type { CurrencyCellProps } from "./cells/CurrencyCell";

export { DateCell } from "./cells/DateCell";
export type { DateCellProps } from "./cells/DateCell";

export { StatusCell } from "./cells/StatusCell";
export type { StatusCellProps } from "./cells/StatusCell";

export { UserCell } from "./cells/UserCell";
export type { UserCellProps } from "./cells/UserCell";

export { ActionsCell } from "./cells/ActionsCell";
export type { ActionsCellProps } from "./cells/ActionsCell";
