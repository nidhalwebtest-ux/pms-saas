# DataTable — Design System

The list-page primitive. Every list across the app (Reservations, Tenants,
Invoices, Payments, Expenses, Units, Buildings) renders through one
`<DataTable>`. Headless engine: **TanStack Table v8** (`@tanstack/react-table`)
plus **`@tanstack/react-virtual`** for the virtual mode. Call-sites never
import either directly — only from `@/components/ui`.

Migration audit: [docs/migrations/data-table-audit.md](../migrations/data-table-audit.md).

---

## Quick reference

| Export | Purpose |
| --- | --- |
| `DataTable` | The main component. Handles desktop table, mobile cards, virtual scrolling. |
| `defineColumns<T>()` | Per-page column factory. Returns helpers for `text`, `number`, `currency`, `date`, `status`, `user`, plus a `custom` escape hatch. |
| `useDataTable` | Low-level hook returning the TanStack table instance. Only used internally; reach for it only if you need direct table-state access. |
| Cell renderers | `TextCell`, `NumberCell`, `CurrencyCell`, `DateCell`, `StatusCell`, `UserCell`, `ActionsCell` — used inside `custom()` column defs when the factory shortcut is not enough. |
| Types | `DataTableProps`, `PaginationConfig`, `SortingConfig`, `SelectionConfig`, `BulkAction`, `RowAction`, `EmptyStateConfig`, `TableErrorState`, `RowVariant`, `TableMode`, `TableDensity` |

All exported from `@/components/ui`:

```tsx
import { DataTable, defineColumns, useConfirmDialog } from "@/components/ui";
```

---

## When to use what

| Need | Choice |
| --- | --- |
| Any list page in the app | `<DataTable>` |
| Settings → Team rows (tap-card style, < 20 entries) | Plain `<ul>` is fine — DataTable is overkill |
| Embedded summary table inside a detail page | Plain `<table>` is fine |
| Card grid view (e.g. Tenants card view) | Page renders cards itself; DataTable only owns the table view |
| Calendar layout | `<AvailabilityCalendar>` (separate primitive, not DataTable) |

DataTable is for **list views with sortable / filterable / paginated row data**.
For everything else, simpler primitives are better.

---

## Choosing a render mode

`mode` is the most important decision. It is set once per page.

| Mode | Row count | Sort + filter happen | Pager | Use for |
| --- | --- | --- | --- | --- |
| `"client"` (default) | up to ~500 | in-browser (TanStack) | numeric pages | Buildings, smaller admin views |
| `"server"` | 500 → 10,000+ | server-side (you POST params) | numeric pages, server-driven | Reservations, Tenants, Invoices, Payments, Expenses |
| `"virtual"` | 10,000+ / autocomplete | server, no pagination | none — windowed scroll | Historical archives, large pickers |

The column definitions stay identical across modes. Switching is just `mode`
plus the appropriate state handlers.

### Client mode

TanStack owns sort + pagination. Caller passes the entire dataset; the table
slices and sorts in memory.

```tsx
<DataTable
  data={buildings}
  columns={buildingColumns}
  mode="client"                        // default — can omit
  pagination={{ pageIndex, pageSize, onChange }}
  sorting={{ state: sort, onChange: setSort }}
/>
```

### Server mode

Caller owns sort + pagination state and re-fetches on change. The table
trusts whatever rows come in.

```tsx
<DataTable
  data={pageRows}
  columns={reservationColumns}
  mode="server"
  pagination={{ pageIndex, pageSize, totalCount, onChange }}
  sorting={{ state: sort, onChange: setSort }}
  loading={isFetching}
/>
```

`totalCount` is **required** in server mode — it drives the pager. Without it
the pager renders only the current page button and the user has no way to
navigate.

### Virtual mode

Renders only the visible rows + a small buffer via `@tanstack/react-virtual`.
No pagination — the `data` prop is the entire fetched window.

```tsx
<DataTable
  data={allRows}                       // 10,000+ rows
  columns={columns}
  mode="virtual"
  virtualMaxHeight={500}               // definite scroll viewport (required)
  virtualRowHeight={52}                // optional override
  onEndReached={() => loadMore()}      // infinite scroll
  endReachedThreshold={5}              // fires when within 5 rows of the end
/>
```

The virtual body uses spacer rows (one before, one after) to preserve
`<table>` semantics — no abs-positioned rows, no div-as-table.

---

## Column definitions

Always use the per-page factory:

```tsx
import { defineColumns } from "@/components/ui";

const c = defineColumns<Reservation>();

export const reservationColumns = [
  c.text({
    id: "code",
    header: "Res #",
    accessor: (r) => r.reservationNumber,
    mono: true,
    mobile: "title",                                       // → card heading
  }),
  c.status({
    id: "status",
    header: "Status",
    accessor: (r) => tStatus(r.statusKey),
    variant: (r) => getReservationStatusBadge(r.displayStatus),
    // mobile: "status" is the default for status columns
  }),
  c.user({
    id: "tenant",
    header: "Tenant",
    accessor: (r) => ({
      name: `${r.tenant.firstName} ${r.tenant.lastName}`,
      subtitle: r.tenant.phone,
      leading: r.tenant.classification === "VIP" ? "⭐" : undefined,
    }),
  }),
  c.date({
    id: "checkIn",
    header: "Check-in",
    accessor: (r) => r.startDate,
    tone: (r) => isOverdue(r) ? "urgent" : "default",      // per-row tone
    mobileLabel: "From",
  }),
  c.currency({
    id: "total",
    header: "Total",
    accessor: (r) => r.grandTotal,
  }),
  c.currency({
    id: "balance",
    header: "Balance",
    accessor: (r) => r.balanceDue,
    tone: "negative",
    emptyOnZero: true,                                    // render 0 as em-dash
  }),
];
```

### Shared options on every helper

`id`, `header`, `accessor` (required); plus `sortable` (default `true`),
`width` (px), `align` (`start | center | end`), `sticky` (`start | end`),
`mobile` (`title | status | detail | hide`), `mobilePriority` (number),
`mobileLabel` (ReactNode).

### Helper-specific options

| Helper | Extras |
| --- | --- |
| `c.text` | `mono`, `muted`, `subtitle(row)` |
| `c.number` | `decimals`, `suffix`, `tone`, `emptyOnZero` |
| `c.currency` | `currency` (ISO code), `showCode`, `tone`, `emptyOnZero`, `decimals` |
| `c.date` | `format` (date-fns string), `fallback`, `tone` (static or `(row) => tone`), `mono` |
| `c.status` | `variant: (row) => BadgeVariantProps` — wire through `getReservationStatusBadge` / `resolveInvoiceBadge` / etc. from [components/ui/badge-helpers](../../components/ui/badge-helpers.tsx) |
| `c.user` | `avatarSize` (px). Accessor returns `{ name, subtitle?, avatarUrl?, avatarClass?, leading? }` |
| `c.custom(def)` | escape hatch — pass any TanStack `ColumnDef<T>` |

### Where columns live

Convention: `app/dashboard/<resource>/columns.tsx` (or `columns.ts` if no JSX
is needed). Export the column array — never construct it inline in a render.
Stable identity matters for memo discipline.

---

## Selection + bulk actions

```tsx
const [selected, setSelected] = useState<Set<string>>(new Set());

<DataTable
  data={expenses}
  columns={expenseColumns}
  selection={{
    enabled: true,
    selected,
    onSelectionChange: setSelected,
    entityLabel: "expense",                              // for "5 expenses selected"
    onSelectAllMatching: async () => fetchAllMatchingIds(),
  }}
  bulkActions={[
    {
      id: "approve",
      label: "Approve",
      icon: <CheckIcon className="h-4 w-4" />,
      onClick: (ids) => bulkApprove(ids),
    },
    {
      id: "reject",
      label: "Reject",
      variant: "destructive",
      confirm: {
        title: "Reject selected expenses?",
        description: "This cannot be undone.",
        tone: "destructive",
      },
      onClick: (ids) => bulkReject(ids),
    },
  ]}
/>
```

- The selection checkbox column is auto-injected at the start when
  `selection.enabled`. The actions column is auto-injected at the end when
  `rowActions` is passed.
- The bulk-action toolbar appears above the table only while
  `selected.size > 0`. Destructive actions optionally route through
  [`ConfirmDialog`](./confirm-dialog.md) via the inline `confirm` config.
- Async `onClick` handlers drive the per-button loading state; other actions
  disable while one is running.
- Selection survives sort + pagination as long as `getRowId` returns a stable
  ID. The default falls back to `row.id`; pass `getRowId={(row) => row.code}`
  if your records use a different identifier.

---

## Row actions

```tsx
<DataTable
  data={rows}
  columns={cols}
  rowActions={(row) => [
    {
      id: "view",
      label: "View",
      icon: <EyeIcon className="h-4 w-4" />,
      onClick: () => router.push(`/reservations/${row.id}`),
    },
    {
      id: "check-in",
      label: "Check in",
      icon: <ArrowRightOnRectangleIcon className="h-4 w-4" />,
      onClick: () => openCheckIn(row),
      visible: row.displayStatus === "Arriving Today" || row.displayStatus === "Overdue Arrival",
    },
    {
      id: "cancel",
      label: "Cancel",
      icon: <XMarkIcon className="h-4 w-4" />,
      variant: "destructive",
      onClick: () => cancelReservation(row),
    },
  ]}
  onRowClick={(row) => router.push(`/reservations/${row.id}`)}
/>
```

