# Today's Dashboard migration — Phase 1 audit

Pre-migration inventory of the dashboard's "Today" view — the page users see
on login and the one slated for sales demos during Khareef season.
Scope: [components/dashboard/views/TodayView.tsx](../../components/dashboard/views/TodayView.tsx) (510 lines).
Conducted 2026-05-19.

The parent shell ([DashboardShell.tsx](../../components/dashboard/DashboardShell.tsx))
was migrated to `SegmentedControl` in the Tabs/SegmentedControl pass and is
**out of scope** for this migration. `ReceptionistView` and `ManagerView` are
separate migration targets later.

> **Design spec status:** the brief referenced `docs/design-specs/today-dashboard.md`
> or `.html`. Neither exists in the repo today. The audit assumes the
> migration is "production polish via the design system primitives" rather
> than "rebuild to match a specific comp." If a spec lands later, Phase 8
> (final review) will need a comp-comparison pass.

---

## TL;DR

| Category | Count |
| --- | --- |
| Hand-rolled `<button>` / `<a>` instances → `<Button>` | **5** |
| Inline status / count badges → `<Badge>` | **~7** |
| Custom card wrappers (`bg-white shadow-sm ring-1 ring-gray-900/5`) → design tokens | **3** |
| Custom empty-state blocks → `<EmptyState>` | **2** |
| Inline error banner → `<Alert>` | **1** |
| Plain "Loading…" placeholder → `<SkeletonCard>` composition | **1** |
| Local sub-components (`StatCard`, `GuestRow`, `SectionCard`) — not in DS today | **3** |
| Confirmed minor bug (redundant ternary at L322) — to flag, **not** fix | **1** |

**Headline:** The migration is well-scoped — every inline pattern maps cleanly
to an existing DS primitive. The interesting decisions are around the three
local sub-components: should `StatCard` / `GuestRow` / `SectionCard` graduate
to the design system, or stay as page-local? Recommendation in §6.

---

## 1. Component structure

Top-to-bottom inside [TodayView.tsx](../../components/dashboard/views/TodayView.tsx):

