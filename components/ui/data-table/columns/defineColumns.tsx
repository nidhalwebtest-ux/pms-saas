"use client";

import type { ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { BadgeVariantProps } from "../../badge-helpers";
import { TextCell } from "../cells/TextCell";
import { NumberCell } from "../cells/NumberCell";
import { CurrencyCell } from "../cells/CurrencyCell";
import { DateCell } from "../cells/DateCell";
import { StatusCell } from "../cells/StatusCell";
import { UserCell } from "../cells/UserCell";

/* ============================================================================
 *  Shared base options — every helper carries these.
 * ========================================================================= */

interface BaseOpts<T, V> {
  id: string;
  header: ReactNode;
  accessor: (row: T) => V;
  /** Default `true` — most columns are sortable. Pass `false` for action / icon columns. */
  sortable?: boolean;
  /** Fixed pixel or CSS width. Passed through to TanStack `size`. */
  width?: number;
  /** Logical alignment. Default depends on the column type (numeric → end, text → start). */
  align?: "start" | "center" | "end";
  /** Pin to a logical edge. */
  sticky?: "start" | "end";
  /** Mobile role. Default `"detail"`. Set `"title"` on the page key column. */
  mobile?: "title" | "status" | "detail" | "hide";
  /** Sort key among detail rows on mobile. Lower renders first. */
  mobilePriority?: number;
  /** Label rendered for the dt term on mobile. Defaults to `header`. */
  mobileLabel?: ReactNode;
}

function mergeMeta<T, V>(
  base: BaseOpts<T, V>,
  extras: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    align: base.align,
    sticky: base.sticky,
    mobile: base.mobile,
    mobilePriority: base.mobilePriority,
    mobileLabel: base.mobileLabel,
    ...extras,
  };
}

type CommonProps<T, V> = {
  id: string;
  header: ColumnDef<T, V>["header"];
  accessorFn: (row: T) => V;
  enableSorting?: boolean;
  size?: number;
};

function commonProps<T, V>(opts: BaseOpts<T, V>): CommonProps<T, V> {
  return {
    id: opts.id,
    header: opts.header as ColumnDef<T, V>["header"],
    accessorFn: opts.accessor,
    ...(opts.sortable === false ? { enableSorting: false } : {}),
    ...(opts.width !== undefined ? { size: opts.width } : {}),
  };
}

/* ============================================================================
 *  text
 * ========================================================================= */

interface TextOpts<T> extends BaseOpts<T, string | null | undefined> {
  /** Render with the project mono font. */
  mono?: boolean;
  /** Mute the text. */
  muted?: boolean;
  /** Optional secondary line under the value (e.g. phone under tenant name). */
  subtitle?: (row: T) => ReactNode;
}

function text<T>(opts: TextOpts<T>): ColumnDef<T, string | null | undefined> {
  return {
    ...commonProps(opts),
    cell: ({ row, getValue }) => (
      <TextCell
        mono={opts.mono}
        muted={opts.muted}
        subtitle={opts.subtitle ? opts.subtitle(row.original) : undefined}
      >
        {(getValue() ?? "—") as ReactNode}
      </TextCell>
    ),
    meta: mergeMeta(opts),
  };
}

/* ============================================================================
 *  number
 * ========================================================================= */

interface NumberOpts<T>
  extends BaseOpts<T, number | string | null | undefined> {
  decimals?: number;
  suffix?: string;
  tone?: "default" | "positive" | "negative" | "muted";
  emptyOnZero?: boolean;
}

function number<T>(
  opts: NumberOpts<T>,
): ColumnDef<T, number | string | null | undefined> {
  return {
    ...commonProps(opts),
    cell: ({ getValue }) => (
      <NumberCell
        value={getValue() as number | string | null | undefined}
        decimals={opts.decimals}
        suffix={opts.suffix}
        tone={opts.tone}
        emptyOnZero={opts.emptyOnZero}
      />
    ),
    meta: mergeMeta(opts, {
      align: opts.align ?? "end",
      numeric: true,
    }),
  };
}

/* ============================================================================
 *  currency
 * ========================================================================= */

interface CurrencyOpts<T>
  extends BaseOpts<T, number | string | null | undefined> {
  /** ISO currency code. Default `"OMR"`. */
  currency?: string;
  showCode?: boolean;
  tone?: "default" | "positive" | "negative" | "muted";
  emptyOnZero?: boolean;
  decimals?: number;
}

function currency<T>(
  opts: CurrencyOpts<T>,
): ColumnDef<T, number | string | null | undefined> {
  return {
    ...commonProps(opts),
    cell: ({ getValue }) => (
      <CurrencyCell
        value={getValue() as number | string | null | undefined}
        currency={opts.currency}
        showCode={opts.showCode}
        tone={opts.tone}
        emptyOnZero={opts.emptyOnZero}
        decimals={opts.decimals}
      />
    ),
    meta: mergeMeta(opts, {
      align: opts.align ?? "end",
      numeric: true,
    }),
  };
}

