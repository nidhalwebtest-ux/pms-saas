# FilterBar — Design System

The bar that lives between the page header and the DataTable on every list
route. Search, quick-filter tabs with counts, dropdown filters, action
buttons, active-filter chips, and a mobile drawer — one controlled component,
debounced search, URL-syncable via a companion hook.

Migration audit: [docs/migrations/filter-bar-audit.md](../migrations/filter-bar-audit.md).

---

## Quick reference

| Export | Purpose |
| --- | --- |
| `FilterBar` | The composed component you put above DataTable. |
| `useFilterParams` | URL sync hook. Lives at `@/hooks/useFilterParams`. |
| `FilterBarSearch`, `FilterBarQuickFilters`, `FilterBarAdvanced`, `FilterBarActions`, `FilterBarActiveFilters`, `FilterBarMobileDrawer` | Sub-components — usually only `FilterBar` itself is imported. |
| `buildActiveChips` | Derives the chip list from a `FilterDef[]`. Re-exported for advanced layouts. |
| Types | `FilterBarProps`, `FilterDef` (discriminated union), `QuickFilter`, `SearchProp`, `FilterBarAction`, `DatePreset`, `Option as FilterOption` |

Standard import:

```tsx
import { FilterBar } from "@/components/ui";
import { useFilterParams } from "@/hooks/useFilterParams";
```

---

## When to use FilterBar vs alternatives

| Need | Use |
| --- | --- |
| The filters above a list page | **FilterBar** |
| The toolbar on a detail page (e.g. add tab + actions, no facets) | Plain `<div>` with `<Button>`s — FilterBar is overkill |
| In-row column filters inside the table | DataTable's column filter props, not FilterBar |
| Date / amount picker inside a form | The form `<DateRangePicker>` / `<NumberField>`, not FilterBar |

Rule of thumb: **one** FilterBar per page, above the DataTable. If a page
needs two filter zones, it's two pages.

---

## Anatomy

Four optional rows. Only the search row is universal.

```
┌─ FilterBar ─────────────────────────────────────────────────────┐
│ [1] [🔍 Search input…]                          [Refresh] [+ New] │
│ [2] [All 127] [Arriving 3] [In House 24] [Overstay •1] [...]     │
│ [3] [Building ▼] [Date ▼] [Rate type ▼]                          │
│ [4] [Building: Al Noor ×] [Date: 10–20 May ×]    Clear all (2)   │
└─────────────────────────────────────────────────────────────────┘
```

| # | Row | Renders when |
| --- | --- | --- |
| 1 | Search + actions | `search` or `actions` or `view` is set |
| 2 | Quick-filter tabs | `quickFilters` is non-empty AND `activeQuickFilter` + `onQuickFilterChange` are set |
| 3 | Advanced filters (desktop only) | `filters` is non-empty AND viewport ≥ `collapseBelowPx` |
| 4 | Active-filter chips | At least one advanced filter is active AND `activeFiltersDisplay !== "hidden"` |

Below `collapseBelowPx` (default 1024), row 3 collapses behind a "Filters · N"
trigger that opens the bottom-sheet drawer. Row 2 stays visible; the drawer
also includes a condensed tab list so the user can re-pick the active tab
without dismissing the drawer.

---

## Quick-filter tabs

WAI-ARIA tabs pattern. Arrow keys cycle, Home/End jump.

### Styles

| `quickFilterStyle` | Visual | Use for |
| --- | --- | --- |
| `"underline"` (default) | Border-bottom underline on active. | Status / state facets. |
| `"pill"` | Rounded-full pill, brand-fill on active. | ≤4 facets where pills sit in a panel rather than a full bar (Tenants). |

### Count variants

Set per tab via `variant`. Active state always overrides (the selected tab's
badge picks up the brand-tinted treatment).

| Variant | Use for |
| --- | --- |
| `default` (omit `variant`) | Neutral facets — In house, Upcoming, Cancelled. |
| `destructive` | Overstays, blacklists, failed payments. Pair with `dotOnPositive: true` for urgent attention. |
| `warning` | Time-sensitive but not blocking — Due checkout, Pending approval, Draft. |
| `success` | Positive completion — Paid, Approved, Processed. |