| Section | Lines | Visual |
| --- | --- | --- |
| Stat-card row | [L275–307](../../components/dashboard/views/TodayView.tsx#L275-L307) | 4-column grid (2 col mobile). Arrivals, Departures, Overstays (pulse), In-House — each a gradient-tinted tile with icon + count |
| Arrivals + Departures + Overstays | [L310–353](../../components/dashboard/views/TodayView.tsx#L310-L353) | 2-column grid (1 col mobile). Left: combined arrivals list. Right: departures list, then conditional overstays list |
| Financial summary | [L358–437](../../components/dashboard/views/TodayView.tsx#L358-L437) | Payments by method (CASH / CARD / BANK_TRANSFER / CHEQUE / OTHER) + expense totals, two quick-action buttons |
| Activity feed | [L440–507](../../components/dashboard/views/TodayView.tsx#L440-L507) | Scrollable list of recent actions with per-action coloured chips |

### Local sub-components

| Name | Lines | Purpose | Reused elsewhere? |
| --- | --- | --- | --- |
| `StatCard` | [L76–106](../../components/dashboard/views/TodayView.tsx#L76-L106) | Gradient-tinted KPI tile with icon + value + optional pulse | **No** — local |
| `GuestRow` | [L108–185](../../components/dashboard/views/TodayView.tsx#L108-L185) | Reservation list row: name, VIP/overdue/overstay badges, contact meta, balance, action buttons | **No** — local (a `GuestRow` type exists in `ReceptionistView.tsx:28` but is unrelated) |
| `SectionCard` | [L187–217](../../components/dashboard/views/TodayView.tsx#L187-L217) | Section wrapper: coloured dot + title + count chip header, divided list body, empty-state fallback | **No** — local |

There are matching `StatCard` components in [app/dashboard/settings/team/page.tsx:17](../../app/dashboard/settings/team/page.tsx#L17) but they are visually unrelated (text-only counts) — no shared abstraction available.

---

## 2. Inline patterns to migrate

### A. Hand-rolled buttons / links (5)

| Line | Current | Maps to |
| --- | --- | --- |
| [L169–172](../../components/dashboard/views/TodayView.tsx#L169-L172) | Green "Collect" link in `GuestRow` — `bg-green-600 px-2.5 py-1 text-xs font-semibold text-white` | `<Button variant="primary" size="sm">` wrapped in `<Link>` |
| [L174–179](../../components/dashboard/views/TodayView.tsx#L174-L179) | Gray "View" link in `GuestRow` — `bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700` | `<Button variant="secondary" size="sm">` wrapped in `<Link>` |
| [L420–426](../../components/dashboard/views/TodayView.tsx#L420-L426) | Green "Record Payment" CTA — `bg-green-50 px-3 py-2 text-xs font-semibold text-green-700` | `<Button variant="secondary" size="sm">` (or a custom CTA card if the spec calls for it) |
| [L427–433](../../components/dashboard/views/TodayView.tsx#L427-L433) | Gray "Log Expense" CTA — `bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600` | `<Button variant="secondary" size="sm">` |
| [L448–454](../../components/dashboard/views/TodayView.tsx#L448-L454) | "View all reservations" text link — `text-blue-600 hover:text-blue-800` | `<Button variant="link" size="sm">` |

### B. Inline status / count badges (~7)

| Line | Represents | Maps to |
| --- | --- | --- |
| [L132–135](../../components/dashboard/views/TodayView.tsx#L132-L135) | VIP tenant chip — `bg-amber-100 text-amber-700` | `<Badge {...getTenantClassBadge("vip")}>` |
| [L137–140](../../components/dashboard/views/TodayView.tsx#L137-L140) | "Overdue by N days" badge — `bg-red-100 text-red-700` | `<Badge tone="destructive" appearance="solid">` with leading dot |
| [L142–145](../../components/dashboard/views/TodayView.tsx#L142-L145) | Overstay days badge — `bg-red-200 text-red-800` | `<Badge tone="destructive" appearance="solid">` |
| [L201–205](../../components/dashboard/views/TodayView.tsx#L201-L205) | Section header count chip — `bg-gray-100 text-gray-600` or `bg-gray-50 text-gray-400` | `<Badge tone="neutral" size="sm">` |
| [L469–475](../../components/dashboard/views/TodayView.tsx#L469-L475) | Activity action chip (e.g. CHECKED_IN, CANCELLED) — driven by `ACTION_COLORS` map | `<Badge tone="…" size="sm">` with tone derived per action |

The `ACTION_COLORS` map at [L63–70](../../components/dashboard/views/TodayView.tsx#L63-L70) maps action IDs to Tailwind class pairs. The migration should replace this with a small `actionTone(action)` helper returning a `BadgeTone` so the inline class lookup goes away.

### C. Card wrappers (3)

All three use the same pre-design-system class soup (`bg-white shadow-sm ring-1 ring-gray-900/5`):

| Line | Section |
| --- | --- |
| [L197](../../components/dashboard/views/TodayView.tsx#L197) | `SectionCard` wrapper |
| [L358](../../components/dashboard/views/TodayView.tsx#L358) | Financial summary card |
| [L440](../../components/dashboard/views/TodayView.tsx#L440) | Activity feed card |

Replace with `bg-surface border border-border-subtle` (the design-system surface treatment used by Alert / EmptyState / FilterBar). Drop `ring-1 ring-gray-900/5` in favour of a single border.

### D. Loading state (1)

[L257–262](../../components/dashboard/views/TodayView.tsx#L257-L262): centred text "Loading data…" with no skeleton.

Should compose `<SkeletonCard>` + `<SkeletonLine>` to match the real layout (4 stat tiles, two lists, two summary cards) so the dashboard never collapses to a single spinner on first paint.

### E. Empty states (2)

| Line | Today | Maps to |
| --- | --- | --- |
| [L207–211](../../components/dashboard/views/TodayView.tsx#L207-L211) | `SectionCard` empty body — `CheckCircleIcon` + text | `<EmptyState size="sm" variant="positive">` (positive because "no arrivals / no checkouts" is *good news* for the rare empty cases) |
| [L457–461](../../components/dashboard/views/TodayView.tsx#L457-L461) | Activity feed empty — `UserGroupIcon` + text | `<EmptyState size="sm" variant="encouraging">` |

### F. Error banner (1)

[L263–268](../../components/dashboard/views/TodayView.tsx#L263-L268): `bg-red-50 text-red-600` block with the failure message.

Replace with `<Alert variant="error" description={error}>` and an optional retry action (`actions={[<Button onClick={fetchData}>…retry…</Button>]}`).

### G. Status indicator text (low priority)

[L161–163](../../components/dashboard/views/TodayView.tsx#L161-L163): balance display switches between `text-red-600` (owing) and `text-green-600` (paid). The DS has no "status text" primitive; leave as inline conditional or wrap in a small `<Badge>` if the visual upgrade is wanted.

---

## 3. Business logic to preserve

**Do not touch any of this.**

- **Data fetch:** `/api/dashboard/today?propertyId=…` at [L237–249](../../components/dashboard/views/TodayView.tsx#L237-L249). Returns `TodayData` shape with `arrivals`, `departures`, `overstays`, `inHouseCount`, `payments`, `expenses`, `activity` fields.
- **Polling:** 5-minute `setInterval` at [L251–255](../../components/dashboard/views/TodayView.tsx#L251-L255). No WebSocket / Supabase realtime subscription.
- **State:** local `useState` for `data` / `loading` / `error` at [L233–235](../../components/dashboard/views/TodayView.tsx#L233-L235). No context, no global store.
- **Translations:** seven `useTranslations` namespaces — `dashboard.today` + `.stats` + `.sections` + `.financial` + `.methods` + `.activity` + `.activity.labels`. Plus `dashboard.today.guest` inside `GuestRow`.
- **Currency:** `useFormatCurrency()` hook — preserves OMR 3-decimal precision per the project rules.
- **Date logic:** `date-fns` `format`, `formatDistanceToNow`, `parseISO` with locale-aware formatting (Arabic / English).
- **Overdue / overstay math:** local-midnight comparison at [L111–117](../../components/dashboard/views/TodayView.tsx#L111-L117). Keep verbatim.
- **Navigation links:**
  - "Collect" → `/dashboard/payments/new?reservationId=<id>` [L168](../../components/dashboard/views/TodayView.tsx#L168)
  - "View" → `/dashboard/reservations/<id>` [L175](../../components/dashboard/views/TodayView.tsx#L175)
  - "View all reservations" → `/dashboard/reservations` [L449](../../components/dashboard/views/TodayView.tsx#L449)
  - "Record Payment" → `/dashboard/payments/new` [L421](../../components/dashboard/views/TodayView.tsx#L421)
  - "Log Expense" → `/dashboard/expenses/new` [L428](../../components/dashboard/views/TodayView.tsx#L428)
  - Activity item link → `/dashboard/reservations/<id>` [L494](../../components/dashboard/views/TodayView.tsx#L494)
- **No side effects:** no `toast()`, no `router.push`, no `confirm()`, no `console.*`. The page is read-only except for navigation.

---

## 4. Gaps & risks

### Missing primitives the DS doesn't have

- **KPI tile / StatCard:** the gradient-tinted `bg-{blue,orange,red,green}-500` `StatCard` with white text on coloured fill is a pattern that may recur across ManagerView / ReceptionistView and on future dashboards. Worth considering as a DS component (`<StatCard tone="…" icon={…} label={…} value={…} pulse />`). **Recommendation:** leave it as a TodayView-local sub-component for this migration, surface as a follow-up if reused.
- **Reservation list row / GuestRow:** the row layout with name + VIP/overdue/overstay badges + meta + balance + actions is exactly the kind of pattern that should be a DS component. Two related views (ReceptionistView, ManagerView) likely repeat the shape. **Recommendation:** keep TodayView's row local for this migration; revisit when migrating Receptionist/Manager.
- **SectionCard:** card-with-status-dot-header pattern. Single use today. Keep local.
- **Colored status text** (balance owing / paid): not in DS. Inline conditional stays.

### Confirmed bugs to **flag but not fix**

- **L322 redundant ternary** — both branches return `"arrival"`:

  ```tsx
  type={new Date(res.startDate) < new Date(new Date().setHours(0,0,0,0)) ? "arrival" : "arrival"}
  ```

  The `isOverdue` check already happens inside `GuestRow` itself (L111), so this is dead code. The `GuestRow` `type` prop accepts `"arrival" | "departure" | "overstay"` but never receives an overdue-specific value — the styling is computed internally. **Flag for cleanup; out of scope here.**

- **`ACTION_COLORS` silent fallback** at [L471](../../components/dashboard/views/TodayView.tsx#L471): unknown action types fall back to `bg-gray-100 text-gray-500` silently. Works but no warning. **Flag, don't fix.**

- **Empty-state icon mismatch:** `SectionCard` always shows `CheckCircleIcon` for empty, which reads as "all clear / well done." Fine for "no overstays today" (good news) but misleading for "no arrivals today" (could go either way). **Flag for design discussion; the migration will replace this with `<EmptyState>` so the variant choice can be section-specific.**

### Polling + skeleton interaction

The 5-minute polling fetch sets `loading = false` after the first response — subsequent polls update silently. **Important:** the new skeleton must only appear on the *first* load. Subsequent silent refreshes shouldn't replace the rendered content with skeletons. The existing `loading` flag is set once and never re-set after data lands, so this already works — preserve that contract.

### Animation: the overstay pulse

`StatCard` renders a `<span class="animate-ping">` overlay at the top-right when `pulse && value > 0`. This is a custom Tailwind animation; the DS doesn't ship it. **Recommendation:** keep verbatim. If a future DS `StatCard` ships, it should accept a `pulse` prop.

---

## 5. Visible deltas the user should expect post-migration

QA should anticipate these visual changes:

1. **Section card surfaces** lose their soft `ring-1 ring-gray-900/5` ring; they pick up a flat `border border-border-subtle` instead — slightly crisper, matches Alert/EmptyState/FilterBar.
2. **Activity action chips** move from a custom 6-entry colour table to the standard Badge tones — minor colour shifts on chips like `PAYMENT_RECORDED` (emerald-100 → success-50).
3. **Buttons** pick up the standard focus rings, hover treatment, and (for the "Collect" CTA) the design-system primary-button shadow. The visual is close but not identical to the current `bg-green-600` button.
4. **Empty states** now show illustration tiles + structured text rather than a single icon + line — much more presentable for demo screenshots.
5. **Error banner** picks up `role="alert"` + `aria-live="assertive"` — screen readers will announce load failures.
6. **Loading skeleton** replaces "Loading data…" text with a 4-tile + 2-list + 2-card layout that matches the real composition.

The `StatCard` gradient tiles, `GuestRow` layout, and section structure are **unchanged** by this migration.

---

## 6. Recommended migration priority

### Phase 2 — Structural pass (one commit)

Migrate the three card wrappers to design tokens (`bg-surface border border-border-subtle`). Drop the `ring` classes. No new components yet.

### Phase 3 — Section-by-section (six commits per the spec)

1. **Action cards row** — keep `StatCard` local; only swap any inline buttons / badges inside.
2. **Arrivals + Departures + Overstays sections** — `SectionCard` empty state → `<EmptyState>`; `GuestRow` VIP / overdue / overstay badges → `<Badge>`; Collect / View buttons → `<Button>`.
3. **Financial Summary** — Record Payment / Log Expense → `<Button variant="secondary">`. Surface tokens already done in Phase 2.
4. **Activity Feed** — action chips → `<Badge>` via an `actionTone()` helper. "View all" link → `<Button variant="link">`. Empty state → `<EmptyState>`.
5. **Error banner** → `<Alert variant="error">` with retry action.
6. **Loading skeleton** → `<SkeletonCard>` composition matching the real grid.

Each section commits cleanly with no functionality change.

### Phase 4 — States pass

Verify loading / empty / error / success for each section. Mostly already covered by Phase 3 work; this is a verification pass + any gaps.

### Phase 5 — Responsive

Smoke-test desktop (1440), tablet (768–1023), mobile (375). Current grid uses `lg:` breakpoints. The migration should not alter responsive behaviour but the verification is non-negotiable for demo-grade polish.

### Phase 6 — RTL

Already mostly correct (the file uses logical Tailwind utilities in some places; the `text-` and grid classes are direction-agnostic). Verify Arabic locale render with overdue badges, dates, and numbers.

### Phase 7 — Performance

Single fetch + 5-min interval. No streaming, no virtualisation. Skeleton-on-first-load only. Should already be performant; verify after Phase 3.

### Phase 8 — Final review

Comp against the design spec **if one is provided**. Otherwise this is a visual sanity check before sign-off.

---

## 7. Estimated effort

| Phase | Effort |
| --- | --- |
| 2 — Structural | 15 min (3 surface swaps) |
| 3.1–3.6 — Per-section migrations | ~2 hours (6 sections, careful diff per section) |
| 4 — States | 30 min |
| 5 — Responsive | 30 min QA pass |
| 6 — RTL | 20 min QA pass |
| 7 — Performance | 15 min spot-check |
| 8 — Final review | 30 min (longer if a spec exists to compare against) |

**Total:** ~4 hours of focused work for a careful, commit-per-section migration. The dashboard is well-bounded — no surprises in the audit. Demo-readiness is achievable.
