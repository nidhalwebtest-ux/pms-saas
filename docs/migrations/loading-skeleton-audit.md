# LoadingSkeleton migration — Phase 1 audit

Pre-build inventory of every loading state in the Salalah PMS codebase.
Scope: `app/`, `components/`. Conducted 2026-05-17.

This drives the migration plan for the new `components/ui/skeleton/`
design-system component (Phase 2 onward).

---

## TL;DR

| Category | Count | Status |
| --- | --- | --- |
| Reusable spinner components | **1** | `<Spinner>` — 8 importers, keep as-is for button + form indicators |
| Inline `ArrowPathIcon` + `animate-spin` widgets | **10** | One-off refresh / reload spinners; most are correct, a couple are first-load indicators that should become skeletons |
| Existing skeleton implementations | **3 systems** | DataTable internal skeleton, Next `loading.tsx` route shells (5 files), inline `animate-pulse` divs in 3 components |
| "Loading…" text-only labels | **7** | Mostly dashboard widgets + ModalBody |
| Client-fetching views with no skeleton path proven | **5** | Reservations, Tenants, Expenses, Invoices, Payments — they have DataTable skeleton support; need to verify it's actually showing on initial load |
| Surfaces that would benefit most | **3 areas** | Dashboard widgets (ManagerView, ReceptionistView), AvailabilityCalendar, TenantLedger |

**Headline:** The DataTable already has solid skeleton coverage (refactor target, not greenfield). The biggest "blank space" UX gaps are the dashboard widget views — multiple KPI tiles + charts hidden behind a single centered "Loading…" string.

---

## 1. Reusable loading components

### `<Spinner>` — [components/ui/Spinner.tsx](components/ui/Spinner.tsx)
SVG with `animate-spin`, default 14 px. **Keep as-is** — for button-internal loading, async form field suffixes, and small dialog focal points.

Importers (8):
- [Button.tsx](components/ui/Button.tsx) — `loading` prop
- [modal/ModalBody.tsx](components/ui/modal/ModalBody.tsx) — modal-level loading state
- [form/NumberField.tsx](components/ui/form/NumberField.tsx), [form/TextField.tsx](components/ui/form/TextField.tsx), [form/SearchableSelect.tsx](components/ui/form/SearchableSelect.tsx) — async field indicators
- [data-table/cells/ActionsCell.tsx](components/ui/data-table/cells/ActionsCell.tsx) — per-row action pending
- `components/ui/index.ts` — barrel

No other generic `Loader` / `Loading` component exists.

---

## 2. Inline `ArrowPathIcon` + `animate-spin` widgets

10 instances. Two patterns:

**Pattern A — refresh / reload buttons** (intentional, keep as-is):

