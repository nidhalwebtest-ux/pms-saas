# Tabs + SegmentedControl migration — Phase 1 audit

Pre-build inventory of every tabbed-interface and segmented-control pattern
in the Salalah PMS codebase.
Scope: `app/`, `components/`. Conducted 2026-05-19.

This drives the migration plan for the new `components/ui/tabs/` (built on
@radix-ui/react-tabs) and `components/ui/segmented-control/` (custom)
primitives, plus the companion `useTabParam` URL-sync hook.

---

## TL;DR

| Category | Count | Notes |
| --- | --- | --- |
| Tab-strip surfaces in production | **3** | Tenant detail (Overview/Ledger), Dashboard view-switcher (Today/Receptionist/Manager), inside-FilterBar quick filters (already migrated, covered by FilterBar) |
| Quick-filter tab strips inside FilterBar | **2** | Reservations (10 tabs), Payments (4 tabs) — already use `FilterBarQuickFilters`, **not** Tabs targets |
| Segmented-control surfaces | **2** | Tenants list view-switcher (Table/Card/Summary), Properties list view-switcher (identical pattern) |
| Distinct tab visual styles | **3** | Underline, Pill, Segmented (boxed) |
| WAI-ARIA-compliant tab implementations today | **1** | Only `FilterBarQuickFilters` — every other surface is missing `role="tab"`, `aria-selected`, and keyboard nav |
| URL-synced tab state | **2 of 3** | Tenant detail (`?tab=`), Payments (via `useFilterParams`). Dashboard uses localStorage instead. |
| Lazy-mounted tab content | **3 of 3** | Conditional rendering everywhere — no eager-mount today |

