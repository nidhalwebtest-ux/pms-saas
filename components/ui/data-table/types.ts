import type { ReactNode } from "react";
import type {
  ColumnDef,
  OnChangeFn,
  RowData,
  SortingState,
} from "@tanstack/react-table";

/* ============================================================================
 *  Column meta — typed extension of TanStack's ColumnMeta<TData, TValue>.
 *  Cells, headers, and the mobile card renderer all consume these hints.
 * ========================================================================= */

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Logical cell alignment. Default `"start"`. */
    align?: "start" | "center" | "end";
    /** Apply `tabular-nums` to the cell — for currency / counts. */
    numeric?: boolean;
    /** Pin the column to the start or end edge of the table. */
    sticky?: "start" | "end";

    /**
     * Role on the mobile card variant. Default `"detail"`.
     * - `"title"`   — large primary heading (one per card).
     * - `"status"`  — top-end pill (one per card).
     * - `"detail"`  — secondary line; rendered in column declaration order.
     * - `"hide"`    — never shown on mobile.
     */
    mobile?: "title" | "status" | "detail" | "hide";

    /**
     * When `mobile: "detail"`, lower numbers render first. Columns without an
     * explicit priority fall back to declaration order.
     */
    mobilePriority?: number;

    /**
     * Short label shown alongside the detail value on mobile (e.g.
     * `"Check-in"`). Defaults to the desktop header when omitted.
     */
    mobileLabel?: ReactNode;
  }
}

/* ============================================================================
 *  Modes — drives how sort/pagination state moves between table and consumer
 * ========================================================================= */

/**
 * - `client`: TanStack owns sort + pagination. Use for ≤ ~500 rows.
 * - `server`: caller owns sort + pagination state and refetches. Default for
 *   any list page that paginates over a real database.
 * - `virtual`: row windowing via `@tanstack/react-virtual`. Pagination is
 *   ignored — the data prop is the entire fetched window. Use for ≥ 10,000
 *   rows or autocomplete pickers.
 */
export type TableMode = "client" | "server" | "virtual";

/* ============================================================================
 *  Row variants — drives row-level tint / start-border accent
 * ========================================================================= */

/**
 * Row-level visual emphasis. Same physical accents as the badge tones:
 * - `urgent`   → red border + faint red tint (overstay, overdue invoice)
 * - `warning`  → amber border + faint amber tint (draft invoice, awaiting action)
 * - `inactive` → muted text only (cancelled, archived)
 * - `pinned`   → amber border, no tint (VIP, flagged)
 */
export type RowVariant = "default" | "urgent" | "warning" | "inactive" | "pinned";

/* ============================================================================
 *  Density
 * ========================================================================= */

export type TableDensity = "compact" | "comfortable";

/* ============================================================================
 *  Sub-configs
 * ========================================================================= */

export interface PaginationConfig {
  /** Current page index (0-based). */
  pageIndex: number;
  /** Rows per page. */
  pageSize: number;
  /**
   * Total matching rows in the dataset. Required for `server` mode (drives
   * the pager). Optional in `client` mode (TanStack derives it).
   */
  totalCount?: number;
  /** Selectable page sizes for the dropdown. Default `[10, 25, 50, 100]`. */
  pageSizes?: number[];
  /** Called with the next state. The caller is responsible for re-fetching. */
  onChange: (next: { pageIndex: number; pageSize: number }) => void;
}

export interface SortingConfig {
  state: SortingState;
  onChange: OnChangeFn<SortingState>;
  /** Allow shift-click to add secondary sort. Default `false`. */
  multiSort?: boolean;
}

export interface SelectionConfig<T> {
  /** Master switch — adds the checkbox column. */
  enabled?: boolean;
  /** Controlled selected row IDs. */
  selected?: ReadonlySet<string>;
  /** Called whenever the selection changes. */
  onSelectionChange: (next: Set<string>) => void;
  /** Persist selection across pagination boundaries. Default `true`. */
  persistAcrossPages?: boolean;
  /**
   * Optional callback that produces the "X rows selected" label in the bulk
   * action toolbar. When omitted, falls back to the default `dataTable.
   * toolbar.rowsSelected` translation (which has full Arabic plurals).
   * Use to customize the noun for a specific page, e.g.
   * `(count) => tList("expensesSelected", { count })`.
   */
  selectionLabel?: (count: number) => string;
  /**
   * "Select all matching filters" — the consumer fetches every ID. Used when
   * server-side pagination means the table only sees the current page.
   */
  onSelectAllMatching?: () => Promise<string[]>;
  /** Per-row override to disable selection (e.g. locked records). */
  isRowSelectable?: (row: T) => boolean;
}

