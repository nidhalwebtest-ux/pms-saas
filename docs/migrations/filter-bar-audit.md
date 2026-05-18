# FilterBar migration — Phase 1 audit

Pre-build inventory of every list-page filter implementation in the Salalah
PMS codebase.
Scope: the 7 list views under `app/dashboard/`. Conducted 2026-05-18.

This drives the migration plan for the new `components/ui/filter-bar/`
design-system component and the companion `useFilterParams` URL-sync hook.

---

## TL;DR

| Category | Count | Notes |
| --- | --- | --- |
| List pages with filter UI | **7** | Reservations, Tenants, Invoices, Payments, Expenses, Properties, Units |
| Different state-management patterns | **3** | URL params (debounced) · local `useState` · server-side GET form |
| Different tab visual treatments | **3** | Filled-pill, underline-nav, tone-tinted-pill |
| Search-debounce values | **3** | 300 ms, 500 ms, none |
| Pages with collapsible advanced filters | **4** | Reservations, Tenants, Properties, Units |
| Pages with always-visible advanced filters | **1** | Expenses |
| Pages with no advanced filters | **2** | Invoices (status only), Payments (period only) |
| Orphan filter files | **1** | `app/dashboard/reservations/ReservationFilters.tsx` exists but is not imported |
| Explicit "Clear all filters" affordance | **1** | Reservations only |
| Pages with mobile-specific filter UI | **0** | All pages collapse via grid breakpoints only — no drawers, no FABs |

**Headline:** every list page reimplements the same shape — quick-filter tabs +
search + dropdowns — with three independent state-management approaches and
three independent visual languages. There is no shared FilterBar at all, and
the closest existing primitive (`ReservationFilters.tsx`) is dead code.

---

## 1. Per-page inventory

Counts are distinct controls per page. State pattern is the source of truth
for filter values (where the parent reads `filters.x` from).

### Reservations — [app/dashboard/reservations/ReservationsView.tsx](app/dashboard/reservations/ReservationsView.tsx)

- **Tabs (10):** `all`, `arriving`, `inHouse`, `dueCheckout`, `overstay`, `upcoming`, `checkedOut`, `cancelled`, `noShow`, `overdueArrival`. Filled-pill style with inline count badges.
- **Search:** plain input, **no debounce**. There is a `searchRef` set up at L409 but never used.
- **Advanced filters (collapsible):** property dropdown, dateFrom/dateTo inputs, rateType, source.
- **State:** **local `useState`** for everything — never reaches the URL during the session. `advFilters` at L403, filtering happens client-side in a `useMemo` at L457–L491.
- **Counts:** separate API call to `/api/reservations/summary` at L425.
- **Clear-all:** explicit button labelled `clearAllFilters`, visible only when filters active.
- **Responsive:** grid `grid-cols-2 sm:grid-cols-5` at L742. No drawer.
- **Note:** [ReservationFilters.tsx](app/dashboard/reservations/ReservationFilters.tsx) is an unused parallel implementation with 500 ms debounce + URL sync. Dead code.

### Tenants — [TenantsView.tsx](app/dashboard/tenants/TenantsView.tsx) + [TenantFilters.tsx](app/dashboard/tenants/TenantFilters.tsx)