For counts above an arbitrary ceiling (default 500), pass `count: "high"` and
the badge renders as `500+`. Override the ceiling on `<FilterBarQuickFilters
highCountCeiling={…} />` if you use the sub-component directly.

---

## Filter types

`filters` accepts a discriminated union — `FilterDef` — with eight `type`
variants. Each renders as a `label : value ▾` trigger; the popover content
differs by type.

| Type | Popover | Trigger value display |
| --- | --- | --- |
| `select` | Radio-style option list | Selected option label |
| `multiSelect` | Checkbox list + Clear/Apply footer | First label + `+N` count when >1 |
| `dateRange` | Single-month calendar + preset rail | Localised short range (`10 May – 20 May`) |
| `dateSingle` | Single-day calendar | Localised short date |
| `numberRange` | Two number inputs | `min – max {unit}` |
| `text` | Single text input | Echoed value, truncated to 12 chars |
| `boolean` | Three-way radio (Any / On / Off) | `Yes` / `No` / `Any` |
| `custom` | Whatever the consumer renders | Caller-provided `displayValue` |

### Date-range presets

```ts
type DatePreset =
  | "today" | "yesterday"
  | "this-week" | "this-month"
  | "last-30" | "last-90"
  | "khareef-season"  // 15 Jun – 15 Sep, Binaya-specific
  | "ytd" | "custom";
```

Pass `presets: "all"` to render every preset, or `presets: ["this-month",
"khareef-season"]` to scope down. Omit to hide the preset rail entirely.

### Active state

A filter is "active" when its value differs from its default — `"all"`
sentinel for selects, empty array for multi-selects, `[null, null]` for
ranges. The trigger adopts the brand-tinted treatment automatically.

---

## Active-filter display

Set via `activeFiltersDisplay`.

| Mode | Renders | Use for |
| --- | --- | --- |
| `"chips"` (default) | One dismissible chip per active filter, prefixed with the filter label. | Pages with ≤5 advanced filters. |
| `"summary"` | `4 filters applied — Clear all` one-liner. | Expenses-style pages with many advanced filters where chips would dominate. |
| `"hidden"` | Nothing. | Invoices-style pages with ≤2 advanced filters where the brand-tinted trigger is signal enough. |

**The chip row never represents quick-tab selection.** Tabs are their own
state; the chip row is exclusively for advanced filters.

---

## Responsive layout

Three breakpoints, controlled by `collapseBelowPx` (default 1024).

| Viewport | What's visible |
| --- | --- |
| `≥ 1024` | All four rows. Quick-tabs scroll horizontally on overflow. |
| `< 1024` | Row 1 + Row 2 + Row 4. Row 3 collapses behind a "Filters · N" trigger that opens the mobile drawer. |

Drawer behaviour: bottom-sheet via `Modal variant="bottom-sheet"`. Re-renders
the quick-tab strip at the top of the sheet plus one labelled group per
advanced filter using the same renderer as the desktop bar — behaviour stays
identical.

---

## API

```ts
interface FilterBarProps {
  search?:            SearchProp;

  quickFilters?:      QuickFilter[];
  activeQuickFilter?: string;
  onQuickFilterChange?: (id: string) => void;
  quickFilterStyle?:  "underline" | "pill";

  filters?:           FilterDef[];

  actions?:           FilterBarAction[];

  activeFiltersDisplay?: "chips" | "summary" | "hidden";
  onClearAll?:        () => void;

  view?:              { value: string; onChange: (v: string) => void;
                        options: { id: string; label: string; icon?: ReactNode }[] };

  collapseBelowPx?:   number;   // default 1024

  className?: string;
  testId?:    string;
}

interface SearchProp {
  value:        string;
  onChange:     (v: string) => void;
  placeholder?: string;
  debounceMs?:  number;   // default 300
  shortcut?:    boolean;  // ⌘K
}

interface QuickFilter {
  id:        string;
  label:     string;
  count?:    number | "high";       // "high" renders the truncation pill
  variant?:  "destructive" | "warning" | "success";
  icon?:     ReactNode;
  dotOnPositive?: boolean;
}

interface FilterBarAction {
  label:     string;
  onClick?:  () => void;
  href?:     string;
  variant?:  "primary" | "secondary" | "ghost";
  icon?:     ReactNode;
  disabled?: boolean;
  loading?:  boolean;
  iconOnlyMobile?: boolean;
}
```