**Headline:** the migration scope is **small and well-scoped**. Only **three
tabbed-interface surfaces** need to switch to the new `Tabs` component, and
**two near-identical view-switchers** need `SegmentedControl`. The big tab
strips on Reservations and Payments already run through `FilterBarQuickFilters`
which is itself WAI-ARIA compliant — they stay as-is. There are **no settings
tabs to migrate** (the audit didn't find any), **no Building/Reservation/
Invoice/Payment/Expense detail tabs**, and **no reports tabs**. Most "tab"
candidates from the spec don't actually exist as tabs yet — they're inline
sections.

---

## 1. Tab-strip surfaces

### Tenant detail — Overview / Ledger
[app/dashboard/tenants/\[id\]/page.tsx:240-264](app/dashboard/tenants/[id]/page.tsx#L240-L264)

- **Tabs (2):** Overview, Ledger
- **Style:** Underline (`border-b-2`, `text-blue-600` active)
- **State:** URL query param `?tab=overview` / `?tab=ledger` (server-read via `searchParams`)
- **Implementation:** Two `<Link>` elements with conditional `className`. No `role="tab"`, no `aria-selected`, no keyboard navigation.
- **Content:** Lazy — `{tab === "ledger" && <TenantLedger … />}` conditional render
- **Counts / icons:** Neither
- **Migration target:** `<Tabs variant="underline" size="md">` with `useTabParam("tab", "overview")` for URL sync.

### Dashboard view-switcher — Today / Receptionist / Manager
[components/dashboard/DashboardShell.tsx:94-111](components/dashboard/DashboardShell.tsx#L94-L111)

- **Tabs (3):** Today, Receptionist, Manager — role-gated based on user
- **Style:** Pill (`rounded-xl bg-gray-100 p-1` track; `rounded-lg bg-white shadow-sm` active)
- **State:** `useState` + `localStorage` persistence, no URL sync
- **Implementation:** `<nav aria-label="…">` wrapping plain `<button>`s with `transition-all`. No `role="tab"`, no `aria-selected`, no keyboard nav.
- **Content:** Lazy — three conditional `{activeTab === "x" && <XView />}` blocks below
- **Counts / icons:** Neither
- **Migration target:** Per the spec — `<SegmentedControl size="lg" variant="brand">` is the right pick. The spec explicitly calls this out as the **edge case** where labels are long-ish but the choice changes *view density* rather than navigating to a section.

### `FilterBarQuickFilters` — already-built design-system tab strip
[components/ui/filter-bar/FilterBarQuickFilters.tsx:59-183](components/ui/filter-bar/FilterBarQuickFilters.tsx#L59-L183)

- **Variants exposed:** `underline` (default) + `pill`
- **State:** Controlled by the parent `FilterBar` (which delegates to caller state, often URL via `useFilterParams`)
- **Accessibility:** Full WAI-ARIA tabs pattern — `role="tablist"`, `role="tab"`, `aria-selected`, roving `tabindex`, arrow / Home / End key handling, `focus-visible:shadow-focus`
- **Counts:** First-class via the `count` prop, with five tonal variants (default, active, destructive, warning, success) and the `"high"` 500+ truncation pill
- **Used by:** Reservations list (10 tabs), Payments list (4 tabs), all five other FilterBar consumers (Tenants/Properties/Units/Expenses/Invoices for status tabs)

**Decision needed in Phase 5:** do we leave `FilterBarQuickFilters` alone, or refactor it to consume the new `<Tabs>` internals? Recommendation in §4.

---

## 2. Segmented-control surfaces

Two near-identical view-mode switchers:

### Tenants list view-switcher
[app/dashboard/tenants/TenantsView.tsx:510-523](app/dashboard/tenants/TenantsView.tsx#L510-L523)

- **Segments (3):** Table, Card, Summary — icon-only with `title` tooltip
- **Style:** Boxed/segmented (`flex rounded-lg border border-gray-200 overflow-hidden`)
- **Active treatment:** `bg-gray-900 text-white` — high-contrast, not brand-tinted
- **State:** `useState<"table" | "card" | "summary">("table")`, no URL sync
- **Icons:** Heroicons `ListBulletIcon`, `Squares2X2Icon`, `RectangleGroupIcon`
- **Accessibility:** **Gap** — no `role="radiogroup"`, no `role="radio"`, no `aria-checked`, no keyboard nav. The `title` attribute is the only accessible name.
- **Migration target:** `<SegmentedControl size="sm" variant="default">` with icons + `ariaLabel`. Per-segment `ariaLabel` required since the controls are icon-only.

### Properties list view-switcher
[app/dashboard/properties/PropertiesView.tsx:500-528](app/dashboard/properties/PropertiesView.tsx#L500-L528)

Visually and behaviourally identical to Tenants. Same 3 modes, same Heroicons, same `bg-gray-900` active treatment, same `useState` (no URL sync), same accessibility gaps.

**Migration target:** Same `<SegmentedControl>` config as Tenants. Worth extracting a shared `ViewModeSwitcher` wrapper if a third list adopts the pattern, but two is below the abstraction threshold.

---

## 3. Surfaces the spec mentioned but that don't exist today

The spec implies tabs on a lot of pages. The audit could not find them. Either they're aspirational or live behind a feature flag we don't have access to.

| Spec'd surface | Status today |
| --- | --- |
| Building / Property detail tabs | **Not present.** PropertiesView is a list, not a detail page; `[id]` detail page is a single scroll. |
| Reservation detail tabs | **Not present.** `ReservationDetail.tsx` uses collapsible sections + a single `<Modal>` per action. |
| Unit detail tabs | **Not present.** |
| Invoice / Payment / Expense detail tabs | **Not present.** |
| Settings page tabs (sidebar) | **Not present.** Settings is structured as separate routes (`/settings/profile`, `/settings/organization`, `/settings/team`, etc.) — each is its own page. No `<Tabs orientation="vertical">` setup. |
| Reports page tabs | **Not present.** No reports page yet. |
| Time-range segmented control (Today / Week / Month / Year) | **Migrated already** — the Payments period filter became part of `FilterBar` quick tabs in Phase 3 of the FilterBar migration. No standalone segmented control exists. |
| List view toggle (List / Cards / Calendar / Map) | **Two of three** — Tenants + Properties have Table/Card/Summary (above). No Map view anywhere. No reservations calendar view in this codebase (only the availability calendar, which is a different surface). |

This is good news for scope: Phase 5 is **3 migrations**, not 10+.

---

## 4. Cross-cutting findings

### State management — three patterns

| Pattern | Surfaces |
| --- | --- |
| URL params | Tenant detail (server-read), Payments (via `useFilterParams`) |
| localStorage + `useState` | Dashboard view-switcher (persists role-aware default) |
| Local `useState` | Reservations tab strip (`activeTab`), view-switchers |

The new `Tabs` component should support all three via the existing controlled
API (`value` + `onValueChange`). The `useTabParam` hook covers the URL case;
localStorage and plain `useState` are caller's call.

### Accessibility gaps

| Surface | Missing |
| --- | --- |
| Tenant detail | `role="tab"`, `aria-selected`, keyboard nav (uses `<Link>` so arrow-key nav doesn't apply, but Tab works) |
| Dashboard view-switcher | `role="tab"`, `aria-selected`, keyboard nav |
| Tenants / Properties view-switchers | `role="radiogroup"`, `role="radio"`, `aria-checked`, keyboard nav. Icon-only → no accessible name beyond `title` |

Migrating to Radix Tabs (for tab strips) and our custom SegmentedControl (with
roving tabindex + radio semantics) closes all of these.

### Visual inconsistencies

| Dimension | Variations seen |
| --- | --- |
| Active tab color | `text-blue-600` (Tenant detail), `text-gray-900 bg-white shadow-sm` (Dashboard pill), `bg-gray-900 text-white` (view-switchers) |
| Border-radius | `rounded-lg` (view-switchers), `rounded-xl` track + `rounded-lg` pill (Dashboard) |
| Typography | `text-sm` (Tenant), `text-sm` (Dashboard pill), `text-xs` (view-switchers), `text-[13px]` (FilterBarQuickFilters) |
| Active indicator | `border-bottom 2px brand-500` (Tenant + FilterBar underline), `bg + shadow-sm` (Dashboard + FilterBar pill), `bg-gray-900 + text-white` (view-switchers) |

The new components standardise on:
- **Tabs:** brand-tinted underline / pill, `text-[13px]` at `md` size
- **SegmentedControl:** white-on-gray sliding pill at the `default` variant, `bg-brand-500 text-white` at `brand` variant (Dashboard's choice)

### Animation patterns

| Surface | Today |
| --- | --- |
| Tenant detail | Color transition only |
| Dashboard view-switcher | `transition-all` (subtle, no sliding indicator) |
| FilterBarQuickFilters | Instant — no transition |
| View-switchers | Color swap — no sliding pill |

**None of the current implementations have a sliding indicator.** This is a
net-new behaviour the new components will introduce per spec §10.

### Lazy mount vs eager mount

All three tab-content surfaces use **lazy mount** today via conditional
rendering. The new `<TabsContent>` will inherit Radix's default (eager mount
with `hidden` attribute on inactive panels) — which is **the opposite of
today's behaviour**. The migration should preserve lazy mount where it
matters:

- **Tenant Ledger panel** — currently lazy; mounting it pre-emptively would trigger an API fetch for ledger data on every Overview view. The `<TabsContent>` for the ledger should either keep the conditional render outside, or we forward Radix's `forceMount` + custom unmount-when-inactive logic.
- **Dashboard role views** — eager mount three role-specific views simultaneously is wasteful. Same fix: keep the conditional render, use the new `<SegmentedControl>` purely for the switching UI.

This is the most important behavioural caveat to flag for Phase 5.

---

## 5. Recommended migration priority

### Phase 2 — Install dependency
`@radix-ui/react-tabs` (one package, no peer-dep churn expected).

### Phase 3 — Build `<Tabs>` system
- `Tabs.tsx`, `TabsList.tsx`, `TabsTrigger.tsx`, `TabsContent.tsx`, `types.ts`, `index.ts`
- All three variants (`underline`, `pill`, `boxed`)
- All three sizes (`sm`, `md`, `lg`)
- Horizontal + vertical orientation
- Icon / count / notification dot trigger features
- Sliding indicator via the spec's `useIndicator` measurement pattern
- `hooks/useTabParam.ts` URL-sync helper

### Phase 4 — Build `<SegmentedControl>`
- `SegmentedControl.tsx`, `types.ts`, `index.ts`
- Three sizes (`sm`, `md`, `lg`)
- Three variants (`default`, `brand`, `ghost`)
- Sliding pill animation
- `radiogroup` + roving tabindex
- Icons + labels, icons-only, labels-only compositions

### Phase 5 — Migrate (3 surfaces total)
1. **Dashboard view-switcher → `<SegmentedControl size="lg" variant="brand">`** — most visible surface, spec's headline example. **Keep the conditional render of role-views in the parent**; SegmentedControl only owns the switching UI.
2. **Tenant detail → `<Tabs variant="underline" size="md">`** with `useTabParam("tab", "overview")`. **Keep the lazy mount** of `<TenantLedger>` by leaving the conditional `{tab === "ledger" && …}` block; use Radix `forceMount={false}` (its default) and `mounted={tab === "ledger"}`-style wrapping on the content.
3. **Tenants + Properties view-switchers → `<SegmentedControl size="sm" variant="default">`** — two near-identical migrations done together. Icons + `ariaLabel`.

**Out of scope for Phase 5:**
- `FilterBarQuickFilters` — it's already WAI-ARIA compliant, has count badges, and is consumed by 5+ pages. Refactoring it to use `<Tabs>` internals would touch every list page and produce no user-facing change. **Recommendation:** leave it. Document the parallel pattern in Phase 6 docs (Tabs for navigation, FilterBarQuickFilters for filtering).
- All the spec'd-but-non-existent surfaces (Building detail, Reservation detail tabs, Settings sidebar, Reports).

### Phase 6 — Docs
`docs/design-system/tabs-and-segmented-control.md` — variants, sizes, URL sync, lazy-mount caveat, RTL, accessibility, the Tabs-vs-SegmentedControl-vs-FilterBarQuickFilters decision matrix.

---

## 6. Surprises & risks

- **Most spec'd surfaces don't exist.** Building / Reservation / Unit detail tabs, the settings sidebar, reports tabs, calendar/map view modes — none of these are in the codebase. Either they're future work or the spec was generic. Either way the migration is much smaller than the spec implies. Worth confirming with the user before Phase 3 that the smaller scope is OK.
- **`FilterBarQuickFilters` is the parallel implementation.** It already does what Radix Tabs would do — ARIA tabs pattern, count badges, keyboard nav. Two valid choices:
  1. Leave it as-is (recommended). Document the distinction in Phase 6.
  2. Refactor it to use `<Tabs>` internals. Pros: one ARIA implementation. Cons: touches every list page, risk of regression, no user-facing benefit. **Reject unless there's a strong push.**
- **Lazy-mount behaviour will subtly change** if we adopt Radix's default eager-mount. The Tenant ledger and Dashboard role-views must keep their conditional renders or be wrapped in a "mount-on-activate" pattern. Worth a paragraph in the docs.
- **Dashboard's localStorage persistence** needs to be preserved when migrating to SegmentedControl. The component itself is stateless — the parent handles the localStorage read/write. Easy, but worth flagging so it doesn't get accidentally dropped during the migration.
- **No URL sync today on the view-switchers.** Migrating to `<SegmentedControl>` doesn't add URL sync (the spec doesn't recommend it for view modes anyway), but a follow-up could wire `?view=card` if shareable views become valuable.
- **Settings page is not tabbed today** — it's separate routes (`/settings/profile`, etc.). The spec hints at a tabbed settings sidebar. That's a redesign, not a migration; out of scope here.
- **The view-switchers use `bg-gray-900` for active** — high-contrast, not brand-tinted. The new SegmentedControl `default` variant uses white-on-gray. The migration will change the visual: active segment will be lighter / less aggressive. Confirm with the user this is desired (it matches the spec).