- **Tabs (3):** `all`, `active`, `inactive`. Pill style, count badges from `counts` prop.
- **Search:** debounced **300 ms** at [TenantFilters.tsx:64-68](app/dashboard/tenants/TenantFilters.tsx#L64-L68), pushed to URL.
- **Advanced filters (collapsible):** tenantType, source.
- **State:** **URL query params** (`useSearchParams` + custom push helper).
- **Counts:** computed server-side, passed via `counts` prop.
- **Clear-all:** none — only per-filter X buttons.
- **Responsive:** `grid-cols-1 sm:grid-cols-2` at L169.

### Invoices — [app/dashboard/invoices/page.tsx](app/dashboard/invoices/page.tsx)

- **Tabs (7):** `ALL`, `DRAFT`, `ISSUED`, `OVERDUE`, `PARTIALLY_PAID`, `PAID`, `CANCELLED`. Tone-tinted (red pulse for `OVERDUE` at L257-270, amber for warn).
- **Search:** **none** — traditional `<form method="GET">` with submit button at L280.
- **Advanced filters:** none in UI; only a hidden `propertyId` input from the global property scope.
- **State:** **server-side URL params** only. The page is a server component.
- **Counts:** 5 separate `prisma.invoice.count()` calls at L111-134 — a small N+1.
- **Clear-all:** clear link visible when `search` is set; no holistic clear.
- **Responsive:** `flex-wrap gap-3` on the form bar.

### Payments — [app/dashboard/payments/page.tsx](app/dashboard/payments/page.tsx)

- **Tabs (4):** `all`, `today`, `week`, `month`. **Underline nav style** (border-b) — visually distinct from every other page.
- **Search:** `<form method="GET">`, **no debounce**.
- **Advanced filters:** inline `method` select dropdown in the same form row.
- **State:** **server-side URL params**.
- **Counts:** separate count query per period at L77-82.
- **Clear-all:** clear link visible when search active.
- **Responsive:** `flex-wrap gap-3` + `min-w-[200px]` on the search input.

### Expenses — [ExpensesListClient.tsx](app/dashboard/expenses/ExpensesListClient.tsx)

- **Tabs (5):** `ALL`, `PENDING`, `APPROVED`, `REJECTED`, `PROCESSED`. **Filled pill + currency subtotal** in badge at L330-334 — unique to this page.
- **Search:** debounced **300 ms** via separate `debouncedSearch` state at L97-100.
- **Advanced filters (always visible):** property, category. No collapsible toggle.
- **State:** **local `useState`** (L75-79); data fetched client-side via API with `URLSearchParams`. No URL persistence.
- **Counts:** `statusCounts` returned in the same API response at L117 — the cleanest counts pattern in the codebase.
- **Clear-all:** none.
- **Responsive:** `grid-cols-1 sm:grid-cols-4`, search spans `sm:col-span-2`.
- **Extra:** conditional bulk-actions bar at L398, footer aggregate at L436-448.

### Properties / Buildings — [PropertiesView.tsx](app/dashboard/properties/PropertiesView.tsx) + [PropertyFilters.tsx](app/dashboard/properties/PropertyFilters.tsx)

- **Tabs (4):** `all`, `active`, `inactive`, `archived`. Pill style.
- **Search:** debounced **300 ms** at [PropertyFilters.tsx:65-70](app/dashboard/properties/PropertyFilters.tsx#L65-L70).
- **Advanced filters (collapsible):** property type as inline radio-style pills (5 options) — uses pill row, not dropdown.
- **State:** **URL query params**.
- **Counts:** server-side, passed via `statusCounts` prop.
- **Clear-all:** none.
- **Responsive:** `flex flex-wrap` on type pills.

### Units — [page.tsx](app/dashboard/units/page.tsx) + [UnitFilters.tsx](app/dashboard/units/UnitFilters.tsx)

- **Tabs (5):** `all`, `vacant`, `occupied`, `reserved`, `maintenance`. Pill style.
- **Search:** debounced **300 ms** at [UnitFilters.tsx:69-74](app/dashboard/units/UnitFilters.tsx#L69-L74).
- **Advanced filters (collapsible):** property (disabled when globally scoped), floor, type pills (6 options).
- **State:** **URL query params**.
- **Counts:** server-side, computed at [page.tsx:154-160](app/dashboard/units/page.tsx#L154-L160).
- **Clear-all:** none.
- **Responsive:** `grid-cols-1 sm:grid-cols-2` + `flex flex-wrap` for type pills.
- **Note:** scoped-property mode locks the property dropdown with an inline note at L199.

---

## 2. Cross-page synthesis

### Shape of "search + tabs + dropdowns"

| Element | Shape |
| --- | --- |
| Tabs | Always above the search bar. Always single-row, horizontally scrollable. Pill-style in 5/7 pages, underline-nav in 1, tone-tinted pills in 1. |
| Search | Always present except Invoices (form-submit) and Payments (form-submit). Magnifying-glass icon at inline-start, clear X at inline-end. |
| Advanced filters | Collapsible behind a "Filters" button in 4/7 pages; always-on grid in 1; absent in 2. |
| Counts on tabs | Always present. 4 different source patterns (separate endpoint, prisma groupBy, multiple counts, included in main payload). |
| Active state | Tab adopts blue fill + white text. Active dropdown trigger gets a subtle border tint. No active-chip row anywhere today. |
| Mobile | Grid `sm:` breakpoints only. No drawers, no bottom sheets, no FABs. |

### Inconsistencies the FilterBar must resolve

| Dimension | Variations seen | Pages |
| --- | --- | --- |
| Search debounce | 0 ms / 300 ms / 500 ms / none (form submit) | Reservations (none), Tenants/Expenses/Properties/Units (300), legacy ReservationFilters (500), Invoices/Payments (form) |
| Tab style | filled pill / underline / tone-tinted pill | Pill: 5 pages · Underline: Payments · Tinted: Invoices |
| Count badge palette | white-on-blue (active) + gray (inactive) / tone-coded (red/amber/green) / count+subtotal hybrid | Tone-coded: Invoices · Count+subtotal: Expenses · Plain: rest |
| Clear-all label | "clearAllFilters" / per-filter X / absent | Reservations is the only one with an explicit clear-all |
| Search placeholder | generic ("Search…") vs domain ("Search tenant name…") | Invoices uses generic; all others domain-specific |
| Advanced-filter layout | always visible / collapsible / mixed (pills below grid) | Expenses always visible, 4 collapsible, Properties+Units mix |
| Per-filter clear | X on dropdown trigger / X on search only / none | Reservations clears dropdowns from the clear-all link; others rely on selecting "All" |

### State management — three patterns, fix to one

| Pattern | Pages | Trade-off |
| --- | --- | --- |
| **URL query params (debounced)** | Tenants, Properties, Units | Shareable links, refresh-safe. Recommended baseline. |
| **Local `useState`** | Reservations, Expenses | No persistence — refresh wipes filters. Reservations also loses on session reload. |
| **Server-side GET form** | Invoices, Payments | Works but feels old; no instant feedback on tab clicks. |

**Recommendation:** standardise on URL query params via the new
`useFilterParams` hook. Invoices / Payments stay server-rendered but switch
from `<form>` submission to client-side query-param navigation so tabs feel
instant.

### Performance findings

- **Reservations re-filters everything in a `useMemo`** on every keystroke at [L457-L491](app/dashboard/reservations/ReservationsView.tsx#L457-L491). Fine for ~100 rows, will bite at 5,000+. Compounded by the missing search debounce.
- **Invoices runs 5 separate `prisma.count()` queries** at L111-134 instead of one `groupBy`. Easy win but out of FilterBar scope.
- **Payments runs 4 separate count queries** at L77-82. Same issue.
- **Expenses' single-query `statusCounts`** pattern is the right one — every other page should converge on it during Phase 3 page-by-page migration.
- **No N+1 inside the filter UI itself** — re-renders are cheap; the bottleneck is the count queries.

### DataTable integration

Every page already passes its filtered/sorted data to `DataTable`. Pattern is:
parent owns filter state → derives `data`, `counts`, and `hasActiveFilters` →
hands them to both FilterBar (when it exists) and DataTable. The FilterBar
spec already locks this contract — counts come from the same query, parent
owns state. No DataTable changes needed.

---

## 3. Recommended migration priority

Five phases per the spec, three groupings by complexity for the page sweep.

### Phase 2 — Build (next, blocking)

- `components/ui/filter-bar/` — `FilterBar.tsx` + 5 sub-components, 7 filter renderers, `types.ts`, `index.ts`, mobile drawer.
- `hooks/useFilterParams.ts` — URL-sync hook with serialisers (`raw`, `iso-range`, `num-range`).
- Tailwind class map per spec §9.

### Phase 3 — Migrate pages (easy → hard)

1. **Buildings/Properties** — 4 tabs, search + 1 advanced filter (type pills). Already URL-synced. Lowest-risk migration; sets the pattern for the rest.
2. **Units** — 5 tabs, search + 3 advanced filters incl. scoped-property edge case. URL-synced.
3. **Tenants** — 3 tabs + 2 advanced filters. URL-synced.
4. **Payments** — converts server-form to client URL params; underline-nav tabs become standard pills.
5. **Expenses** — 5 tabs, 2 advanced filters, **count+subtotal badge** is a special case. Switch from local state to URL params.
6. **Invoices** — converts server-form; **tone-tinted tabs** map to FilterBar's `variant: warning/destructive/success`.
7. **Reservations** — 10 tabs (8 + secondary), 4 advanced filters, no URL sync today, no debounce. Biggest behavioural change. **Delete the orphan `ReservationFilters.tsx` during this migration.**

### Phase 4 — Docs

`docs/design-system/filter-bar.md` — variants, types, presets per list page,
RTL, a11y, URL-sync recipes.

---

## 4. Surprises & risks

- **`ReservationFilters.tsx` is dead code** but uses a 500 ms debounce + URL sync — closer to the spec than the live ReservationsView code. Delete it as part of the Reservations migration; don't try to revive.
- **Reservations loses filter state on refresh today.** Migrating to `useFilterParams` will *add* persistence — a behaviour change, not a regression, but worth calling out so QA expects it.
- **Invoices/Payments tab clicks reload the page today.** Moving to client-side URL navigation will feel faster, but the underlying queries are still server-side — confirm the API surface accepts query params without a full SSR round-trip.
- **Expenses' count+subtotal badge** doesn't map to any FilterBar variant in the spec. Two options: (a) accept a count-only badge and show subtotals in a separate footer (already exists at L436-448), (b) extend the `QuickFilter` type to accept a string count like `"24 · 12.500 OMR"`. Recommend (a) — keep badge semantics consistent.
- **Property scope on Units** is global app state (header dropdown). The Units FilterBar config must respect it — the property dropdown should render as disabled, not absent, so users see what's locked. The spec's `custom` filter type covers this, but a plain `select` with `disabled` would too. Decide during Phase 3.
- **Underline-nav tabs on Payments** look intentional for time-period facets vs status facets. The FilterBar spec ships `underline` (default) and `pill`. Confirm we want every page on the same style or accept the visual difference as semantic ("period" vs "status").
- **No mobile-specific filter UI exists today.** The new mobile drawer + FAB pattern is net-new behaviour. Worth a tablet/mobile QA pass on each page once migrated; users won't expect it.
- **Adding `useFilterParams` to client components only** — Invoices and Payments are server components today. They'll either need a small client wrapper for the FilterBar, or the FilterBar must be SSR-safe. Spec implies client-only (it's interactive). Plan to ship a thin `"use client"` wrapper per page during migration.