| File | Line | Action |
| --- | --- | --- |
| [components/dashboard/AvailabilityCalendar.tsx](components/dashboard/AvailabilityCalendar.tsx#L384) | 384 | Refresh calendar |
| [app/dashboard/reservations/ReservationsView.tsx](app/dashboard/reservations/ReservationsView.tsx#L733) | 733 | Refresh list |
| [app/dashboard/expenses/ExpensesListClient.tsx](app/dashboard/expenses/ExpensesListClient.tsx#L344) | 344 | Refresh list |
| [app/dashboard/tenants/[id]/TenantLedger.tsx](app/dashboard/tenants/[id]/TenantLedger.tsx#L254) | 254 | Refresh ledger |
| [app/dashboard/settings/team/InvitationRow.tsx](app/dashboard/settings/team/InvitationRow.tsx#L94) | 94 | Resend invitation |
| [app/verify-email/VerifyEmailClient.tsx](app/verify-email/VerifyEmailClient.tsx#L119) | 119 | Verify email retry |

Each toggles `animate-spin` conditionally on `loading` / `isPending`. These are quick action-button-style indicators. **Skip** in the skeleton migration.

**Pattern B — initial-fetch loading** (migrate):

| File | Line | What's loading |
| --- | --- | --- |
| [app/dashboard/settings/expense-categories/ExpenseCategoryManager.tsx](app/dashboard/settings/expense-categories/ExpenseCategoryManager.tsx#L115) | 115 | First load of category list — centered spinner replaces the table |

That's the only first-load `ArrowPathIcon` spinner. Most other "first-load" indicators are text-only (§ 4) or use the DataTable skeleton (§ 3).

---

## 3. Existing skeleton implementations

### DataTable's internal skeleton
- [components/ui/data-table/parts/DataTableLoading.tsx](components/ui/data-table/parts/DataTableLoading.tsx) — `<DataTableLoading>` renders N skeleton rows (default 8), heuristic column widths, optional checkbox column, density-aware row height. Also exports `<DataTableRefetchBar>` — a thin pulsing progress bar for in-place refetches (sort / filter / pagination).
- **Migration target:** refactor to use the new `<TableSkeleton>` preset once Phase 3 builds it.

### Next.js `loading.tsx` route shells (5)
- [app/dashboard/loading.tsx](app/dashboard/loading.tsx)
- [app/dashboard/units/loading.tsx](app/dashboard/units/loading.tsx)
- [app/dashboard/units/[unitId]/loading.tsx](app/dashboard/units/[unitId]/loading.tsx)
- [app/dashboard/properties/loading.tsx](app/dashboard/properties/loading.tsx)
- [app/dashboard/properties/new/loading.tsx](app/dashboard/properties/new/loading.tsx)

Each is bespoke markup — divs with `animate-pulse` + `bg-gray-100` shapes. **Migration target:** replace with composed `<Skeleton>` primitives + presets.

### Inline `animate-pulse` divs
- [app/dashboard/tenants/[id]/TenantLedger.tsx](app/dashboard/tenants/[id]/TenantLedger.tsx) — lines 177, 200, 223, 258 — skeleton rows for invoice / payment / balance sections (mixed with text-only loading labels in the same file)
- [components/dashboard/CustomerPaymentForm.tsx:249](components/dashboard/CustomerPaymentForm.tsx#L249) — pulsing text while invoices load
- [app/dashboard/expenses/new/SubmitExpenseForm.tsx:228](app/dashboard/expenses/new/SubmitExpenseForm.tsx#L228) — skeleton cards for file uploads

---

## 4. "Loading…" text labels

| File | Pattern |
| --- | --- |
| [ModalBody.tsx:26](components/ui/modal/ModalBody.tsx#L26) | Hardcoded English `"Loading…"` next to Spinner |
| [components/dashboard/views/ManagerView.tsx:326](components/dashboard/views/ManagerView.tsx#L326) | `{t("loading")}` — centered, replaces entire dashboard |
| [components/dashboard/views/ReceptionistView.tsx:143](components/dashboard/views/ReceptionistView.tsx#L143) | `{t("loading")}` — same pattern |
| [ExpenseCategoryManager.tsx:116](app/dashboard/settings/expense-categories/ExpenseCategoryManager.tsx#L116) | `{t("loading")}` |
| [app/dashboard/loading.tsx:9](app/dashboard/loading.tsx#L9) | `{t("loading")}` |
| [AvailabilityCalendar.tsx:385](components/dashboard/AvailabilityCalendar.tsx#L385) | `tModal("loading")` |
| [ReservationDetail.tsx:1722](app/dashboard/reservations/[id]/ReservationDetail.tsx#L1722) | `{t("loading")}` |

The text-only "Loading…" patterns are the biggest perceived-performance hits — they replace the entire UI surface with a single string until the request resolves.

---

## 5. Pages / components with no first-paint skeleton

5 client-side list views fetch in `useEffect` and pass `loading` into DataTable. DataTable will render its built-in skeleton when `loading && data.length === 0`, **provided the page actually starts with `loading: true`**:

- [ReservationsView.tsx](app/dashboard/reservations/ReservationsView.tsx) — `loading` defaults to `true`, DataTable skeleton fires ✓
- [ExpensesListClient.tsx](app/dashboard/expenses/ExpensesListClient.tsx) — same ✓
- [InvoicesTable.tsx](app/dashboard/invoices/InvoicesTable.tsx) — server-rendered, no client loading
- [PaymentsTable.tsx](app/dashboard/payments/PaymentsTable.tsx) — server-rendered, no client loading
- [TenantsView.tsx](app/dashboard/tenants/TenantsView.tsx) — server-rendered with cached data

The list-page coverage is mostly fine. The DataTable skeleton fires on the two client-fetched ones; the rest hydrate from server-rendered data. **No new work required here** beyond the DataTable refactor in Phase 4.

---

## 6. Surfaces worth migrating

### Tier 1 — Dashboard widgets (highest perceived-perf win)
Both `ManagerView` and `ReceptionistView` blank everything until the API resolves, then dump 5+ KPI cards + charts + tables at once.

- [components/dashboard/views/ManagerView.tsx](components/dashboard/views/ManagerView.tsx) — KPIs, revenue chart, expense breakdown, aging, performance table, building comparison, occupancy trend
- [components/dashboard/views/ReceptionistView.tsx](components/dashboard/views/ReceptionistView.tsx) — unit counts, per-building occupancy, current guests, outstanding balances, draft invoices

**Recommended:** per-widget skeletons (`DashboardKPICardSkeleton`, `ChartSkeleton`).

### Tier 2 — Heavy detail surfaces
- [AvailabilityCalendar.tsx](components/dashboard/AvailabilityCalendar.tsx) — text-only "Loading…" while the grid loads. A unit-row skeleton (`CalendarSkeleton`) would match the final layout much better.
- [TenantLedger.tsx](app/dashboard/tenants/[id]/TenantLedger.tsx) — already has inline `animate-pulse` divs plus a "…" text label. Consolidate to structured skeletons.
- [ReservationDetail.tsx:1722](app/dashboard/reservations/[id]/ReservationDetail.tsx#L1722) — text-only "Loading…" on detail load.

### Tier 3 — Smaller wins
- [CustomerPaymentForm.tsx:249](components/dashboard/CustomerPaymentForm.tsx#L249) — invoice list pulse-text while loading. Could use a list-item skeleton.
- [SubmitExpenseForm.tsx:228](app/dashboard/expenses/new/SubmitExpenseForm.tsx#L228) — skeleton cards for file uploads (mostly fine).

### Already sufficient (do not migrate)
- `<Spinner>` users — Button loading, form field suffixes, ActionsCell pending state
- ModalBody's Spinner + "Loading…" inside dialogs
- Refresh button `animate-spin` toggles on lists / calendar

---

## 7. Recommended migration priority

1. **Build primitives + animation token** (Phase 2 — `<Skeleton>`, `<SkeletonText>`, `<SkeletonCircle>`, `<SkeletonRectangle>`, `<SkeletonCard>`)
2. **Build 12 presets** (Phase 3) — DashboardKPICardSkeleton + ChartSkeleton + TableSkeleton are highest priority.
3. **Refactor DataTable** to render `<TableSkeleton>` instead of the inline skeleton.
4. **Migrate dashboard views first** — ManagerView + ReceptionistView (biggest perceived-performance win).
5. **AvailabilityCalendar** — unit-row skeleton replaces text loading.
6. **TenantLedger sections** — consolidate the existing `animate-pulse` divs into proper skeletons.
7. **Page-level `loading.tsx` shells** — refactor the 5 existing files to use primitives instead of bespoke markup.

---

## 8. Surprises / risks

- **DataTableRefetchBar pattern** already exists for in-place refetches (sort/filter/page) — preserve when refactoring; that's a good UX pattern and the new skeleton system should keep something equivalent.
- **TenantLedger has 4 different loading patterns in one file** (skeleton rows, animate-pulse, "…" placeholders, text labels). Highest cleanup payoff per file.
- **No notification panel exists yet** — the spec mentions `NotificationItemSkeleton` as a preset, but there's nothing to migrate. Build the preset, defer page wiring.
- **Calendar skeleton is non-trivial** — `AvailabilityCalendar` is a grid of N units × M days. The preset shape needs careful design to match the real layout.
- **Form-edit pages have no loading skeleton** because they're server-rendered with pre-fetched data. This is correct — don't add skeletons there.

---

## Note on the design spec

The original Phase 1 prompt left the design-spec section as a placeholder
(`[PASTE THE LOADING SKELETON SPEC FROM CLAUDE DESIGN HERE]`). This audit
covers the inventory side regardless, but Phase 2 will need the actual spec
to nail down:

- Animation choice (pulse vs. shimmer — the brief mentions either)
- Token palette for the base color / highlight
- The 12 preset shapes — which fields, which proportions
- Reduced-motion fallback details

Will pause for the spec before starting Phase 2.