/* ============================================================================
 *  date
 * ========================================================================= */

interface DateOpts<T> extends BaseOpts<T, Date | string | null | undefined> {
  /** date-fns format string. Default `"dd MMM yyyy"`. */
  format?: string;
  fallback?: string;
  /** Static tone, or a tone resolver based on the row (e.g. urgent if overdue). */
  tone?:
    | "default"
    | "muted"
    | "urgent"
    | "today"
    | ((row: T) => "default" | "muted" | "urgent" | "today");
  mono?: boolean;
}

function date<T>(
  opts: DateOpts<T>,
): ColumnDef<T, Date | string | null | undefined> {
  return {
    ...commonProps(opts),
    // For date sorting to behave with mixed string / Date inputs, normalize.
    sortingFn: (a, b, columnId) => {
      const av = a.getValue(columnId) as Date | string | null | undefined;
      const bv = b.getValue(columnId) as Date | string | null | undefined;
      const at = av ? new Date(av).getTime() : 0;
      const bt = bv ? new Date(bv).getTime() : 0;
      return at - bt;
    },
    cell: ({ row, getValue }) => {
      const resolved =
        typeof opts.tone === "function" ? opts.tone(row.original) : opts.tone;
      return (
        <DateCell
          value={getValue() as Date | string | null | undefined}
          format={opts.format}
          fallback={opts.fallback}
          tone={resolved}
          mono={opts.mono}
        />
      );
    },
    meta: mergeMeta(opts),
  };
}

/* ============================================================================
 *  status — Badge cell driven by a per-row variant resolver
 * ========================================================================= */

interface StatusOpts<T> extends BaseOpts<T, ReactNode> {
  /** Resolves the badge variant props (tone + appearance + dot…) per row. */
  variant: (row: T) => BadgeVariantProps | undefined;
}

function status<T>(opts: StatusOpts<T>): ColumnDef<T, ReactNode> {
  return {
    ...commonProps(opts),
    cell: ({ row, getValue }) => (
      <StatusCell variant={opts.variant(row.original)}>
        {(getValue() ?? "—") as ReactNode}
      </StatusCell>
    ),
    meta: mergeMeta(opts, {
      mobile: opts.mobile ?? "status",
    }),
  };
}

/* ============================================================================
 *  user — avatar + name + subtitle
 * ========================================================================= */

interface UserAccessor {
  name: string;
  subtitle?: ReactNode;
  avatarUrl?: string;
  avatarClass?: string;
  leading?: ReactNode;
}

interface UserOpts<T> extends BaseOpts<T, UserAccessor> {
  /** Disc size in px. Default 28. */
  avatarSize?: number;
}

function user<T>(opts: UserOpts<T>): ColumnDef<T, UserAccessor> {
  return {
    ...commonProps(opts),
    // Sort users alphabetically by name when sortable.
    sortingFn: (a, b, columnId) => {
      const av = (a.getValue(columnId) as UserAccessor)?.name ?? "";
      const bv = (b.getValue(columnId) as UserAccessor)?.name ?? "";
      return av.localeCompare(bv);
    },
    cell: ({ getValue }) => {
      const v = getValue() as UserAccessor;
      return (
        <UserCell
          name={v.name}
          subtitle={v.subtitle}
          avatarUrl={v.avatarUrl}
          avatarClass={v.avatarClass}
          size={opts.avatarSize}
          leading={v.leading}
        />
      );
    },
    meta: mergeMeta(opts),
  };
}

/* ============================================================================
 *  custom — escape hatch
 * ========================================================================= */

function custom<T, V = unknown>(def: ColumnDef<T, V>): ColumnDef<T, V> {
  return def;
}

/* ============================================================================
 *  Factory
 * ========================================================================= */

/**
 * Typed column factory. Call once per page to get inference + consistency
 * across every column on that page.
 *
 *   const c = defineColumns<Reservation>();
 *   export const reservationColumns = [
 *     c.text({     id: "code",   header: "Res #",  accessor: (r) => r.code, mono: true, mobile: "title" }),
 *     c.status({   id: "status", header: "Status", accessor: (r) => r.statusLabel, variant: (r) => getReservationStatusBadge(r.displayStatus) }),
 *     c.currency({ id: "total",  header: "Total",  accessor: (r) => r.totalOmr }),
 *   ];
 *
 * Note: the selection column and the row-actions column are auto-injected by
 * <DataTable> when `selection.enabled` or `rowActions` are passed. Do not add
 * them via the factory.
 */
export function defineColumns<T>() {
  return {
    text: text<T>,
    number: number<T>,
    currency: currency<T>,
    date: date<T>,
    status: status<T>,
    user: user<T>,
    custom: custom<T>,
  };
}
