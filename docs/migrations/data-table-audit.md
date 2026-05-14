# DataTable migration — Phase 1 audit

Pre-build inventory of every table / list-page implementation in the
Salalah PMS codebase. Drives the migration plan for the new
`components/ui/data-table/` design-system component (Phase 2 onward).

Scope: `app/`, `components/`. Conducted 2026-05-14.

---

## TL;DR

| Metric | Count | Notes |
| --- | --- | --- |
| List pages with a real `<table>` | **7** | Reservations, Tenants, Invoices, Payments, Expenses, Units, Buildings/Properties |
| Pages with server-side pagination | **1** | Invoices (PAGE_SIZE=20) |
| Pages with capped client-side loads | 2 | Tenants (take: 300), Payments (take: 200) |
| Pages with no pagination at all | 4 | Reservations, Expenses, Units, Properties |
| Pages with row selection / bulk actions | **0** | Inline edit exists on Tenants + Units (single-row, not multi) |
| Shared `<Table>` / `<Pagination>` primitives | **0** | Every page hand-rolls its own |
| List pages using cards instead of tables | 1 | Settings → Team (`MemberRow` / `InvitationRow`) — kept as list, not migrating |

7 hand-rolled tables, zero shared primitives. High-value consolidation
target.

---

## Per-resource summaries

### 1. Reservations — most complex
- **Files:** [app/dashboard/reservations/page.tsx](app/dashboard/reservations/page.tsx), [app/dashboard/reservations/ReservationsView.tsx](app/dashboard/reservations/ReservationsView.tsx) (sub: `ReservationTableRow`, `CheckInModal`, `CheckOutModal`)
- **Columns:** 10 — Res#, Status, Guest (name + flag + VIP), Units (chips +overflow), Check-in, Check-out, Duration, Total, Balance, Actions
- **Sort:** client-side; sortable: startDate, endDate, grandTotal, balanceDue, displayStatusPriority (default)
- **Pagination:** **none** — fetches all matching from `/api/reservations`. Risk: unbounded
- **Selection:** none
- **Fetching:** client `useEffect` → fetch list + summary; summary refetches every 60 s
- **Row interaction:** row link to detail; per-row action buttons open check-in/out/cancel/no-show modals
- **Special cells:** status badge with row tint (`displayStatusRowClass`), color-coded dates (today/overdue), country flag, VIP star, unit chip overflow `+N`
- **Empty/loading:** spinner; per-tab `EmptyState` with emoji + i18n string
- **Mobile:** horizontal scroll only — no card variant today
- **Volume:** medium (hundreds typical, no hard cap)
- **Notable:** dynamic tab counts (`/api/reservations/summary`), per-row tint by display status

### 2. Tenants — has inline edit + 3-view mode
- **Files:** [app/dashboard/tenants/page.tsx](app/dashboard/tenants/page.tsx) (`take: 300`), [app/dashboard/tenants/TenantsView.tsx](app/dashboard/tenants/TenantsView.tsx) (sub: `TenantTableRow`, `EditableRow`, `TenantCard`, `TenantSummaryCard`)
- **Columns (table):** 7 — Avatar, Name+nationality+tags, Contact, Type, Source, Stays, Actions
- **Sort:** client-side; sortable: name, tenantType, classification, source, totalStays, totalSpent, createdAt, activeReservations
- **Pagination:** **none — capped at 300**
- **Selection:** none (but **inline edit mode** per row via pencil icon — `useTransition` server action `quickUpdateTenant`)
- **Fetching:** server component, URL params drive filter
- **Row interaction:** row link to profile; inline cell edit toggle; full-edit link
- **Special cells:** initials avatar with classification color; cyclic classification badge (regular ↔ VIP ↔ blacklisted); tag pills `+N`
- **Empty/loading:** icon + message; no skeleton
- **Mobile:** progressive column hide (Phone @sm, Type @md, Source @lg, Stays @xl) + card / summary view modes
- **Volume:** small (≤300)
- **Notable:** **3-view mode** (table / cards / summary); **inline edit per row**

### 3. Invoices — only server-paginated table
- **File:** [app/dashboard/invoices/page.tsx](app/dashboard/invoices/page.tsx)
- **Columns:** 11 — Invoice#, Status, Tenant (name + phone), Reservation, Period, Issue date, Total, Paid, Balance, Due, Actions
- **Sort:** **none in UI** — server orderBy hardcoded `createdAt: desc`
- **Pagination:** **server, PAGE_SIZE=20**, custom prev/next + numbered (up to 7 pages)
- **Selection:** none
- **Fetching:** server component, URL params, `prisma.invoice.aggregate()` for footer totals
- **Row interaction:** row link to detail; "Issue" (drafts), "Pay" (balance due), "Print" actions
- **Special cells:** invoice status badge via `resolveInvoiceBadge(status, dueDate)`; row tint amber for draft, red for overdue
- **Empty/loading:** "No invoices yet"; no skeleton
- **Mobile:** horizontal scroll only
- **Volume:** large (1000s+); already server-paginated
- **Notable:** tab-filter (all / toBeIssued / outstanding / overdue / partial / paid / cancelled) with counts; footer aggregates