`FilterDef` is a discriminated union — see [components/ui/filter-bar/types.ts](../../components/ui/filter-bar/types.ts) for the full shape per `type`. Common fields:

```ts
interface FilterBase {
  id:        string;
  label:     string;
  helpText?: string;
  hidden?:   boolean;   // keep state, hide from UI
  disabled?: boolean;   // muted trigger, no popover
}
```

---

## URL sync with `useFilterParams`

Filter values are bookmarkable and shareable when paired with the companion
hook. The hook is **separate** from `FilterBar` so the component stays usable
with any state source (local `useState`, Zustand, etc.).

```ts
const [filters, setFilters] = useFilterParams({
  search:    { default: "",           serialize: "raw" },
  status:    { default: "all",        serialize: "raw" },
  building:  { default: "all",        serialize: "raw" },
  dateRange: { default: [null, null], serialize: "iso-range" },
  amount:    { default: [null, null], serialize: "num-range" },
  tags:      { default: [],           serialize: "csv" },
});

setFilters({ status: "in-house" });
setFilters({ dateRange: [from, to] });
```

### Serializers

| `serialize` | URL shape | Value type |
| --- | --- | --- |
| `"raw"` | `?status=in-house` | `string` |
| `"iso-range"` | `?dateRange=2026-05-10:2026-05-20` (either side may be empty) | `[Date \| null, Date \| null]` |
| `"num-range"` | `?amount=100:500` (either side may be empty) | `[number \| null, number \| null]` |
| `"csv"` | `?tags=a,b,c` | `string[]` |

Values equal to the declared default are stripped from the URL automatically,
so shared links only carry meaningfully diverged facets.

Dates are parsed at local midnight to keep stay-date boundaries TZ-stable.

---

## DataTable integration

FilterBar and DataTable don't know about each other — the parent component
owns filter state and hands derived data to both.

```tsx
const [filters, setFilters] = useFilterParams({ ... });
const { data, counts, isLoading } = useReservations(filters);

const hasActiveFilters =
  filters.building !== "all" ||
  filters.dateRange[0] !== null ||
  filters.rateType !== "all";

return (
  <>
    <FilterBar
      search={{ value: filters.search, onChange: (v) => setFilters({ search: v }) }}
      quickFilters={buildQuickFilters(counts)}
      activeQuickFilter={filters.status}
      onQuickFilterChange={(s) => setFilters({ status: s })}
      filters={[ /* ... */ ]}
      onClearAll={resetAdvancedFilters}
    />
    <DataTable
      data={data}
      loading={isLoading}
      hasActiveFilters={hasActiveFilters}
      emptyState={<NoReservationsFirstTime onCreate={create} />}
      noResultsState={<NoReservationsForFilters onClearFilters={resetAdvancedFilters} />}
    />
  </>
);
```

**Key contract:** tab counts come from the same query that returns rows —
never a separate request per tab. The query returns `{ data: Row[], counts:
Record<TabId, number> }` in a single payload (Expenses sets the pattern; the
other migrated pages converge on it during their server-query refactors).

---

## Recipes

### Reservations (10 tabs, 4 advanced filters, all presets)