- Hidden actions (`visible: false`) vanish entirely. Disabled ones render dimmed.
- Async handlers swap the icon for a spinner while pending.
- Each button stops click propagation so the row-click handler does not
  also fire when the user clicks an action.
- On mobile, the same `rowActions` callback feeds a `⋯` overflow menu per card.

---

## Row variants

```tsx
<DataTable
  data={reservations}
  columns={columns}
  rowVariant={(r) =>
    r.displayStatus === "Overstay"     ? "urgent"   :
    r.displayStatus === "Cancelled"    ? "inactive" :
    r.tenant.classification === "VIP"  ? "pinned"   : "default"
  }
/>
```

| Variant | Visual | Use for |
| --- | --- | --- |
| `default` | nothing extra | most rows |
| `urgent` | 3 px error-500 start border + faint error-50 tint | overstays, overdue invoices |
| `inactive` | dim text via reduced opacity | cancelled / archived rows |
| `pinned` | 3 px warning-500 start border | VIP, flagged |

Inset borders use `box-shadow` so the row stays a single `<tr>` (no extra
spacer cells). RTL flips them via the `rtl:` variant.

---

## Empty / loading / error states

```tsx
<DataTable
  data={rows}
  columns={cols}
  loading={isFetching}                                       // initial load → skeleton
  error={
    requestError
      ? { message: requestError.message, onRetry: refetch }
      : undefined
  }
  hasActiveFilters={!!search || statusFilter !== "ALL"}      // switches empty copy
  emptyState={{
    title: "No reservations yet",
    description: "Create your first reservation to start tracking arrivals.",
    action: { label: "+ New reservation", onClick: () => router.push("/reservations/new") },
  }}
/>
```

State precedence (highest first): **error → initial-loading-skeleton → data → empty**.

- **Initial load** (`loading && data.length === 0`): 8 skeleton rows.
- **In-place refetch** (`loading && data.length > 0`): keeps the rows visible,
  fades them to 60%, and overlays a thin pulsing top progress bar. **Never**
  show skeleton rows for a sort change or filter change — it flashes.
- **Error**: replaces the body with a centered icon + message + optional Retry.
  Header, toolbar, and pagination stay interactive so the user can adjust
  filters.
- **Empty**:
  - With `hasActiveFilters: true` → "No matches" + optional clear-filters action.
  - Without → caller's `emptyState` config, or a default "No data yet".

---

## Mobile

Below `mobileBreakpoint` (default 768 px), the same `<DataTable>` swaps from a
table to a stack of cards. The TanStack table instance is shared between
desktop and mobile, so sort / selection / pagination state stay in sync across
resize.

Card layout per row:

```
┌─────────────────────────────────────────┐
│  [primary heading]            [status]  │   ← mobile: "title"  + mobile: "status"
│  Detail label   Value                    │   ← mobile: "detail" lines in mobilePriority order
│  Detail label   Value                    │
└─────────────────────────────────────────┘
```

Hints come from column meta. Most columns are `mobile: "detail"` by default;
status columns default to `mobile: "status"`. Set `mobile: "title"` explicitly
on the page's primary-key column (Res #, Invoice #, tenant name). Set
`mobile: "hide"` to drop columns that don't read well on a small screen.

- **Selection** appears as a corner checkbox.
- **Row actions** collapse into a `⋯` menu (Headless UI Menu).
- **Sort** gets a compact column + asc/desc dropdown above the card list.

---

## Filter integration

DataTable **does not own filter UI**. The audit confirmed that tab-based
status filters (Reservations, Invoices, Payments, Expenses) live on the page,
above the table. Build them with whatever the page needs, then pass the
filtered data + `hasActiveFilters={true}` so the empty state reads "No
matches" instead of "No data yet".

A shared `FilterBar` primitive is a separate, later component. Until then:

```tsx
<StatusTabs active={status} onChange={setStatus} counts={statusCounts} />
<SearchInput value={search} onChange={setSearch} />
<DataTable
  data={filteredRows}
  hasActiveFilters={!!search || status !== "ALL"}
  // …
/>
```

---

## Performance

Targets (from the spec, validated against TanStack v8 defaults):

| Scenario | Target |
| --- | --- |
| First paint, server mode, 25 rows | ≤ 80 ms |
| Sort change, client mode, 500 rows | ≤ 120 ms |
| Page change, server, while old data | ≤ 16 ms re-render |
| Virtual scroll, 50k rows | 60 fps with 52 px rows |
| Selection toggle on a single row | ≤ 16 ms |