/* ============================================================================
 *  Actions
 * ========================================================================= */

export interface BulkAction<T = unknown> {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Drives button styling — destructive flips it red. */
  variant?: "default" | "destructive";
  /**
   * Optional inline confirm. When set, the toolbar awaits a ConfirmDialog
   * confirmation before calling `onClick`. The shape matches
   * `ConfirmDialogOptions` (minus the imperative bits).
   */
  confirm?: {
    title: ReactNode;
    description?: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: "destructive" | "warning" | "info" | "default";
  };
  /** Hide the action when called with the selected rows. */
  visible?: (selectedRows: T[]) => boolean;
  /** Async action — toolbar shows a spinner while pending. */
  onClick: (selectedIds: string[]) => void | Promise<void>;
}

export interface RowAction<T = unknown> {
  id: string;
  label: string;
  icon?: ReactNode;
  variant?: "default" | "destructive";
  /** Hide vs disable for inapplicable actions. */
  visible?: boolean;
  disabled?: boolean;
  onClick: (row: T) => void | Promise<void>;
}

/* ============================================================================
 *  Empty / error states
 * ========================================================================= */

export interface EmptyStateConfig {
  title: ReactNode;
  description?: ReactNode;
  illustration?: ReactNode;
  action?: { label: string; onClick: () => void };
}

export interface TableErrorState {
  message: string;
  onRetry?: () => void;
}

/* ============================================================================
 *  Main props
 * ========================================================================= */

export interface DataTableProps<T> {
  /** Row data. Identity is taken from `getRowId(row)` — see below. */
  data: T[];

  /**
   * Column definitions. Build with the column factory helpers (Phase 5) or
   * with TanStack's `ColumnDef<T>` directly.
   */
  columns: ColumnDef<T, any>[];

  /**
   * Stable unique ID resolver. Default uses `row.id` if present. Required for
   * selection to survive sort / pagination.
   */
  getRowId?: (row: T) => string;

  /** Default `"client"`. */
  mode?: TableMode;

  pagination?: PaginationConfig;
  sorting?: SortingConfig;
  selection?: SelectionConfig<T>;

  bulkActions?: BulkAction<T>[];
  rowActions?: (row: T) => RowAction<T>[];

  emptyState?: EmptyStateConfig;
  /** Surfaced when `data.length === 0` and filters/search are active. */
  hasActiveFilters?: boolean;

  loading?: boolean;
  error?: TableErrorState;

  /** Whole-row click handler. Cells with their own buttons stop propagation. */
  onRowClick?: (row: T) => void;
  rowVariant?: (row: T) => RowVariant;

  /**
   * Per-row render override. Use to swap a row entirely (e.g. an inline-edit
   * panel for the currently-editing tenant). Return `null` to keep the default
   * row, or any `ReactNode` to replace it. The replacement must be a `<tr>`
   * whose cells span the column count so the layout aligns.
   *
   * Desktop only — the mobile card variant does not consult this hook.
   */
  renderRow?: (args: { row: T; index: number }) => ReactNode | null;

  density?: TableDensity;
  stickyHeader?: boolean;

  /** Below this width (px) the component switches to the mobile card list. Default 768. */
  mobileBreakpoint?: number;

  /**
   * Virtual mode only — max height of the scrollable region. Accepts any CSS
   * value. Default `"600px"`. The virtualizer measures the scroll container,
   * so this must be a definite height for windowing to work.
   */
  virtualMaxHeight?: number | string;

  /**
   * Virtual mode only — fixed row height in px used by the virtualizer's
   * size estimator. Default 52 (comfortable) / 40 (compact). Override only
   * when rows render at a non-default height.
   */
  virtualRowHeight?: number;

  /**
   * Virtual mode only — fires when the user has scrolled to within the
   * last `endReachedThreshold` rows. Wire it up for infinite scroll: fetch
   * the next page and append to `data`.
   */
  onEndReached?: () => void;

  /** Default 5 rows from the end. */
  endReachedThreshold?: number;

  className?: string;
  "aria-label"?: string;
}