```tsx
<FilterBar
  search={{ value: search, onChange: setSearch, placeholder: t("search") }}
  quickFilters={[
    { id: "all",         label: tTabs("all"),         count: summary.all },
    { id: "arriving",    label: tTabs("arriving"),    count: summary.arriving,    variant: "warning" },
    { id: "inHouse",     label: tTabs("inHouse"),     count: summary.inHouse },
    { id: "dueCheckout", label: tTabs("dueCheckout"), count: summary.dueCheckout, variant: "warning" },
    { id: "overstay",    label: tTabs("overstay"),    count: summary.overstay,    variant: "destructive", dotOnPositive: true },
    { id: "upcoming",    label: tTabs("upcoming"),    count: summary.upcoming },
    { id: "checkedOut",  label: tTabs("checkedOut"),  count: summary.checkedOut },
    { id: "cancelled",   label: tTabs("cancelled"),   count: summary.cancelled },
    { id: "noShow",      label: tTabs("noShow"),      count: summary.noShow },
    { id: "overdueArrival", label: tTabs("overdueArrival"), count: summary.overdueArrival },
  ]}
  activeQuickFilter={activeTab}
  onQuickFilterChange={(id) => setActiveTab(id as TabKey)}
  filters={[
    { id: "property", type: "select",    label: t("propertyLabel"),  value: advFilters.propertyId, allValue: "",
      options: [{ value: "", label: t("allProperties") }, ...properties.map((p) => ({ value: p.id, label: p.name }))],
      onChange: (v) => setAdvFilters((s) => ({ ...s, propertyId: v })) },
    { id: "date",     type: "dateRange", label: t("dateLabel"),
      value: [parseISO(advFilters.dateFrom), parseISO(advFilters.dateTo)],
      presets: "all",
      onChange: ([from, to]) => setAdvFilters((s) => ({ ...s, dateFrom: fmtISO(from), dateTo: fmtISO(to) })) },
    { id: "rateType", type: "select",    label: t("rateTypeLabel"),  value: advFilters.rateType, allValue: "",
      options: [{ value: "", label: t("allRateTypes") }, { value: "daily", label: t("daily") }, { value: "monthly", label: t("monthly") }],
      onChange: (v) => setAdvFilters((s) => ({ ...s, rateType: v })) },
    { id: "source",   type: "select",    label: t("sourceLabel"),    value: advFilters.source, allValue: "",
      options: sourceOptions,
      onChange: (v) => setAdvFilters((s) => ({ ...s, source: v })) },
  ]}
  actions={[
    { label: t("refresh"), onClick: fetchData, variant: "ghost",
      icon: <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />,
      disabled: loading, iconOnlyMobile: true },
  ]}
  activeFiltersDisplay="chips"
  onClearAll={() => setAdvFilters(emptyAdvFilters)}
/>
```

### Units — scoped-property edge case

When the global property selector is locked to one building, the building
filter renders disabled with the scoping note attached as `helpText`:

```tsx
filters={[
  {
    id:       "property",
    type:     "select",
    label:    t("buildingLabel"),
    value:    scopedToBuilding ? properties[0]?.id ?? "" : (currentProperty || ""),
    allValue: "",
    disabled: scopedToBuilding,
    helpText: scopedToBuilding ? t("scopedNote") : undefined,
    options:  scopedToBuilding
      ? properties.map((p) => ({ value: p.id, label: p.name }))
      : [{ value: "", label: t("allProperties") }, ...properties.map((p) => ({ value: p.id, label: p.name }))],
    onChange: (property) => setFilters({ property }),
  },
  /* … */
]}
```

### Invoices — tone-tinted tabs + hidden chips

```tsx
<FilterBar
  search={{ value: search, onChange: (v) => setFilters({ search: v }) }}
  quickFilters={[
    { id: "ALL",            label: "All",            count: counts.ALL },
    { id: "DRAFT",          label: "Draft",          count: counts.DRAFT,          variant: "warning" },
    { id: "ISSUED",         label: "Outstanding",    count: counts.ISSUED },
    { id: "OVERDUE",        label: "Overdue",        count: counts.OVERDUE,        variant: "destructive", dotOnPositive: true },
    { id: "PARTIALLY_PAID", label: "Partially paid", count: counts.PARTIALLY_PAID, variant: "warning" },
    { id: "PAID",           label: "Paid",           count: counts.PAID,           variant: "success" },
    { id: "CANCELLED",      label: "Cancelled",      count: counts.CANCELLED },
  ]}
  activeQuickFilter={status}
  onQuickFilterChange={(s) => setFilters({ status: s })}
  activeFiltersDisplay="hidden"
/>
```

### Custom filter — floor-plan picker

```tsx
{
  id:    "floor-plan",
  type:  "custom",
  label: "Layout",
  isActive: selectedRooms.length > 0,
  displayValue: selectedRooms.length === 1
    ? `Room ${selectedRooms[0]}`
    : `${selectedRooms.length} rooms`,
  render: ({ close }) => (
    <FloorPlanPicker
      value={selectedRooms}
      onChange={setSelectedRooms}
      onDone={close}
    />
  ),
  onClear: () => setSelectedRooms([]),
}
```

