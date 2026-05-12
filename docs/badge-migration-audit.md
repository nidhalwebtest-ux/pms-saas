# Badge migration audit

Phase 1 of the Badge consolidation. Inventory of every badge-shaped
implementation in the codebase before the `<Badge>` primitive lands.

Scope: `app/`, `components/`, `lib/`. Date: 2026-05-12.

---

## 1. Headline numbers

| Metric | Value |
| --- | --- |
| Distinct badge implementations | **16** (functions, constants, helpers) |
| Files that render badge-shaped UI | 12 |
| Business domains covered | 7 (reservation, invoice, unit, tenant, expense, payment-method, property-type) |
| Centralized helpers that already exist | 2 (`lib/reservation-status.ts`, `lib/unit-status.ts`) |
| Color drift incidents (same status, different colors across files) | 6 |
| Statuses present in code but **not** in the new spec | 5 (property type, plus 4 fringe invoice statuses) |

---

## 2. Inventory — per implementation

### 2.1 Reservation status (3 implementations)

#### `lib/reservation-status.ts` — `getDisplayStatus()` + `DisplayStatusInfo.badgeClass`  ✅ canonical

- **Lines:** [lib/reservation-status.ts:62-171](lib/reservation-status.ts#L62)
- **Business case:** Display status (9 values) computed from stored status + dates.
- **Variants supported:** Upcoming, Arriving Today, Overdue Arrival, In House, Due Checkout, Overstay, Checked Out, Cancelled, No Show, Pending (fallthrough → "Upcoming"/"Arriving Today"/"Overdue Arrival" depending on date).
- **Returns:** `{ label, badgeClass, rowClass, priority, urgent, pulse }`.
- **Used by:** `app/dashboard/reservations/ReservationsView.tsx`, `app/dashboard/reservations/[id]/ReservationDetail.tsx`, `app/dashboard/dashboard/...` (Today/Receptionist/Manager views), `lib/reservation-engine.ts` callers.
- **Color mapping:**
  - `Cancelled` → `bg-gray-100 text-gray-500`
  - `No Show` → `bg-gray-700 text-white`
  - `Checked Out` → `bg-blue-100 text-blue-700`
  - `Upcoming` → `bg-sky-100 text-sky-700`
  - `Arriving Today` → `bg-orange-500 text-white`
  - `Overdue Arrival` → `bg-red-600 text-white`
  - `In House` → `bg-green-500 text-white`
  - `Due Checkout` → `bg-orange-500 text-white`
  - `Overstay` → `bg-red-600 text-white` + `pulse: true`
- **Unique behavior:** `pulse` flag for Overstay drives `animate-pulse` on the badge.

#### `app/dashboard/reservations/[id]/ReservationDetail.tsx::StatusBadge`  — wraps the canonical

- **Line:** [app/dashboard/reservations/[id]/ReservationDetail.tsx:237](app/dashboard/reservations/[id]/ReservationDetail.tsx#L237)
- Takes `{ label, badgeClass, pulse }` — accepts the canonical helper's output. Renders `<span className="rounded-md px-2.5 py-1 text-sm font-semibold ...">`. **Not a duplicate logic**, just a different visual shape (`rounded-md` instead of pill, `text-sm` instead of `text-xs`).
- **Used only in:** ReservationDetail (1 call site).

#### Inline render in `app/dashboard/reservations/ReservationsView.tsx`

- Around row 1090+ (table rows), spreads `displayStatusBadgeClass` from `getDisplayStatus()` into a `<span>`. Shape: `rounded-md px-2 py-0.5 text-xs font-semibold`. Drift from the detail-page shape above (`rounded-md px-2.5 py-1 text-sm`). Same color, two different sizes.

**Migration note:** The canonical helper is good — just retarget it to return the new spec's tone/appearance instead of raw Tailwind classes.

---

### 2.2 Invoice status (3 implementations + 1 shadow)

#### `app/dashboard/invoices/page.tsx::StatusBadge`

- **Line:** [app/dashboard/invoices/page.tsx:50](app/dashboard/invoices/page.tsx#L50)
- **Statuses:** DRAFT, ISSUED, PENDING, PARTIALLY_PAID, PAID, CANCELLED, **overdue** (derived from due-date check).
- **Shape:** `inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset`
- **Colors:**
  - DRAFT → `bg-amber-50 text-amber-700 ring-amber-500/20`
  - ISSUED/PENDING → `bg-blue-100 text-blue-700 ring-blue-700/20`
  - PARTIALLY_PAID → `bg-amber-100 text-amber-700 ring-amber-600/20`
  - PAID → `bg-green-100 text-green-700 ring-green-600/20`
  - CANCELLED → `bg-gray-100 text-gray-500 ring-gray-400/20`
  - Overdue → `bg-red-100 text-red-700 ring-red-600/20`

#### `app/dashboard/invoices/[id]/page.tsx::StatusBadge` — **DRIFTED DUPLICATE**

- **Line:** [app/dashboard/invoices/[id]/page.tsx:33](app/dashboard/invoices/[id]/page.tsx#L33)
- **Shape:** `rounded-full px-3 py-1 text-sm font-semibold` (bigger than list view)
- **Statuses:** DRAFT, ISSUED, PARTIALLY_PAID, PAID, CANCELLED, overdue.
- **Color drift vs the list page:**
  - DRAFT → `bg-gray-100 text-gray-600 ring-gray-500/20` ❗ (list page used **amber**)
  - CANCELLED → `bg-red-50 text-red-400 ring-red-400/20` ❗ (list page used **gray**)

#### `app/dashboard/payments/[id]/page.tsx::invoiceStatusBadge` — **THIRD SHADOW**

- **Line:** [app/dashboard/payments/[id]/page.tsx:41](app/dashboard/payments/[id]/page.tsx#L41)
- **Returns:** class string only, no JSX.
- **Statuses:** PAID, PARTIALLY_PAID, PENDING, CANCELLED, RETURNED, PARTIAL, ISSUED, DUE — *4 statuses (RETURNED, PARTIAL, ISSUED, DUE) that aren't in the canonical Prisma enum.* These appear to be legacy/defensive cases.
- **Color drift vs both invoice pages:**
  - PAID → `bg-green-100 text-green-800` (other pages use `text-green-700`)
  - PARTIALLY_PAID → `bg-orange-100 text-orange-800` (other pages use `bg-amber-100 text-amber-700`)
  - PENDING → `bg-yellow-100 text-yellow-800` (other pages use `bg-blue-100 text-blue-700`!) ❗ **wrong color**

**Migration note:** "PENDING" being yellow on one page and blue on another is the worst drift in the codebase — they're literally different colors for the same state.

---

### 2.3 Unit status (2 implementations)

#### `lib/unit-status.ts::UNIT_STATUS_CONFIG`  ✅ canonical

- **Line:** [lib/unit-status.ts:24](lib/unit-status.ts#L24)
- **Statuses:** vacant, occupied, reserved, maintenance.
- **Shape:** `bg-*-100 text-*-700` + matching dot color.
- **Used by:** `app/dashboard/units/UnitsView.tsx`, calendar, dashboard views.

#### `app/dashboard/properties/[id]/page.tsx::STATUS_BADGE_STYLE` — **VERBATIM DUPLICATE**

- **Line:** [app/dashboard/properties/[id]/page.tsx:28](app/dashboard/properties/[id]/page.tsx#L28)
- Same four statuses, identical color values to `UNIT_STATUS_CONFIG`. Just copied into the property-detail page instead of imported.

---

### 2.4 Tenant classification (3 implementations)

#### `app/dashboard/tenants/TenantsView.tsx::ClassBadge`

- **Line:** [app/dashboard/tenants/TenantsView.tsx:139](app/dashboard/tenants/TenantsView.tsx#L139)
- **Values:** vip, blacklisted, regular (fallback).
- **Shape:** `rounded-full px-2 py-0.5 text-xs font-semibold`. No icon.
- **Colors:**
  - vip → `bg-yellow-100 text-yellow-800`
  - blacklisted → `bg-red-100 text-red-700`
  - regular → `bg-gray-100 text-gray-600`

#### `app/dashboard/reservations/[id]/ReservationDetail.tsx::ClassBadge` — **WITH ICON, DIFFERENT COLOR**

- **Line:** [app/dashboard/reservations/[id]/ReservationDetail.tsx:228](app/dashboard/reservations/[id]/ReservationDetail.tsx#L228)
- **Values:** vip, blacklisted only (returns `null` for regular).
- **Shape:** `rounded-full px-2 py-0.5 text-xs font-medium` with leading `<StarIcon>` / `<ShieldExclamationIcon>` (h-3 w-3).
- **Colors:**
  - vip → `bg-yellow-100 text-yellow-700` ❗ (tenants page used `text-yellow-800`)
  - blacklisted → `bg-red-100 text-red-700`

#### `components/dashboard/BookingEngine.tsx::ClassBadge` — **THIRD SHAPE**

- **Line:** [components/dashboard/BookingEngine.tsx:118](components/dashboard/BookingEngine.tsx#L118)
- **Values:** vip, blacklisted only (returns `null` for regular).
- **Shape:** `rounded-full px-1.5 py-0.5 text-[10px] font-semibold border` (smaller, with border)
- **Colors:**
  - vip → `bg-yellow-50 border-yellow-200 text-yellow-700`
  - blacklisted → `bg-red-50 border-red-200 text-red-700`

**Three visually different badges for the same VIP status.**

---

### 2.5 Tenant type (1 implementation)

#### `app/dashboard/tenants/TenantsView.tsx::TYPE_BADGE` + `TypeBadge()`

- **Lines:** [app/dashboard/tenants/TenantsView.tsx:32](app/dashboard/tenants/TenantsView.tsx#L32) + [:148](app/dashboard/tenants/TenantsView.tsx#L148)
- **Values:** individual, family, corporate, government.
- **Shape:** `rounded-full px-2 py-0.5 text-xs font-medium`.
- **Colors:** blue-50, purple-50, orange-50, teal-50 (all 50/700).

---

### 2.6 Unit type (1 implementation)

#### `app/dashboard/units/UnitsView.tsx::TYPE_BADGE`

- **Line:** [app/dashboard/units/UnitsView.tsx:36](app/dashboard/units/UnitsView.tsx#L36)
- **Values:** STUDIO, ONE_BR, TWO_BR, THREE_BR, SUITE.
- **Same constant name as tenant TYPE_BADGE**, completely different enums and palette: gray, blue, violet, emerald, amber (all 100/700).

---

### 2.7 Property type (2 implementations) — **NOT IN THE NEW SPEC**

#### `app/dashboard/properties/[id]/page.tsx::TYPE_BADGE_STYLE` + `app/dashboard/properties/PropertiesView.tsx::TYPE_BADGE_STYLE`

- **Lines:** [app/dashboard/properties/[id]/page.tsx:21](app/dashboard/properties/[id]/page.tsx#L21), [app/dashboard/properties/PropertiesView.tsx:34](app/dashboard/properties/PropertiesView.tsx#L34)
- **Values:** RESIDENTIAL, MIXED, HOTEL, COMMERCIAL.
- **Colors:** blue, violet, amber, green (all 100/700).
- ⚠ **Gap:** Not in the Badge spec's domain wrappers. Either add a `PropertyTypeBadge` wrapper in `components/badges/` (consistent with other domains) or use the raw `<Badge>` primitive.

---

### 2.8 Expense status (2 implementations, different shapes)

#### `app/dashboard/expenses/ExpensesListClient.tsx::STATUS_STYLE`

- **Line:** [app/dashboard/expenses/ExpensesListClient.tsx:59](app/dashboard/expenses/ExpensesListClient.tsx#L59)
- **Values:** PENDING, APPROVED, REJECTED, PROCESSED.
- **Shape:** `bg-* text-* + dot` (`bg-*-500`)
- **Colors:** amber-100/800, blue-100/800, red-100/800, emerald-100/800.

#### `app/dashboard/expenses/[id]/page.tsx::STATUS_STYLE` — **DRIFTED DUPLICATE + ICON**

- **Line:** [app/dashboard/expenses/[id]/page.tsx:24](app/dashboard/expenses/[id]/page.tsx#L24)
- **Shape:** `bg-* text-* ring-* icon`.
- **Colors:** **amber-50** (list page used `amber-100`), blue-50, red-50, emerald-50. ❗ all 50/700 (one shade lighter)
- Adds a leading icon (`ClockIcon`/`CheckCircleIcon`/`XCircleIcon`/`ClipboardDocumentCheckIcon`).

---

### 2.9 Payment method (2 implementations)

#### `app/dashboard/payments/page.tsx::methodBadge`

- **Line:** [app/dashboard/payments/page.tsx:19](app/dashboard/payments/page.tsx#L19)
- **Values:** CASH, CARD, BANK_TRANSFER, CHEQUE, ONLINE, OTHER.
- **Colors:** green-100/800, blue-100/800, purple-100/800, orange-100/800, cyan-100/800, gray-100/600.

#### `app/dashboard/payments/[id]/page.tsx::methodBadgeClass` — **VERBATIM COPY**

- **Line:** [app/dashboard/payments/[id]/page.tsx:29](app/dashboard/payments/[id]/page.tsx#L29)
- Identical map. Pure code duplication.

---

### 2.10 Tenant tags / classification aux (TenantsView)

- `CLASS_BORDER` (line 39) — border-left color for tenant rows. Not a badge.
- `CLASS_AVATAR` (line 45) — avatar background. Not a badge.
- `TagPills` (line 158) — inline gray `bg-gray-100 text-[10px]` pills for custom tags. **Out of scope** — these are `FilterChip`-shaped, not status badges, and the spec explicitly carves out FilterChip as a separate primitive.

---

## 3. Comparison table — current vs new spec

| Current code path | New spec target | Map cleanly? | Notes |
| --- | --- | --- | --- |
| **Reservation: Upcoming** sky-100/700 | `tone: info, subtle, dot` | ✅ | label "Upcoming" |
| **Arriving Today** orange-500/white | `tone: warning, subtle, dot` | ⚠ visible color shift | spec uses `warning-50/700` (subtle background); current is **solid orange**. Need to confirm intent — keep solid for urgency, or trust the subtle treatment? |
| **Overdue Arrival** red-600/white | `tone: danger, subtle, dot` | ⚠ same as above | currently solid red |
| **In House** green-500/white | `tone: success, subtle, dot` | ⚠ same as above | currently solid green |
| **Due Checkout** orange-500/white | `tone: warning, subtle, dot` | ⚠ same | |
| **Overstay** red-600/white + pulse | `tone: danger, subtle, dot, pulse` | ⚠ + pulse keyframe is new (`badge-pulse`, not Tailwind `animate-pulse`) | Need to add `@keyframes badge-pulse` to globals.css |
| **Checked Out** blue-100/700 | `tone: neutral, subtle, dot` | ⚠ tone shift (blue → neutral) | spec is more muted |
| **Cancelled** gray-100/500 | `tone: neutral, subtle, dot, strikethrough` | ⚠ strikethrough is new | currently no strikethrough |
| **No Show** gray-700/white | `tone: neutral, subtle, icon (slash)` | ⚠ icon is new | currently no icon |
| **Invoice DRAFT** amber-50/700 | — | ❗ **not in spec** | spec has pending/partial/paid/returned/cancelled. DRAFT (pre-issued) needs adding or remapping to "pending"+a separate "draft" tag — needs decision |
| **Invoice ISSUED** blue-100/700 | aliased to PENDING per business logic | ✅ map ISSUED → `pending` | both treated identically in display, just history |
| **Invoice PENDING** blue (page) vs yellow ([id]) | `tone: warning, subtle, dot` | ⚠ spec is **warning** but current code is split between blue and yellow. **Spec wins.** |
| **PARTIALLY_PAID** amber-100/700 | `tone: warning, subtle, dot` | ✅ | |
| **PAID** green-100/700 | `tone: success, subtle, dot` | ✅ | |
| **Invoice CANCELLED** gray (list) vs red ([id]) | `tone: neutral, subtle, dot` | ✅ spec is neutral. List page wins. |
| **Invoice overdue** red-100/700 | spec doesn't carve out overdue | ⚠ | **proposal:** `tone: danger, subtle, dot` + custom label, computed inside `InvoiceStatusBadge` wrapper |
| **Unit vacant** emerald-100/700 | `tone: success, subtle, dot` | ✅ | |
| **Unit occupied** blue-100/700 | `tone: danger` per spec | ❗ **tone mismatch** | spec says occupied = danger (red). Current shows blue. **Spec wins** but verify with user — danger reads "alarming"; "occupied" is the expected state, blue makes more sense to me |
| **Unit reserved** violet-100/700 | `tone: warning` per spec | ⚠ | spec is warning (amber); current is violet. **Decision needed.** |
| **Unit maintenance** amber-100/700 | `tone: neutral` per spec | ⚠ | spec is neutral; current is amber/warning. **Decision needed.** |
| **Tenant VIP** yellow (3 shades) | `tone: gold, solid, icon (star)` | ✅ but visually different | gold OKLCH, **solid** style (white text on gold). Currently 3 different yellows. |
| **Tenant blacklisted** red-100/700 (+/- icon) | `tone: danger, subtle, icon (warning)` | ✅ | reservation-detail variant already has icon; align everywhere |
| **Tenant regular** gray-100/600 | `tone: neutral, outline` (no badge in some places, returns null) | ⚠ | spec says outline; current code sometimes hides it entirely. Suggest: show outline badge in tenants list, hide in reservation cards |
| **Tenant individual/family/corporate/government** blue-50/purple-50/orange-50/teal-50 | new spec doesn't have these yet | ⚠ **map manually:** individual → neutral, family → accent (violet), corporate → warning (amber/orange), government → info (teal-ish — closest is `info` blue) | needs user input or just go with these mappings |
| **Unit STUDIO/1BR/2BR/3BR** gray/blue/violet/emerald | `tone: neutral, outline` (all four) | ✅ per spec — types are categorical, all neutral outline |
| **Unit SUITE** amber-100/700 | `tone: gold, subtle` | ✅ exact spec match |
| **Property RESIDENTIAL/MIXED/HOTEL/COMMERCIAL** blue/violet/amber/green | **not in spec** | ❗ needs new wrapper `PropertyTypeBadge` |
| **Expense PENDING** amber (drifts 50/100) | `tone: warning, subtle, dot` | ✅ | |
| **Expense APPROVED** blue-100/800 | `tone: info, subtle, dot` | ✅ | |
| **Expense REJECTED** red-100/800 | `tone: danger, subtle, dot` | ✅ | |
| **Expense PROCESSED** emerald-100/800 | `tone: success, subtle, dot` | ✅ | |
| **Payment CASH** green-100/800 | `tone: success, subtle` | ✅ | |
| **Payment CARD** blue-100/800 | `tone: info, subtle` | ✅ | |
| **Payment BANK_TRANSFER** purple-100/800 | `tone: accent, subtle` | ✅ violet OKLCH |
| **Payment CHEQUE** orange-100/800 | `tone: warning, subtle` | ✅ | |
| **Payment ONLINE** cyan-100/800 | **not in spec** (spec has only cash/card/transfer/cheque) | ⚠ | need to add `online` (recommend: `tone: info` with different label) |
| **Payment OTHER** gray-100/600 | **not in spec** | ⚠ | recommend: `tone: neutral` |

---

## 4. Variants in code that aren't in the new spec

1. **Invoice `DRAFT`** — spec only covers pending/partial/paid/returned/cancelled. The codebase actively uses DRAFT for the new "auto-issue monthly cycle" flow per `CLAUDE.md`. **Action: add `draft` to the `InvoiceStatus` enum.** Recommended tone: `neutral, subtle` (no dot — pre-state, not actionable).
2. **Invoice `ISSUED`** — used interchangeably with `PENDING` per code. **Action: alias `ISSUED → pending` inside the helper.**
3. **Invoice `RETURNED`/`PARTIAL`/`DUE`** — legacy fallbacks in `methodBadgeClass`. **Action: confirm whether these still appear in DB; if yes, add to spec; if no, drop.**
4. **Invoice `overdue`** — derived, not stored. Spec doesn't carve it out. **Action: handle inside the `InvoiceStatusBadge` wrapper — if status ∈ {pending, partial} and dueDate < today, render `danger` instead.**
5. **Property type** (RESIDENTIAL/MIXED/HOTEL/COMMERCIAL) — not in the spec at all. **Action: add `PropertyTypeBadge` wrapper.**
6. **Payment method `ONLINE` / `OTHER`** — not in the spec. **Action: add to `PaymentMethod` enum + helper.**

---

## 5. Color drift incidents (same status, different colors)

| Status | File A | Color A | File B | Color B |
| --- | --- | --- | --- | --- |
| Invoice DRAFT | invoices/page.tsx | `bg-amber-50` | invoices/[id]/page.tsx | `bg-gray-100` |
| Invoice CANCELLED | invoices/page.tsx | `bg-gray-100 text-gray-500` | invoices/[id]/page.tsx | `bg-red-50 text-red-400` |
| Invoice PENDING | invoices/page.tsx | `bg-blue-100 text-blue-700` | payments/[id]/page.tsx | `bg-yellow-100 text-yellow-800` ❗ |
| Invoice PAID | invoices/page.tsx | `text-green-700` | payments/[id]/page.tsx | `text-green-800` |
| Invoice PARTIALLY_PAID | invoices/page.tsx | `bg-amber-100 text-amber-700` | payments/[id]/page.tsx | `bg-orange-100 text-orange-800` |
| Tenant VIP | tenants/TenantsView | `text-yellow-800` | reservations/.../ReservationDetail | `text-yellow-700` | BookingEngine | `bg-yellow-50 border` |
| Expense PENDING | ExpensesListClient | `bg-amber-100` | expenses/[id]/page | `bg-amber-50` |

After consolidation, **all of these collapse to the spec's single source of truth** — the wrapper component maps each status to one canonical tone/appearance.

---

## 6. Edge cases & concerns discovered

1. **The reservation `pulse` (Overstay) animation** currently uses Tailwind's `animate-pulse`, which has a different feel than the spec's custom `@keyframes badge-pulse` (1.2s ease-in-out, scale 1→1.6). Decision needed: keep `animate-pulse` for simplicity, or add the custom keyframe. Spec recommends the custom keyframe.
2. **Reservation status badges differ in size between list and detail pages** (list uses `text-xs px-2 py-0.5`, detail uses `text-sm px-2.5 py-1`). New spec normalizes both to `size="md"` (24 px). **Will be a small visible difference on list pages — slightly taller.**
3. **`getDisplayStatus()` returns a `pulse: boolean` AND a `rowClass`.** The `rowClass` (e.g., `bg-amber-50`, `bg-red-100`) drives the **table row background**, not the badge. That logic must be preserved separately — the Badge migration doesn't touch row coloring.
4. **`ReservationDetail.tsx::ClassBadge`** returns `null` for regular tenants (no badge). `TenantsView.tsx::ClassBadge` shows a "Regular" badge. After migration, decide whether to show the Regular outline-badge everywhere, or keep the per-call-site decision (current behavior — caller decides).
5. **`BookingEngine.tsx::ClassBadge`** uses `text-[10px]` and a border, which is visibly different from the others. The spec's `size="sm"` is 11 px and uses border in `outline` mode — close but not identical. Acceptable to standardize, but flag the visual change.
6. **Unit "Occupied" → `danger` (red) per spec is debatable.** Current code uses blue. From a receptionist's daily reality, occupied is the *expected* state, not an alarming one. Vacancy is what they're hunting. **Recommendation:** keep Occupied as `info` blue, not `danger`. This deviates from the spec but matches user mental model. Worth confirming with the user.
7. **Unit "Reserved" → `warning` (amber) per spec** is similarly arguable. Currently violet. Same logic — reserved isn't a "warning"; it's a *future* booking. **Recommendation:** map to `accent` (violet) to preserve mental model.
8. **Property type badges** have no spec equivalent. The new Badge primitive can render them, but we'd need a `PropertyTypeBadge` wrapper. Out of original spec scope but consistent style.
9. **Custom tenant tags (`TagPills`)** — not status badges. Out of Badge migration scope; would be `FilterChip` in a future phase.
10. **The `methodBadgeClass`/`invoiceStatusBadge` helpers in `payments/[id]/page.tsx`** are pure server-side computed functions returning class strings. Once the new `<PaymentMethodBadge>` and `<InvoiceStatusBadge>` JSX components exist, those helpers can be deleted and replaced with `<Badge>` calls in the rendered JSX. Watch out: `payments/[id]/page.tsx` is a server component — the badge components must be RSC-safe (no `"use client"`-only hooks in the wrappers).

---

## 7. Files that will be touched in Phase 3

Order of consolidation as the prompt specified, with actual files affected:

| Step | Duplicate | Files to edit | Files to delete (after migration) |
| --- | --- | --- | --- |
| 1 | `methodBadge` / `methodBadgeClass` | `payments/page.tsx`, `payments/[id]/page.tsx` | helpers go (just delete the local functions; files stay) |
| 2 | `TYPE_BADGE` constants | `tenants/TenantsView.tsx`, `units/UnitsView.tsx`, `properties/[id]/page.tsx`, `properties/PropertiesView.tsx` | helpers go |
| 3 | `ClassBadge` | `tenants/TenantsView.tsx`, `reservations/[id]/ReservationDetail.tsx`, `components/dashboard/BookingEngine.tsx` | helpers go |
| 4 | `StatusBadge` (×3) | `invoices/page.tsx`, `invoices/[id]/page.tsx`, `reservations/[id]/ReservationDetail.tsx` (the local `StatusBadge` wrapping `getDisplayStatus`) | helpers go |
| 5 | `invoiceStatusBadge` shadow + `STATUS_BADGE_STYLE` + `STATUS_STYLE` | `payments/[id]/page.tsx`, `properties/[id]/page.tsx`, `expenses/ExpensesListClient.tsx`, `expenses/[id]/page.tsx` | helpers go |

**Total edits: ~12 files, all helper deletions inline. No standalone files get deleted in this migration — the duplicates are local functions/constants, not separate files.**

---

## 8. Recommended order for Phase 2 (Badge primitive + wrappers)

Build sequence:

1. Add `@keyframes badge-pulse` to `styles/globals.css`.
2. Build `components/ui/Badge.tsx` — the primitive (tone × appearance × size × dot/icon/pulse/strikethrough/onClose).
3. Build domain wrappers in `components/badges/`:
   - `ReservationStatusBadge.tsx`
   - `InvoiceStatusBadge.tsx` (handles overdue derivation + DRAFT)
   - `UnitStatusBadge.tsx`
   - `UnitTypeBadge.tsx`
   - `TenantClassBadge.tsx`
   - `TenantTypeBadge.tsx`
   - `PaymentMethodBadge.tsx`
   - `ExpenseStatusBadge.tsx`
   - `PropertyTypeBadge.tsx` (gap from spec)
4. Each wrapper takes a typed enum `status: ReservationStatus` etc. and resolves to a `<Badge>` call with the right tone/appearance/dot/icon, **plus the i18n label** via `useTranslations`/`getTranslations`.
5. Export both `Badge` and the wrappers from `components/ui/index.ts` (or add a `components/badges/index.ts` barrel).

---

## 9. Decisions I need from you before Phase 2

1. **Unit "Occupied" tone:** spec says `danger` (red). Current code uses blue. Keep current blue mapping (deviation from spec) or follow spec?
2. **Unit "Reserved" tone:** spec says `warning` (amber). Current violet. Keep violet (recommended) or follow spec?
3. **Unit "Maintenance" tone:** spec says `neutral`. Current amber. Keep amber (more visible) or follow spec?
4. **Reservation "Arriving Today" / "Overdue Arrival" / "In House" / "Due Checkout" / "Overstay":** spec says `subtle` (pastel). Current uses **solid** (`bg-orange-500 text-white` etc.) for the urgent statuses to grab attention. Subtle would visually soften these. Confirm: solid (current) or subtle (spec)?
5. **Invoice DRAFT tone:** I propose `neutral, subtle, no dot`. Confirm.
6. **Pulse animation:** spec's custom `badge-pulse` keyframe (1.2 s, scale 1.6) vs current Tailwind `animate-pulse` (2 s, opacity only)?
7. **Tenant "Regular" tag:** show outline-badge everywhere, or keep per-call-site decision (some hide it)?
8. **Property-type wrapper:** OK to add `PropertyTypeBadge` even though spec didn't define one?
9. **Payment-method `ONLINE` and `OTHER`:** OK to add to the wrapper as `tone: info` and `tone: neutral` respectively?

---

## 10. What I am NOT touching

- `CLASS_BORDER` / `CLASS_AVATAR` in `TenantsView` — these style table rows and avatar bubbles, not badges.
- `TagPills` (custom tenant tags) — FilterChip territory, out of scope.
- The `rowClass` field returned by `getDisplayStatus()` — that drives table-row background colour, separate concern.
- Notification dot indicators (e.g., red "3" on bell icon) — different primitive per the spec.
- Status-tab counts (e.g., "Arriving Today · 3") — out of badge scope.
- `lib/reservation-status.ts` / `lib/unit-status.ts` core logic — only their **output shape** changes (return wrapper props, not raw Tailwind strings). All branching, priority math, and pulse flagging stays.