### 4. Payments — simplest
- **File:** [app/dashboard/payments/page.tsx](app/dashboard/payments/page.tsx)
- **Columns:** 9 — Receipt#, Date, Tenant, Amount, Method, Reference, Applied To (invoices), Received By, Actions
- **Sort:** server orderBy hardcoded `date: desc`; **no UI toggle**
- **Pagination:** none (capped at 200)
- **Selection:** none
- **Fetching:** server component with period tabs (today/week/month/all), method filter, search; totals aggregated in JS after fetch
- **Row interaction:** row link + print receipt link
- **Special cells:** payment method badge; allocation summary (comma-separated invoice numbers or "unapplied")
- **Empty/loading:** "No payments yet"; no skeleton
- **Mobile:** horizontal scroll only
- **Volume:** medium; risk above 200
- **Notable:** `<tfoot>` showing totals broken down by method

### 5. Expenses — only client-fetched dynamic table
- **Files:** [app/dashboard/expenses/page.tsx](app/dashboard/expenses/page.tsx), [app/dashboard/expenses/ExpensesListClient.tsx](app/dashboard/expenses/ExpensesListClient.tsx)
- **Columns:** ~10 — Status, Description, Amount, Category, Property, Submitted by/at, Reviewed by/at, Processed by/at, Actions
- **Sort:** client-side (toggle via header click)
- **Pagination:** none (`limit=200` in fetch URL)
- **Selection:** none (post-Phase-4 reject/delete are single-row actions via ConfirmDialog)
- **Fetching:** client `useEffect` → `/api/expenses?status=…&propertyId=…&categoryId=…&search=…`
- **Row interaction:** row link to detail; per-row Approve/Reject/Process via dialogs
- **Special cells:** expense status badge; receipt thumbnail with lightbox; user name + date stacks
- **Empty/loading:** message; no skeleton
- **Mobile:** horizontal scroll only
- **Volume:** small-medium (~200 cap)
- **Notable:** role-based default tab; ConfirmDialog used for Reject + Delete (already migrated)

### 6. Units — has inline edit
- **Files:** [app/dashboard/units/page.tsx](app/dashboard/units/page.tsx), [app/dashboard/units/UnitsView.tsx](app/dashboard/units/UnitsView.tsx)
- **Columns:** 9 — Photo, Name (+property + description), Property, Type, Floor, Beds/Baths, Base price, Status, Actions
- **Sort:** server-side initial via `?sort=`, client re-sort on toggle; sortable: name, unitType, floor, bedrooms, basePrice, displayStatus
- **Pagination:** none
- **Selection:** none (**inline edit on name** only — `quickUpdateUnit` server action)
- **Fetching:** server component, counts (vacant/occupied/reserved/maintenance) fetched in parallel
- **Row interaction:** row link; pencil toggles inline edit; full edit link
- **Special cells:** photo thumbnail with placeholder; unit type badge; status badge with colored dot; price `.toFixed(3)` + "OMR"; "G" / "F1" floor format
- **Empty/loading:** icon + message; no skeleton
- **Mobile:** progressive column hide (Property @sm, Type @md, Floor/Beds @lg, Price @xl)
- **Volume:** small-medium (<1000)
- **Notable:** status-tab counts in header; inline edit; CSV export + print

### 7. Buildings / Properties — 3-view mode, smallest
- **Files:** [app/dashboard/properties/page.tsx](app/dashboard/properties/page.tsx), [app/dashboard/properties/PropertiesView.tsx](app/dashboard/properties/PropertiesView.tsx)
- **Columns (table):** 8 — Thumbnail, Name+city, Type, City, Total/Occupied/Vacant units, Actions
- **Sort:** server initial + client re-sort; sortable: name, type, city, unit counts, isActive, createdAt, revenueThisMonth
- **Pagination:** none
- **Selection:** none
- **Fetching:** server, includes unit counts + this-month revenue from payment allocations
- **Row interaction:** row link
- **Special cells:** property type badge; inline occupancy bar (green <60%, amber 60-90%, red ≥90%); revenue or "No payments"
- **Empty/loading:** message; no skeleton
- **Mobile:** progressive column hide + card / summary view modes
- **Volume:** very small (<50)
- **Notable:** **3-view mode** (table / cards / summary); danger zone (already migrated)

---

## Cross-cutting findings

### Status badge helpers (reused everywhere)
Already extracted to [components/ui/badge-helpers.ts](components/ui/badge-helpers.ts):
- `getReservationStatusBadge`, `resolveInvoiceBadge`, `getUnitStatusBadge`, `getUnitTypeBadge`, `getTenantClassBadge`, `getTenantTypeBadge`, `getPaymentMethodBadge`, `getExpenseStatusBadge`, `getPropertyTypeBadge`, `getUserRoleBadge`