Things to watch:

- **Always memoize / module-scope the column array.** A fresh `columns` ref
  per render forces TanStack to re-compute everything. Define columns in a
  separate file and import the array.
- **Always provide stable IDs.** Either `getRowId={(r) => r.id}` or rely on
  the default `row.id` lookup. Without stable IDs, selection silently breaks
  under sort or pagination — the component logs a dev warning.
- **For virtual mode, keep row height fixed.** Variable heights force the
  virtualizer to measure each row and tank performance.
- **For server mode, debounce search at the page level**, not inside DataTable.

---

## Accessibility

- Semantic `<table>` / `<thead>` / `<tbody>` / `<tr>` / `<th scope="col">`. No div-tables — even on mobile, the cards are real `<li>` elements.
- Sort headers are `<button>`s inside `<th>` with `aria-sort="ascending" | "descending" | "none"`.
- Selection checkboxes are native `<input type="checkbox">`. The header one drives indeterminate state via a ref.
- Row click area: the entire row is clickable when `onRowClick` is set, but the **primary semantic target** should remain the `View` action in the row (so right-click "Open in new tab" works).
- Pagination buttons carry per-button `aria-label`; the active page gets `aria-current="page"`.
- Virtual mode sets `aria-rowcount` on the `<table>` element since the DOM only contains the visible window.
- In RTL, logical properties (`ps-*`, `pe-*`, `start-*`, `end-*`) flip the layout; numbers stay LTR via nested `dir="ltr"` wrappers on numeric cells.

---

## Things to avoid

- **No filter inputs inside DataTable.** Build them above the table at the page level. DataTable just renders what it is given.
- **No `columns` defined inline inside the render function.** Use a module-scope const or `useMemo`.
- **No DataTable in server components.** The hook tree (state, refs, viewport) is client-only. Pass data into a `"use client"` boundary that mounts the table.
- **No skeleton rows on refetch.** They flash. The refetch progress bar + dimmed body is the correct in-place loading state.
- **No `mode="server"` without `totalCount`.** The pager cannot render correctly without it.
- **No row click that opens a modal AND navigates** — pick one. The user cannot predict which one will fire.

---

## Migration from existing hand-rolled tables

Recommended order, per the audit:

1. **Invoices** — already paginated server-side; smallest delta from the existing implementation.
2. **Reservations** — high complexity but high reward; defines the per-row tinting + rowActions story.
3. **Tenants** — keeps its inline-edit / card / summary view modes at the page level; DataTable replaces only the table view.
4. **Expenses** — first bulk-actions consumer (bulk approve / reject).
5. **Payments** — simple, mostly read-only.
6. **Units** — same as Tenants, keep inline edit at the page level.
7. **Buildings / Properties** — smallest volume; sanity-check the migration.

For each migration:

- Move column defs to `app/dashboard/<resource>/columns.tsx` using `defineColumns<T>()`.
- Replace the hand-rolled `<table>` with `<DataTable>`.
- Move sort state, pagination state, and filter state to a per-resource `useReservationsTable()`-style hook (or to the page component for smaller pages).
- Delete the old inline status-tab handler if it duplicated row counts that the server can return.
- Keep modals at the page level — `rowActions` triggers them.
- Land each page migration behind a feature flag (`feature.newReservationsTable = true`) so a regression can be dialed back without reverting the commit.

---

## Wiring (already done, for reference)

```
components/ui/data-table/
├── DataTable.tsx                ← main composition
├── types.ts                     ← DataTableProps + meta extension
├── index.ts                     ← barrel
├── columns/
│   └── defineColumns.tsx        ← per-page factory
├── cells/
│   ├── TextCell.tsx
│   ├── NumberCell.tsx
│   ├── CurrencyCell.tsx
│   ├── DateCell.tsx
│   ├── StatusCell.tsx
│   ├── UserCell.tsx
│   └── ActionsCell.tsx
├── parts/
│   ├── DataTableHeader.tsx
│   ├── DataTableRow.tsx
│   ├── DataTablePagination.tsx
│   ├── DataTableToolbar.tsx
│   ├── DataTableEmpty.tsx
│   ├── DataTableLoading.tsx
│   ├── DataTableError.tsx
│   ├── DataTableMobile.tsx
│   └── DataTableVirtualBody.tsx
└── hooks/
    ├── useDataTable.ts
    └── useIsMobile.ts
```

Every consumer imports from `@/components/ui` — never from the TanStack
packages directly. The TanStack imports are an implementation detail and
should stay confined to `components/ui/data-table/`.