---

## Accessibility

- **Search input** sits inside a `<form role="search">`. Submit (Enter) flushes the debounce immediately. The ⌘K keyboard hint is `aria-hidden`.
- **Quick filter tabs** implement the WAI-ARIA tabs pattern (`role="tablist"`, `role="tab"`, `aria-selected`). Arrow keys move, Home/End jump.
- **Dropdown filter triggers** carry `aria-haspopup="listbox"` (or `"dialog"` for ranges) and `aria-expanded`. Click outside or Escape closes the popover.
- **Active chips** have explicit "Remove `<label>` filter" labels on the dismiss button — never just `×`.
- **Mobile drawer** is a `Modal variant="bottom-sheet"` — focus trap, scrim, Escape close are inherited.
- **Color is never the only signal:** every variant comes with a label change too (chips read "Building: Al Noor"; tabs include the count text).
- **Focus rings:** every interactive control has a visible `shadow-focus` ring.

---

## RTL

The bar inherits `dir` from the document. All side-specific styling uses
logical CSS properties (`inset-inline-start`, `ps-*`, `pe-*`, `ms-*`, `me-*`).
The search icon, dismiss button, chevrons, active chips, and FAB all flip
automatically. Tab strip scrolls right-to-left in RTL containers per the
browser default. Number badges stay LTR via `ltr-numbers` so "500+" doesn't
read "+500".

```tsx
<div dir="rtl">
  <FilterBar
    search={{ placeholder: "ابحث في الحجوزات…" }}
    quickFilters={[{ id: "all", label: "الكل", count: 127 }]}
  />
</div>
```

---

## Things to avoid

- **Do not wrap FilterBar in another bordered card.** It already has its own
  surface treatment. Stacking it inside `bg-white rounded-xl shadow-sm`
  produces a double-card look.
- **Do not put filters that should be in the table inside FilterBar.** Column-
  scoped filters (e.g. "only show rows where amount > X" with a per-column
  input) belong in DataTable.
- **Do not skip `onClearAll` when `activeFiltersDisplay` is `"chips"`.** The
  "Clear all (N)" link only appears when this is wired.
- **Do not pick `variant` by colour.** "I want red" is not a reason — pick by
  intent: `destructive` for urgent attention, `warning` for time-sensitive,
  `success` for positive completion.
- **Do not run separate queries for the tab counts.** They must come from the
  same query that returns the rows. One payload, one round trip.
- **Do not migrate to FilterBar inside Server Components.** FilterBar is
  interactive — wrap it in a `"use client"` child like the page-specific
  `PaymentsFilters`, `InvoicesFilters`, etc. patterns.
- **Do not bypass the debounce.** The default 300 ms is non-negotiable for
  search. Set `debounceMs: 0` only when the parent already handles debouncing
  (e.g. Expenses' `debouncedSearch` effect).
- **Do not stack two FilterBars on one page.** If a page needs two filter
  zones, it's two pages.

---

## Migration history

Phase 1 audit (`bf65bca`) → Phase 2 build in five commits (`a38d4b3`,
`7541d04`, `5c8ac36`, `0547736`, `92635f5`) → Phase 3 per-page migrations
(`42c4b55` Properties, `89dc9c2` Units, `9afda08` Tenants, `c35652a` Payments,
`80062f1` Expenses, `875a577` Invoices, `5ef8ab1` Reservations + orphan
delete) → Phase 4 documentation.

**Net change across Phase 3:** ~1,000 lines of bespoke filter UI removed
across the seven list pages, replaced with one consistent primitive.

**Behaviour changes worth flagging during QA:**
- Reservations now debounces search at 300 ms (was instant; a `searchRef` debounce stub had been silently broken).
- Reservations `dateFrom` + `dateTo` collapse into a single `dateRange` filter with all eight presets including `khareef-season`.
- Payments and Invoices tab clicks navigate via client URL params instead of full page submits.
- Invoices loses the bespoke overdue-badge pulse; the FilterBar's `dotOnPositive` red dot signals urgency instead.
- Expenses drops the count+subtotal hybrid badge; per-status totals remain in the table footer.