DataTable's `StatusCell` should accept either a `tone+children` or a `kind` shortcut that wires through these helpers — no duplication.

### Sorting logic — duplicated per page
Each list page has its own `useMemo`-driven client sort (Reservations, Tenants, Units, Properties, Expenses). Same shape — `sortKey` + `sortDir` + a custom switch. The new DataTable should absorb all of these.

### Pagination — only 1 implementation
The Invoices page has a hand-rolled prev/next/numbered pager. No reusable `<Pagination>` exists. Build it inside `data-table/`.

### Tab-filtering — universal but out of DataTable scope
Reservations, Invoices, Payments, Expenses all use status tabs with counts above the table. Per the spec, `FilterBar` is a separate component coming later. **DataTable should not own tab UI** — it just receives filtered data.

### Inline edit — two pages, custom pattern
Tenants and Units both use a "pencil → editable row → save via `useTransition` server action" pattern. **Not a standard TanStack feature.** Decision needed (see questions below) on whether DataTable supports this natively.

### Multi-view mode — two pages
Tenants and Properties offer table / card / summary view toggles. **Not a DataTable concern** — the page can render `<DataTable>` vs a card grid vs summary cards based on a view-mode state. DataTable just owns the table view.

### Print layouts
Invoice + Reservation print pages have separate `<table>` markup with print CSS. Out of scope for DataTable — those stay as-is.

### Non-list `<table>` usage
~14 detail pages and dashboard widgets render small embedded `<table>` elements for line items, allocations, breakdowns. **Not in scope** for this migration — DataTable is for *list* pages.

---

## Recommended migration order (Phase-later)

Spec order: Reservations → Invoices → Tenants → Expenses → Payments → Units → Buildings.

The audit largely supports it, with one note:

- **Invoices first might be smarter than Reservations.** Invoices is the only page already on server pagination, so it exercises the DataTable's server mode cleanly without also having to redesign the data fetch. Reservations is high-complexity (tabs, modals, row tinting, summary refresh) and will dominate the migration commit — better to validate the primitive against the simpler page first.
- The user's call. Both are defensible.

The build phase ([Phase 2](#)) only depends on knowing the *shape* of features; order is settled later.

---

## Open architecture decisions (block Phase 2)

Three decisions are worth nailing down before I start building, because they each materially shape the API:

1. **Inline-row editing — DataTable concern or page concern?**
   Two pages do it (Tenants, Units). If DataTable owns the pattern, every column factory needs an `editable` flag and an `onSave` hook. If pages own it, they can render a custom row component when in edit mode and DataTable stays narrower. Recommend: **page-level** — keep DataTable narrow, accept that 2 pages render a custom `editing` row outside the standard cells.

2. **Multi-view mode (table / card / summary) — DataTable concern or page concern?**
   Two pages do it (Tenants, Properties). The card and summary modes are entirely different layouts (grids of cards), not "the same data styled differently." Recommend: **page-level** — DataTable only renders the table view; the page renders cards/summary itself when the toggle is in those modes.

3. **Mobile card variant — should DataTable build it?**
   The spec calls it out as Phase 3. Today, no list page has a real mobile card layout — they horizontal-scroll. Building it is a clear win, but adds complexity to the DataTable API (mobile-priority hints per column, primary action picking). Recommend: **yes, build in Phase 3 as specced** — every page benefits and there is no existing implementation to compete with.

Also worth flagging up front:

- **Row-level styling.** Reservations tints each row by status (`displayStatusRowClass`); Invoices tints overdue / draft rows. Already in the spec via `rowVariant(row) => "urgent"|"inactive"|"pinned"|"default"` — keep that as-specced.
- **No selection today.** Adding selection + bulk actions is a real new capability, not a port. There is no existing UX precedent in the app to match. Be prepared to design from scratch when the first migrated page wants bulk actions (likely Expenses for bulk approve/reject — counts as a Phase 5+ deliverable).
- **`@tanstack/react-virtual` for virtual mode.** No virtual scrolling exists in the app today; spec calls for it in Phase 4. Greenfield, no compatibility constraints.

---

## Things to avoid surprising me later

- **No table primitives anywhere in `components/ui/`** — I am building from a clean slate.
- **`lib/format-currency.ts`, `lib/reservation-status.ts`, `lib/unit-status.ts`** already centralize display logic — DataTable cell renderers should call these, not re-implement.
- **Reservations summary endpoint** (`/api/reservations/summary`) and the 60-second auto-refresh — that lives at the page level, not in DataTable. DataTable just renders the rows it gets.
- **Tab-filter UI** is not DataTable's job. The spec's `FilterBar` is the right home for that.

---

## What this audit does *not* commit me to

- Migrating any existing page in this session (per the spec — "DO NOT in this session: migrate existing list pages").
- Building `FilterBar` (separate, comes later).
- Changing data fetchers or API endpoints.

All page migrations land in a follow-up phase, one page per commit, after the DataTable primitive ships.
