# Binaya PMS — Scenario Testing Issues

> Issues discovered during systematic scenario-based QA.
> Severity: **P0** (blocks core workflow / data corruption / security) ·
> **P1** (major feature broken / wrong financials — fix before launch) ·
> **P2** (annoying UX / minor calc error — should fix before launch) ·
> **P3** (cosmetic / nice-to-have).

---

## Summary

| # | Title | Scenario | Severity | Status |
|---|-------|----------|----------|--------|
| 1 | No logout button on Onboarding wizard | 1 | P2 | ✅ Fixed |
| 2 | Onboarding phone field lacks country-code picker (reuse PhoneField) | 1 | P2 | ✅ Fixed |
| 3 | App still branded "OmRent" — rename to "Binaya" app-wide | 1 | P2 | ✅ Fixed |
| 4 | Disable modal (slide-over) forms for now — use full pages | 2 | P2 | ✅ Fixed |
| 5 | Base Price should be optional in Bulk Unit Add | 2 | P2 | ✅ Fixed |
| 6 | Make unit-row regeneration automatic; remove "Regenerate" button | 2 | P3 | Open |
| 7 | Remove Price column from Units list page | 2 | P3 | ✅ Fixed |
| 8 | After create, redirect to LIST page (not detail) once toast shows | 2 | P2 | ✅ Fixed |
| 9 | Tenants list filter tabs/labels show raw i18n keys (missing translations) | 3 | P2 | Open |
| 10 | Tenant phone fields hardcode +968 — allow changing country code | 3 | P2 | ✅ Fixed |
| 11 | Quick Add → Full Form loses typed first/last name (uncontrolled inputs) | 3 | P2 | ✅ Fixed |
| 12 | Disable modal tenant form for now (dup of #4, tenants) | 3 | P2 | ✅ Fixed (via #4) |
| 13 | After editing a tenant, no redirect to tenant detail page | 4 | P2 | ✅ Fixed |
| 14 | Reservation list filter labels show raw i18n keys | 6 | P2 | Open |
| 15 | Reservation form steps not responsive | 6 | P2 | ✅ Fixed |
| 16 | Tenant select after search does not actually select (booking blocked) | 6 | **P1** | ✅ Fixed |
| 17 | Daily date picker UX poor — align with monthly picker | 6 | P2 | Open |
| 18 | Reservation number not org-scoped (got 00140) + make format configurable | 6 | **P1** | ✅ Fixed (format UI → #29) |
| 19 | Unit name in reservation not clickable to unit page | 6 | P3 | ✅ Fixed |
| 20 | No Check-In button for early check-in despite setting enabled | 6 | **P1** | ✅ Fixed |
| 21 | Availability modal: Show disabled under "All Properties" (need property selector) | 6 | P2 | ✅ Fixed |
| 22 | Availability split-day half-square wrong direction in Arabic/RTL | 6 | P3 | ✅ Fixed |
| 23 | Edit Reservation 404s — route not implemented | 6 | **P1** | ✅ Stopgap (dead link removed; full flow → #30) |
| 24 | Add settings: require contract creation/signing before check-in (feature) | 7 | **P1** | Open |
| 25 | Corporate tenant: company name shown small on reservation page (contact too prominent) | 8 | P2 | ✅ Fixed (detail; list/PDF → follow-up) |
| 26 | Add Seasonal Price modal: monthly rate should be optional, not required | 10 | P2 | Open |
| 27 | Add settings to prevent monthly reservations during certain periods (feature) | 10 | P2 | Open |
| 28 | Seasonal price breakdown not shown on unit card during selection (and not persisted on reservationUnit) | 10 | **P1** | ✅ Persistence fixed (card UI → #31) |
| 29 | Configurable reservation-number format (prefix/padding/reset) in settings | 6 (split from #18) | P2 | Open |
| 30 | Full Edit Reservation flow (edit route + PUT API + guards) | 6 (split from #23) | **P1** | Open |
| 31 | Show seasonal segment breakdown on unit card during selection | 10 (split from #28) | P2 | Open |

---

<!-- Issues appended below as discovered -->

## Issue #1: No logout button on Onboarding wizard
- **Scenario:** 1 — Create organization
- **Severity:** P2
- **Steps to reproduce:** Sign up → verify email → land on `/onboarding`. There is no way to log out / abandon onboarding from this screen.
- **Expected:** A logout (or "back to login") affordance is available on the onboarding wizard, so a user who signed up with the wrong account, or wants to switch accounts, can exit without clearing cookies manually.
- **Actual:** The wizard ([app/onboarding/OnboardingWizard.tsx](app/onboarding/OnboardingWizard.tsx)) renders only the 3-step form + Back/Next/Create buttons. No logout control. The only navigation is "Back to home" — absent here.
- **Root cause:** Feature gap — logout was never added to this screen. A `logout()` server action already exists at [app/login/actions.ts:212](app/login/actions.ts#L212).
- **Proposed fix:** Add a small logout button (e.g. top-right of the wizard, or under the step counter) that calls the existing `logout()` server action. Reuse the same action used by the dashboard header so behavior is consistent.
- **Files affected:** [app/onboarding/OnboardingWizard.tsx](app/onboarding/OnboardingWizard.tsx), import `logout` from [app/login/actions.ts](app/login/actions.ts).
- **Status:** ✅ Fixed — added a "Log out" button (top-right of the wizard) that calls the existing `logout()` server action. New i18n key `auth.onboarding.logout` in both locales.

## Issue #2: Onboarding phone field lacks a country-code picker (default Oman)
- **Scenario:** 1 — Create organization
- **Severity:** P2
- **Steps to reproduce:** Onboarding Step 1 → Phone field is a plain text input with no dial-code prefix or country selector.
- **Expected:** A good-looking phone input with a country-code selector, defaulting to Oman (+968), with formatting/validation. Matches the polish of the rest of the wizard.
- **Actual:** Step 1 uses a generic `InputField type="tel"` ([app/onboarding/OnboardingWizard.tsx:381-388](app/onboarding/OnboardingWizard.tsx#L381-L388)) — free-text, no dial code, no validation.
- **Root cause:** The wizard predates the shared phone component. A purpose-built [components/ui/form/PhoneField.tsx](components/ui/form/PhoneField.tsx) **already exists** — it uses `libphonenumber-js`, defaults `defaultCountry="OM"` (+968 prefix), formats as-you-type, and emits canonical E.164 via a hidden field. **It is not wired into onboarding.** However, per its own docstring it is *single-country* (no dropdown picker yet — "v2 picker planned in Tier 3").
- **Proposed fix:** Two parts. (a) Quick win: replace the plain `InputField` in Step 1 with the existing `PhoneField` (defaultCountry="OM") to immediately get the +968 prefix, formatting, and E.164 output. (b) For an actual country *picker* (multi-country selector), build the v2 dropdown the component's docstring references (`SearchableSelect`-based), defaulting selection to Oman. Decide whether a picker is needed for MVP or if single-country Oman is sufficient.
- **Files affected:** [app/onboarding/OnboardingWizard.tsx](app/onboarding/OnboardingWizard.tsx), [components/ui/form/PhoneField.tsx](components/ui/form/PhoneField.tsx). Note: the wizard's `handleSubmit` appends `phone` from `form.phone` — would need to read the E.164 value the PhoneField emits.
- **Status:** ✅ Fixed — replaced Step 1's plain `InputField` with the new [PhoneInput](components/ui/form/PhoneInput.tsx) (`variant="dark"` to match the wizard), keeping the slate label. `onValueChange` stores the E.164/raw value into `form.phone`, which `handleSubmit` already appends. Same searchable country picker as the tenant forms (#10).

## Issue #3: App still branded "OmRent" — rename to "Binaya" across the app
- **Scenario:** 1 — Create organization (noticed on auth/onboarding branding)
- **Severity:** P2
- **Steps to reproduce:** Brand name "OmRent" / "أم رنت" appears in page title, auth screens, dashboard header, and emails.
- **Expected:** Product is branded **"Binaya"** everywhere (EN), with the correct Arabic name (e.g. "بنايه") in `ar.json`.
- **Actual:** "OmRent" string is present in 7 files. Full inventory:
  - [app/layout.tsx:32](app/layout.tsx#L32) — `<title>` metadata: `"OmRent — Property Management for Oman"`
  - [messages/en.json:163](messages/en.json#L163) — `auth.brand.name` = `"OmRent"` (login/onboarding card heading)
  - [messages/en.json:408](messages/en.json#L408) — `...header.appName` = `"OmRent"` (dashboard header)
  - [messages/ar.json:163](messages/ar.json#L163) — `auth.brand.name` = `"أم رنت"`
  - [messages/ar.json:408](messages/ar.json#L408) — `...header.appName` = `"OmRent"` (Arabic header still Latin — also a localization bug)
  - [app/dashboard/settings/team/actions.ts:107](app/dashboard/settings/team/actions.ts#L107) — fallback org name `"OmRent"` (used in invite emails)
  - [lib/email.ts](lib/email.ts) — many: `RESEND_FROM_EMAIL` default, email subjects ("Verify your email — OmRent", "…invited to join … on OmRent"), HTML `<h1>` headings, footer `© OmRent`, "If you didn't create an OmRent account…" (lines 7, 14, 18, 38, 72, 95, 106, 118, 147, 157, 196, 208, 253)
  - **Non-user-facing (cookie keys — decide whether to rename):** `omrent_last_activity` cookie in [utils/supabase/middleware.ts:10](utils/supabase/middleware.ts#L10) and [components/dashboard/InactivityGuard.tsx:8](components/dashboard/InactivityGuard.tsx#L8). These two MUST stay in sync if renamed; cosmetic only, safe to leave as-is.
- **Root cause:** Product was renamed; the string was never globally swapped.
- **Proposed fix:** Replace all user-facing "OmRent" → "Binaya" (and `أم رنت` → the chosen Arabic spelling, e.g. "بنايه"). Confirm the exact Arabic spelling with the user before editing `ar.json`. Leave cookie keys unless a clean rename is wanted (keep both files in sync). Update `RESEND_FROM_EMAIL` env in deployment too.
- **Files affected:** [app/layout.tsx](app/layout.tsx), [messages/en.json](messages/en.json), [messages/ar.json](messages/ar.json), [app/dashboard/settings/team/actions.ts](app/dashboard/settings/team/actions.ts), [lib/email.ts](lib/email.ts), (optional) [utils/supabase/middleware.ts](utils/supabase/middleware.ts), [components/dashboard/InactivityGuard.tsx](components/dashboard/InactivityGuard.tsx).
- **Status:** ✅ Fixed — all user-facing "OmRent"/"أم رنت" replaced with the Latin "Binaya" (user decision: keep Latin in the Arabic UI too): page `<title>`, `auth.brand.name` + `header.appName` in both locales, the invite-email fallback org name, and every string in `lib/email.ts` (subjects, `<h1>`, body, footer, `RESEND_FROM_EMAIL` default). Lowercase `omrent_last_activity` cookie keys left untouched (non-user-facing; the two files stay in sync). **Note:** set the `RESEND_FROM_EMAIL` env var in deployment to the Binaya sender.

## Issue #4: Disable modal (slide-over) forms for now — use full pages
- **Scenario:** 2 — Add building with units
- **Severity:** P2
- **Steps to reproduce:** Clicking "Add Building" / "Add Tenant" / "Add Unit" from a list page opens an **intercepted modal (slide-over)** instead of navigating to the full `/new` page.
- **Expected (user decision):** Do **not** use modal forms at the moment — always navigate to the full-page form (`/dashboard/properties/new`, `/dashboard/units/new`, `/dashboard/tenants/new`).
- **Actual:** Next.js **intercepting parallel routes** render these forms as modal overlays:
  - [app/dashboard/@modal/(.)properties/new/page.tsx](app/dashboard/@modal/(.)properties/new/page.tsx)
  - [app/dashboard/@modal/(.)units/new/page.tsx](app/dashboard/@modal/(.)units/new/page.tsx)
  - [app/dashboard/@modal/(.)tenants/new/page.tsx](app/dashboard/@modal/(.)tenants/new/page.tsx)
  The forms detect modal context via `useSlideOver()` (see [components/dashboard/PropertyForm.tsx:108,149](components/dashboard/PropertyForm.tsx#L108)) and call `slideOver.closeAndNavigate()`.
- **Root cause:** Intentional intercepting-route UX; user wants it off for now.
- **Proposed fix:** Disable the interception so links fall through to the real pages. Cleanest options: (a) delete/empty the three `(.)…/new` interceptor route files so the full page renders, **or** (b) replace each interceptor `page.tsx` body with a redirect/`notFound()` so the slot stays empty and the underlying `/new` route shows. The `@modal/default.tsx` should keep returning null. Keep the standalone `/new` pages and the forms' non-modal branch (already present). Verify list-page "Add" buttons are plain `<Link href="/dashboard/.../new">` (they are) so removing the interceptor is sufficient.
- **Files affected:** [app/dashboard/@modal/(.)properties/new/page.tsx](app/dashboard/@modal/(.)properties/new/page.tsx), [app/dashboard/@modal/(.)units/new/page.tsx](app/dashboard/@modal/(.)units/new/page.tsx), [app/dashboard/@modal/(.)tenants/new/page.tsx](app/dashboard/@modal/(.)tenants/new/page.tsx) (and [app/dashboard/@modal/CreateTenantModal.tsx](app/dashboard/@modal/CreateTenantModal.tsx)). Forms already support non-modal mode; no change needed there.
- **Note:** This interacts with Issue #8 (redirect-to-list). Once modals are off, the form's `router.replace`/`push` path is the one that runs — fix both together.
- **Status:** ✅ Fixed — deleted the three `(.)…/new` interceptor route files (`@modal/(.)properties|units|tenants/new/page.tsx`) so the "Add" links fall through to the full `/new` pages; `@modal/default.tsx` keeps the slot empty. Also removed the now-orphaned `@modal/CreateTenantModal.tsx`. Forms' non-modal navigation branch (`useSlideOver()` → null) is now the active path.

## Issue #5: Base Price should be optional in Bulk Unit Add
- **Scenario:** 2 — Add building with units
- **Severity:** P2
- **Steps to reproduce:** `/dashboard/units/bulk` → the "Defaults" section marks **Base Price** with a red `*` (required), and a row only counts as valid when `parseFloat(basePrice) >= 0`, so a blank base price makes the row invalid and blocks submit.
- **Expected:** Base Price is **optional** in bulk add. A unit with no base price should still be creatable (price can be set later / pricing handled via unit_prices).
- **Actual:**
  - UI labels base price required: [BulkCreateForm.tsx:366-367](app/dashboard/units/bulk/BulkCreateForm.tsx#L366-L367) (`<span className="text-red-500">*</span>`).
  - `validCount`/`canSubmit` require `parseFloat(r.basePrice) >= 0` — blank parses to `NaN`, fails the check: [BulkCreateForm.tsx:163](app/dashboard/units/bulk/BulkCreateForm.tsx#L163) and the same filter in `handleSubmit` [line 176](app/dashboard/units/bulk/BulkCreateForm.tsx#L176).
  - Server filter also drops rows where `basePrice` is not `>= 0`: [units/actions.ts:235](app/dashboard/units/actions.ts#L235).
  - Prisma `Unit.basePrice` — confirm column nullability in schema before finalizing fix (likely needs to allow null or default 0).
- **Proposed fix:** Treat blank base price as valid (default to `0` or null). Remove the required `*`; change validity to `r.name.trim()` only (drop the `basePrice >= 0` gate, or allow blank → 0). Update both the client filters (lines 163, 176) and the server filter (units/actions.ts:235), and ensure `Unit.basePrice` accepts the chosen empty value (schema). Decide: store `0.000` or make the column nullable.
- **Files affected:** [app/dashboard/units/bulk/BulkCreateForm.tsx](app/dashboard/units/bulk/BulkCreateForm.tsx), [app/dashboard/units/actions.ts](app/dashboard/units/actions.ts), possibly [prisma/schema.prisma](prisma/schema.prisma).
- **Status:** ✅ Fixed — removed the required `*` on Base Price; `validCount`/`canSubmit` and the submit filter now gate on `name` only; blank base price defaults to `0` (client `Number.isFinite` guard) and the server `bulkCreateUnits` filter relaxed to name-only with a `0` fallback. No schema change needed (`basePrice` stores `0`).

## Issue #6: Make unit-row regeneration automatic; remove the "Regenerate" button
- **Scenario:** 2 — Add building with units
- **Severity:** P3
- **Steps to reproduce:** In bulk add, changing the naming pattern (prefix/start/end/separator) already re-seeds rows automatically — but there's also a manual **"Regenerate"** button in the preview header.
- **Expected:** Regeneration is fully automatic; remove the explicit button to reduce clutter.
- **Actual:** A `regenerate()` handler + button exist at [BulkCreateForm.tsx:138-141](app/dashboard/units/bulk/BulkCreateForm.tsx#L138-L141) and [441-449](app/dashboard/units/bulk/BulkCreateForm.tsx#L441-L449). Note: the auto re-seed only fires while `hasCustomized` is false ([useEffect line 132-136](app/dashboard/units/bulk/BulkCreateForm.tsx#L132-L136)); the pattern inputs reset `hasCustomized=false` on change, so auto-regen already covers pattern edits. The button's purpose is to discard manual row edits and re-seed.
- **Proposed fix:** Remove the Regenerate button (and optionally the now-unused `regenerate()` fn + `ArrowPathIcon` import + `regenerate`/`regenerateTitle` i18n keys). Confirm with user that losing the "discard my edits and re-seed" affordance is acceptable — pattern-driven auto regen remains. Keep the `validCount` badge that shares that header.
- **Files affected:** [app/dashboard/units/bulk/BulkCreateForm.tsx](app/dashboard/units/bulk/BulkCreateForm.tsx); optional cleanup in [messages/en.json](messages/en.json) / [messages/ar.json](messages/ar.json) (`units.bulk.regenerate*`).
- **Status:** Open

## Issue #7: Remove Price column from Units list page
- **Scenario:** 2 — Add building with units
- **Severity:** P3
- **Steps to reproduce:** `/dashboard/units` shows a **Price** column (basePrice in OMR).
- **Expected:** Remove the Price column from the units list.
- **Actual:** The `basePrice` column is defined at [app/dashboard/units/columns.tsx:177-192](app/dashboard/units/columns.tsx#L177-L192).
- **Proposed fix:** Remove that column object from the array returned by `buildUnitColumns`. Check `UnitFilters`/sort options and any mobile `mobilePriority` ordering don't reference it afterward. Leaves Photo, Name, Property, Type, Floor, Beds/Baths, Status.
- **Files affected:** [app/dashboard/units/columns.tsx](app/dashboard/units/columns.tsx).
- **Status:** ✅ Fixed — removed the `basePrice` column object from `buildUnitColumns`. No filter/sort referenced it. Leaves Photo, Name, Property, Type, Floor, Beds/Baths, Status.

## Issue #8: After create, redirect to the LIST page (not detail), once the toast shows
- **Scenario:** 2 — Add building with units
- **Severity:** P2
- **Steps to reproduce:** After creating a building or a unit, the app navigates to the **detail page** of the new record, not the list page.
- **Expected:** After a successful create, show the success toast, then redirect to the **list page** (`/dashboard/properties` for buildings, `/dashboard/units` for units) after the toast displays/hides.
- **Actual — current destinations are all DETAIL pages:**
  - Property create → `router.replace('/dashboard/properties/<id>')`: [PropertyForm.tsx:146-155](components/dashboard/PropertyForm.tsx#L146-L155).
  - Single unit create → `router.push('/dashboard/properties/<propertyId>')` after 700ms: [UnitForm.tsx:168-174](components/dashboard/UnitForm.tsx#L168-L174).
  - Bulk units create → `router.push('/dashboard/properties/<propertyId>')`: [BulkCreateForm.tsx:200-204](app/dashboard/units/bulk/BulkCreateForm.tsx#L200-L204).
- **Proposed fix:** Change all three create-success destinations to the list page:
  - PropertyForm create branch → `/dashboard/properties`
  - UnitForm create branch → `/dashboard/units`
  - BulkCreateForm success → `/dashboard/units`
  Keep the existing toast; the single-unit form already delays 700ms so the toast is visible before navigating — apply the same small delay (or rely on sonner's persistence across navigation) to the others for consistency. **Edit-mode** redirects can stay on detail (only change *create* mode). Coordinate with Issue #4 (modal off) so the non-modal navigation path is the one taking effect.
- **Files affected:** [components/dashboard/PropertyForm.tsx](components/dashboard/PropertyForm.tsx), [components/dashboard/UnitForm.tsx](components/dashboard/UnitForm.tsx), [app/dashboard/units/bulk/BulkCreateForm.tsx](app/dashboard/units/bulk/BulkCreateForm.tsx). **Also tenant create** → [components/dashboard/TenantForm.tsx:485-486](components/dashboard/TenantForm.tsx#L485-L486) currently `router.push('/dashboard/tenants/<id>')`; change create-mode to `/dashboard/tenants`.
- **Status:** ✅ Fixed — create-mode now lands on the list: PropertyForm → `/dashboard/properties`, UnitForm → `/dashboard/units`, BulkCreateForm → `/dashboard/units`. Edit-mode still goes to the detail page. (TenantForm's create→list change ships in the combined TenantForm commit with #11/#13.)

## Issue #9: Tenants list filter tabs & labels render raw i18n keys (missing translations)
- **Scenario:** 3 — Add tenant
- **Severity:** P2
- **Steps to reproduce:** Open `/dashboard/tenants`. The status quick-filter tabs and the Type filter label show literal keys like `tenants.filters.statusAll`, `tenants.filters.statusActive`, `tenants.filters.statusInactive` instead of "All / Active / Inactive".
- **Expected:** Tabs read "All", "Active", "Inactive" (EN) and their Arabic equivalents; the type filter reads "Type:" / "All Types".
- **Actual:** [TenantFilters.tsx](app/dashboard/tenants/TenantFilters.tsx) requests these keys from the `tenants.filters` namespace, but they are **absent in both locales**:
  - Requested by component ([lines 39-52, 65, 74, 83](app/dashboard/tenants/TenantFilters.tsx#L39-L83)): `statusAll`, `statusActive`, `statusInactive`, `typeLabel`, `allTypes`, `allSources`, `sourceLabel`, `searchPlaceholder`.
  - Present in [messages/en.json](messages/en.json) `tenants.filters`: `filtersBtn, searchPlaceholder, all, regular, vip, blacklisted, allTypes, sourceLabel, clearAll`.
  - **Missing in EN & AR:** `statusAll`, `statusActive`, `statusInactive`, `typeLabel`, `allSources`. (next-intl falls back to printing the full key path when a key is missing.)
- **Root cause:** Key drift — the component was renamed/expanded (e.g. `all` → `statusAll`) but the message catalogs weren't updated. Affects both `messages/en.json` and `messages/ar.json` identically.
- **Proposed fix:** Add the missing keys to `tenants.filters` in **both** locales: `statusAll`, `statusActive`, `statusInactive`, `typeLabel`, `allSources` (EN values: "All", "Active", "Inactive", "Type:", "All Sources"; AR: "الكل", "نشط", "غير نشط", "النوع:", "كل المصادر"). Remove now-unused legacy `all` key if nothing else references it (grep first). Consider an i18n key-coverage check in CI to catch this class of bug — likely exists elsewhere too (worth a follow-up sweep).
- **Files affected:** [messages/en.json](messages/en.json), [messages/ar.json](messages/ar.json) (`tenants.filters`).
- **Status:** Open

## Issue #10: Tenant phone inputs hardcode +968 — allow changing the country code
- **Scenario:** 3 — Add tenant
- **Severity:** P2
- **Steps to reproduce:** Tenant Quick Add (and full form) phone field shows a fixed `+968` prefix box that the user cannot change. Tourists/expats with non-Omani numbers can't be entered with a correct code.
- **Expected:** A phone input with a changeable country code (default Oman +968), consistent with the org-wide phone UX. Note this is the **same underlying need** as Issue #2 (onboarding phone) — both should use the shared `PhoneField` and, ideally, the planned country-picker.
- **Actual:** Hardcoded prefix span `+968` in Quick Add ([TenantForm.tsx:307](components/dashboard/TenantForm.tsx#L307)) with a plain `type="tel"` input; the full form phone field is similarly a free input. The reusable [components/ui/form/PhoneField.tsx](components/ui/form/PhoneField.tsx) (Oman default, libphonenumber validation) is **not used here**.
- **Root cause:** Form predates the shared component; single-country assumption baked in.
- **Proposed fix:** Replace the hardcoded-prefix phone inputs in TenantForm (quick + full) with the shared `PhoneField` (`defaultCountry="OM"`). For an actual selectable country code, build/enable the country-picker (see Issue #2 — same v2 picker work). Ensure the lifted `phone` state receives E.164. **Group #2 + #10 into one "phone input" fix** so onboarding and tenants share the solution.
- **Files affected:** [components/dashboard/TenantForm.tsx](components/dashboard/TenantForm.tsx), [components/ui/form/PhoneField.tsx](components/ui/form/PhoneField.tsx). Related: Issue #2.
- **Status:** ✅ Fixed — built the v2 picker as a new [components/ui/form/PhoneInput.tsx](components/ui/form/PhoneInput.tsx): a searchable country-code dropdown (flag + name + dial code, GCC/expat countries prioritized, Oman default) built on `libphonenumber-js` + `Intl.DisplayNames` (locale-aware names), with as-you-type formatting and E.164 output. Wired into TenantForm's Quick-Add **and** Full-form primary phone (replacing the hardcoded +968 prefix). Secondary/WhatsApp inputs left as plain `tel` for now. New `phoneInput` i18n namespace in both locales. (Onboarding wiring → #2.)

## Issue #11: Quick Add → Full Form loses typed First/Last name (and other uncontrolled fields)
- **Scenario:** 3 — Add tenant
- **Severity:** P2
- **Steps to reproduce:** On the new-tenant form in **Quick Add** mode, type First Name + Last Name (and they were observed lost). Click **"Full Form"**. The First/Last name fields are **empty** — the typed data is gone and must be re-entered.
- **Expected:** Switching Quick ↔ Full preserves everything already typed.
- **Actual:** In `QuickAddForm`, **firstName** and **lastName** are **uncontrolled** inputs (`name="firstName"` / `name="lastName"` with no `value`/`onChange` — [TenantForm.tsx:297,302](components/dashboard/TenantForm.tsx#L297-L302)). Their values live only in the DOM. Toggling mode (`setQuickMode(false)`) unmounts QuickAddForm and mounts the full form, so those DOM nodes are destroyed and the values vanish. By contrast, **phone, nationality, idType, idNumber, tenantType, source** ARE lifted to parent state ([lines 424-436](components/dashboard/TenantForm.tsx#L424-L436)) and **do** persist across the toggle — confirming the mechanism. Other uncontrolled quick fields (e.g. email if present) would be lost too.
- **Root cause:** firstName/lastName were never lifted into the shared parent state that survives the mode switch.
- **Proposed fix:** Lift `firstName` and `lastName` (and any other quick fields not yet controlled — e.g. email) into `useState` in the parent `TenantForm`, pass value+setter down to both QuickAddForm and the full form, and bind them as controlled inputs in both (full form currently uses `defaultValue`, which also won't reflect lifted state on remount — switch to `value`/`onChange`). Then the toggle preserves all input. Verify the duplicate-ID async check still works after lifting.
- **Files affected:** [components/dashboard/TenantForm.tsx](components/dashboard/TenantForm.tsx).
- **Status:** ✅ Fixed — lifted `firstName`/`lastName` into parent `useState`; both QuickAddForm and the full form now bind them as controlled `value`/`onChange` inputs, so the Quick↔Full toggle preserves the typed names. `handleSubmit` injects them into FormData from state.

## Issue #12: Disable modal tenant form for now
- **Scenario:** 3 — Add tenant
- **Severity:** P2
- **Steps to reproduce:** "Add Tenant" opens a modal/slide-over (intercepted route) instead of the full page.
- **Expected:** Navigate to the full `/dashboard/tenants/new` page (no modal) — same decision as Issue #4.
- **Actual:** [app/dashboard/@modal/(.)tenants/new/page.tsx](app/dashboard/@modal/(.)tenants/new/page.tsx) + [app/dashboard/@modal/CreateTenantModal.tsx](app/dashboard/@modal/CreateTenantModal.tsx) intercept the route.
- **Root cause:** Same intercepting-route UX as #4.
- **Proposed fix:** Covered by Issue #4 — disabling the three `(.)…/new` interceptors handles tenants too. Listed separately only for tracking; **fix together with #4.**
- **Files affected:** Same as #4.
- **Status:** ✅ Fixed (via #4) — the `(.)tenants/new` interceptor and orphaned `CreateTenantModal.tsx` were removed; "Add Tenant" now opens the full `/dashboard/tenants/new` page.

## Issue #13: After editing a tenant, the user is not redirected to the tenant detail page
- **Scenario:** 4 — Add tenant (corporate); noticed via edit flow
- **Severity:** P2
- **Steps to reproduce:** Open an existing tenant → Edit → change a field → Save. A "Tenant updated" toast appears, but the page **stays on the edit form**; no navigation happens.
- **Expected:** After a successful edit, redirect to the tenant detail page (`/dashboard/tenants/<id>`), consistent with the create flow's redirect-to-detail.
- **Actual:** The submit handler only navigates when **creating**: the redirect is wrapped in `if (!isEdit && res.id) { … }` ([TenantForm.tsx:481-488](components/dashboard/TenantForm.tsx#L481-L488)). On edit (`isEdit === true`) it shows the toast and returns without any `router.push`. `updateTenant` does return `{ success, id }` and revalidates paths, so the data is fresh — only the navigation is missing.
- **Root cause:** Edit branch was never given a redirect; the `!isEdit` guard excludes it.
- **Proposed fix:** Add an edit-mode redirect. e.g. after the toast: `if (isEdit) router.push(\`/dashboard/tenants/${initialData!.id}\`)` (or use `res.id`). Keep the `onSuccess` callback path for the modal/booking-engine inline-create case. **Note the tension with Issue #8:** #8 asks *create* to go to the *list* page, while this issue asks *edit* to go to the *detail* page — they are different modes, so both can coexist: create → list, edit → detail. Make sure the fix for #8 (which proposed changing create destinations) does not also change edit, and that this fix only touches the edit branch.
- **Files affected:** [components/dashboard/TenantForm.tsx](components/dashboard/TenantForm.tsx).
- **Status:** ✅ Fixed — `handleSubmit` now branches: edit → `router.push('/dashboard/tenants/<id>')` (detail), create → `/dashboard/tenants` (list, per #8). The `onSuccess` inline-create path is preserved.

## Issue #14: Reservation list filter labels render raw i18n keys
- **Scenario:** 6 — Create daily reservation
- **Severity:** P2
- **Steps to reproduce:** `/dashboard/reservations` → filter labels show literal keys: `:reservations.sourceLabel`, `:reservations.rateTypeLabel`, `:reservations.dateLabel`, `:reservations.propertyLabel` (and `unitsLabel`).
- **Expected:** Localized labels ("Source:", "Rate Type:", "Date:", "Property:", "Units").
- **Actual:** [ReservationsView.tsx](app/dashboard/reservations/ReservationsView.tsx) (namespace `reservations`) requests `sourceLabel/rateTypeLabel/dateLabel/propertyLabel/unitsLabel`, **missing in en.json & ar.json** (verified). Sibling keys `allProperties/allRateTypes/allSources` DO exist — only the `*Label` + `unitsLabel` keys drifted. **Same class as Issue #9.**
- **Root cause:** i18n key drift; catalogs not updated when filter labels were added.
- **Proposed fix:** Add the 5 missing keys under `reservations.*` in both locales. **Bundle with #9 and run a repo-wide i18n coverage sweep** — two scenarios already hit this, so other namespaces likely have gaps. Add a script that extracts `t("…")` keys per namespace and diffs against the catalogs (CI check).
- **Files affected:** [messages/en.json](messages/en.json), [messages/ar.json](messages/ar.json).
- **Status:** Open

## Issue #15: Reservation form steps are not responsive
- **Scenario:** 6 — Create daily reservation
- **Severity:** P2
- **Steps to reproduce:** Open the New Reservation wizard on a narrow viewport — the step indicator / step content layout breaks (overflow / cramped).
- **Expected:** The multi-step booking form is usable and well-laid-out on tablet/mobile widths.
- **Actual:** Layout issues in the BookingEngine step UI at small widths (tester observed).
- **Root cause:** Fixed widths / non-wrapping step header in [BookingEngine.tsx](components/dashboard/BookingEngine.tsx) (step bar near the `setStep` map ~line 443; step panels).
- **Proposed fix:** Responsive pass — wrap/stack steps on `sm`, scrollable step rail, full-width controls. Manual check at 375/768px. Pair with #17.
- **Files affected:** [components/dashboard/BookingEngine.tsx](components/dashboard/BookingEngine.tsx).
- **Status:** ✅ Fixed — step rail now `justify-between sm:justify-center` with `overflow-x-auto` and reduced mobile padding (`px-1.5 sm:px-3`) so the 5 bubbles fit/scroll at 375px (labels already hidden on mobile); panel padding relaxed to `p-4 sm:p-6`; the Step-1 header row wraps (`gap-2 flex-wrap`). Step content grids were already responsive (`grid-cols-1 sm:grid-cols-2/3`). The daily date-picker polish is tracked separately as #17.

## Issue #16: Selecting a tenant after search doesn't actually select it — booking flow blocked
- **Scenario:** 6 — Create daily reservation
- **Severity:** **P1** (blocks the core booking workflow)
- **Steps to reproduce:** New Reservation → Step 1 → type a tenant name → results appear → click a result. The tenant is **not** selected, so the user can't reliably proceed.
- **Expected:** Clicking a search result selects that tenant.
- **Actual / root cause:** In [BookingEngine.tsx:542-556](components/dashboard/BookingEngine.tsx#L542-L556), `onValueChange(v)` receives the tenant's **id**, then re-fetches `GET /api/tenants?q=<id>` and does `.find(t => t.id === v)`. But [/api/tenants](app/api/tenants/route.ts#L29-L37) searches only `firstName/lastName/phone/idNumber/email/nationality` via `contains` — it **never matches `id`**. The query returns no rows, `found` is `undefined`, `setSelectedTenant` is never called. The `raw` tenant object is already attached to each option ([line 526](components/dashboard/BookingEngine.tsx#L526)) but ignored on select.
- **Proposed fix (low-risk):** Use the attached `raw` option data instead of re-fetching: in `onValueChange`, resolve the chosen option from the loaded list and `setSelectedTenant(option.raw)`. (Cache last `loadOptions` results to map `v → raw`.) Optional: add an `?id=` exact-match branch to `/api/tenants`. Verify `defaultTenant` pre-selection (deep-link from tenant page) still works.
- **Files affected:** [components/dashboard/BookingEngine.tsx](components/dashboard/BookingEngine.tsx) (primary); optionally [app/api/tenants/route.ts](app/api/tenants/route.ts).
- **Note:** Tester completed the booking (likely via pre-selection / just-created tenant), but the click-to-select path — the normal flow — is broken.
- **Status:** ✅ Fixed — `loadOptions` now caches every searched tenant into a `tenantCache` ref (`id → raw`); `onValueChange` resolves the selection from that cache and calls `setSelectedTenant(found)` synchronously — no re-fetch by id. [BookingEngine.tsx](components/dashboard/BookingEngine.tsx)

## Issue #17: Daily date/duration picker UX is poor — align with the monthly picker
- **Scenario:** 6 — Create daily reservation
- **Severity:** P2
- **Steps to reproduce:** New Reservation → Daily → the check-in date + nights controls feel clunky vs the monthly flow.
- **Expected:** A polished date-range experience for daily stays (ideally the same calendar/range UX as monthly).
- **Actual:** Daily mode uses separate check-in date + nights inputs ([BookingEngine.tsx:663-731](components/dashboard/BookingEngine.tsx#L663-L731)); monthly mode has a nicer picker. UX inconsistency.
- **Proposed fix:** Reuse a single range/calendar component for both daily and monthly (or raise daily to the monthly picker's polish — inline calendar + night count). Design decision; pair with #15.
- **Files affected:** [components/dashboard/BookingEngine.tsx](components/dashboard/BookingEngine.tsx).
- **Status:** Open

## Issue #18: Reservation number is global, not org-scoped (first booking got RES-2026-00140); make format configurable
- **Scenario:** 6 — Create daily reservation
- **Severity:** **P1** (multi-tenant leak + collision risk + wrong numbering)
- **Steps to reproduce:** Create the first reservation in a fresh org → it gets `RES-2026-00140` instead of `RES-2026-00001`.
- **Expected:** Per-org sequence starting at 1 (`RES-2026-00001`), in a format configurable from Reservation Settings.
- **Actual / root cause:** [generateReservationNumber()](app/api/reservations/route.ts#L37-L41) computes `prisma.reservation.count()` **across ALL organizations** (no `where`), then `count + 1`. The DB has 139 seeded reservations in other orgs → the QA org's first booking became 00140. Verified: total (all orgs)=140, QA org=1, number=`RES-2026-00140`.
- **Three problems:** (1) **Multi-tenancy violation** — the number leaks global cross-company volume (CLAUDE.md: never expose cross-company data). (2) **Race condition** — `count()+1` isn't atomic; concurrent creates can collide. (3) Not configurable.
- **Proposed fix:**
  - Scope the count to the actor's `organizationId`, OR better, use a per-org monotonic counter incremented in the same transaction as the create (or unique-constrained insert-and-retry) to avoid races.
  - Add a **configurable format** in Reservation Settings (prefix, year token, padding width, reset-yearly) stored on the Organization and read by the generator.
  - Add a **unique constraint** on `(organizationId, reservationNumber)`.
- **Files affected:** [app/api/reservations/route.ts](app/api/reservations/route.ts), [prisma/schema.prisma](prisma/schema.prisma), [app/dashboard/settings/reservations/](app/dashboard/settings/reservations/).
- **Status:** ✅ Fixed (leak + race) — Schema: added `Reservation.organizationId` (backfilled from `tenant.organizationId`, NOT NULL), replaced the global `@unique` on `reservationNumber` with `@@unique([organizationId, reservationNumber])` + index. Generator rewritten to `generateReservationNumber(orgId, tx)` — per-org, year-reset, `RES-YYYY-NNNNN`, called inside the existing Serializable txn (mirrors `nextInvoiceNumber`); the composite unique is the race backstop. `organizationId` now set on create. **Deferred:** configurable format (prefix/padding/reset) UI → new **Issue #29 (P2)**.

## Issue #19: Unit name in reservation (detail) is not clickable to the unit page
- **Scenario:** 6 — Create daily reservation
- **Severity:** P3
- **Steps to reproduce:** On a reservation detail page, the unit name is plain text — clicking does nothing.
- **Expected:** Unit name links to `/dashboard/units/<unitId>`.
- **Actual:** Reservation detail renders the unit name as text, not a `Link` (tenant name IS linked — [ReservationDetail.tsx:1883](app/dashboard/reservations/[id]/ReservationDetail.tsx#L1883) — unit isn't).
- **Proposed fix:** Wrap the unit name in `<Link href={\`/dashboard/units/${unitId}\`}>` in the detail (and consider the list columns for consistency).
- **Files affected:** [app/dashboard/reservations/[id]/ReservationDetail.tsx](app/dashboard/reservations/[id]/ReservationDetail.tsx); optionally [app/dashboard/reservations/columns.tsx](app/dashboard/reservations/columns.tsx).
- **Status:** ✅ Fixed — the unit name in the reservation detail "Units" section is now a `Link` to `/dashboard/units/<unitId>`. (List columns left as-is for now.)

## Issue #20: No Check-In button before start date even though "Allow early check-in" is enabled
- **Scenario:** 6 — Create daily reservation
- **Severity:** **P1** (early check-in unusable from the UI)
- **Steps to reproduce:** Today 2026-06-02, reservation starts 2026-06-10, Settings → Allow early check-in = ON. No Check-In button (status displays "Upcoming").
- **Expected:** With `allowEarlyCheckIn` true, the Check-In action is available for upcoming reservations; when false, hidden/blocked before start date.
- **Actual / root cause:** UI gating ignores the setting. [ReservationsView.tsx:577](app/dashboard/reservations/ReservationsView.tsx#L577): `canCheckIn = ds === "Arriving Today" || ds === "Overdue Arrival";` — "Upcoming" never qualifies regardless of `allowEarlyCheckIn`. The **API already supports early check-in** ([check-in/route.ts:76-90](app/api/reservations/[id]/check-in/route.ts#L76-L90) blocks only when `allowEarlyCheckIn === false` and today < start) — backend fine; only button gating is wrong. Same gating likely in detail page + [TodayView.tsx](components/dashboard/views/TodayView.tsx).
- **Proposed fix:** Thread org `allowEarlyCheckIn` into reservation views; extend `canCheckIn` to include "Upcoming" when the setting is true (and status is check-in-able per `canTransitionTo`). Keep the API guard as source of truth. Audit all check-in button sites.
- **Files affected:** [app/dashboard/reservations/ReservationsView.tsx](app/dashboard/reservations/ReservationsView.tsx), [app/dashboard/reservations/[id]/ReservationDetail.tsx](app/dashboard/reservations/[id]/ReservationDetail.tsx), [components/dashboard/views/TodayView.tsx](components/dashboard/views/TodayView.tsx). Field exists: `Organization.allowEarlyCheckIn` ([schema:165](prisma/schema.prisma#L165)).
- **Status:** ✅ Fixed — `allowEarlyCheckIn` is now fetched in both reservation server pages ([list page.tsx](app/dashboard/reservations/page.tsx), [detail page.tsx](app/dashboard/reservations/[id]/page.tsx)) and passed as a prop. `canCheckIn` in the list now includes `"Upcoming"` when the setting is on; the detail `ActionButtons` "Upcoming" case renders a Check-In button gated on the same flag. **TodayView intentionally untouched** — it only lists *today's* arrivals, never future "Upcoming" reservations, so early check-in does not surface there. API guard remains the source of truth.

## Issue #21: Availability modal — "Show" is disabled under "All Properties"; add a property selector
- **Scenario:** 6 — Create daily reservation (availability check)
- **Severity:** P2
- **Steps to reproduce:** Header property selector = **"All Properties"** → open Availability modal → **Show** is disabled; can't check availability.
- **Expected:** Under "All Properties", the modal offers its own property selector (or defaults to one); under a selected property, use that.
- **Actual / root cause:** [AvailabilityCalendar.tsx:114-116](components/dashboard/AvailabilityCalendar.tsx#L114-L116) sets `propertyId = defaultPropertyId ?? properties[0]?.id ?? ""`. With header = All Properties, `defaultPropertyId` is empty. The in-modal `<select>` only renders when `properties.length > 1` ([~line 222](components/dashboard/AvailabilityCalendar.tsx#L222)), and the Show button is `disabled={!propertyId || …}` ([line 290](components/dashboard/AvailabilityCalendar.tsx#L290)) — so if `propertyId` is `""`, Show stays disabled.
- **Proposed fix:** When `defaultPropertyId` is empty (All Properties), always show the property selector and require/auto-pick a selection (e.g. `properties[0]`) so Show is enabled; when set, lock to the header's property. Ensure `propertyId` is never `""` when properties exist.
- **Files affected:** [components/dashboard/AvailabilityCalendar.tsx](components/dashboard/AvailabilityCalendar.tsx).
- **Status:** ✅ Fixed — the initial `propertyId` now uses `||` instead of `??`, so the empty-string `defaultPropertyId` from "All Properties" falls through to `properties[0]`. The picker (rendered when `properties.length > 1`) lets the user switch; "Show" is enabled because `propertyId` is never empty when properties exist.

## Issue #22: Availability split-day half-square points the wrong way in Arabic/RTL
- **Scenario:** 6 — Create daily reservation (availability, Arabic mode)
- **Severity:** P3
- **Steps to reproduce:** Switch to Arabic (RTL), open Availability calendar — the split-day cell's diagonal renders in the wrong direction.
- **Expected:** In RTL the diagonal/half-fill mirrors so the occupied half is on the correct side.
- **Actual / root cause:** [AvailabilityCalendar.tsx:531](components/dashboard/AvailabilityCalendar.tsx#L531) hardcodes `linear-gradient(135deg, leftColor 50%, rightColor 50%)`. The fixed 135° angle doesn't flip under RTL, so direction is inverted relative to the mirrored layout.
- **Proposed fix:** Make the gradient direction-aware — switch `135deg`↔`45deg` (or swap left/right colors) based on `dir==='rtl'`/locale. Apply to the split cell and the legend swatch ([line 568](components/dashboard/AvailabilityCalendar.tsx#L568)).
- **Status:** ✅ Fixed — added an `isRtl` flag (`locale === "ar"`) and the split cell now uses `linear-gradient(${isRtl ? 225 : 135}deg, …)`, a horizontal mirror of the diagonal so the earlier-half color stays on the correct side in RTL. (No separate legend gradient swatch exists in the current markup — only the one cell gradient.)

## Issue #23: Edit Reservation 404s — the edit route is not implemented
- **Scenario:** 6 — Create daily reservation
- **Severity:** **P1** (advertised action is broken)
- **Steps to reproduce:** Reservation detail → click **Edit** → 404 / nothing usable.
- **Expected:** Editing a reservation opens a working edit flow.
- **Actual / root cause:** Detail page links to `/dashboard/reservations/<id>/edit` ([ReservationDetail.tsx:1603,1626](app/dashboard/reservations/[id]/ReservationDetail.tsx#L1603)) but **no `edit` route exists** under `app/dashboard/reservations/[id]/` (confirmed). No `PUT`/`PATCH` handler on [/api/reservations/[id]](app/api/reservations/[id]/route.ts) for general edits either. Edit button leads nowhere.
- **Proposed fix:** Implement the edit flow: (a) `app/dashboard/reservations/[id]/edit/page.tsx` reusing BookingEngine (or a dedicated edit form) pre-filled with the reservation; (b) an update API (`PUT /api/reservations/[id]`) that re-validates availability (`getUnitConflict` excluding the current reservation), recomputes pricing, and guards immutable states (checked-out/cancelled, or reservations with issued invoices). Scope carefully — date/unit edits interact with invoices & double-booking. Until built, consider hiding the Edit button to remove the dead link.
- **Files affected:** new `app/dashboard/reservations/[id]/edit/` route, [app/api/reservations/[id]/route.ts](app/api/reservations/[id]/route.ts), reuse [components/dashboard/BookingEngine.tsx](components/dashboard/BookingEngine.tsx), [app/dashboard/reservations/[id]/ReservationDetail.tsx](app/dashboard/reservations/[id]/ReservationDetail.tsx).
- **Status:** ✅ Stopgap applied — both `/edit` `<Link>`s removed from the detail `ActionButtons` (Upcoming + Arriving/Overdue cases), so there is no dead 404 link; unused `PencilSquareIcon` import dropped. The full edit flow (new route + `PUT` API + availability/pricing/invoice guards) is tracked as new **Issue #30 (P1)**.

## Issue #24: Add settings to require contract creation/signing before check-in (feature)
- **Scenario:** 7 — Create monthly reservation (flagged proactively by user before forgetting)
- **Severity:** **P1** (workflow gate; user flagged as "crucial" — legal/compliance + operational)
- **Type:** Feature / settings enhancement, not a bug
- **Requested behavior:** Add Reservation Settings that gate check-in behind contract status. Two toggles to consider:
  1. **`requireContractBeforeCheckIn`** — when ON, a reservation cannot be checked in until a contract record exists (and optionally is **signed**).
  2. **`autoCreateContractOnConfirm`** (or "on reservation create") — automatically generate a draft contract from the reservation + tenant data so receptionists don't forget. Owner/manager-configurable.
- **Why crucial (per user):** In Oman PMS practice, the signed contract is the legal basis for occupancy — long-term monthly stays especially. Allowing check-in without one creates liability and disputes (ID copy, terms, deposit, signatures). For short-term daily stays the bar may differ — make policy configurable per-property or per-rate-type if possible.
- **Proposed design (rough):**
  - **Data model:** A `Contract` table linked 1-1 (or 1-many for amendments) to a `Reservation`. Fields: status (`DRAFT/ISSUED/SIGNED/CANCELLED`), pdfUrl (React-PDF), signedAt, signedByName, terms snapshot, deposit info. Bilingual EN/AR PDF (per CLAUDE.md PDF rules).
  - **Settings:** Extend the Reservations Settings page (where `allowEarlyCheckIn` lives — `Organization.allowEarlyCheckIn` per [schema:165](prisma/schema.prisma#L165)) with two booleans: `requireContractBeforeCheckIn`, `autoCreateContractOnConfirm`. Owner/Manager only.
  - **Check-in API guard:** In [check-in/route.ts](app/api/reservations/[id]/check-in/route.ts) (alongside the existing `allowEarlyCheckIn` check at L76-90), if `requireContractBeforeCheckIn === true`, block with a clear error when no contract exists (and optionally when status ≠ SIGNED). Mirror the UI button gating (see #20).
  - **UI:** On reservation detail, surface a Contract section (generate / view / mark signed) with status. When the setting is on but contract missing, replace the Check-In button with a "Create Contract First" CTA.
- **Open decisions for the user:**
  - Apply to **all** reservations, or distinguish **monthly vs daily**? (Monthly almost certainly yes; daily maybe optional.)
  - Should "signed" be enforced electronically (e-sig flow) or just an attestation toggle ("contract printed and signed in-person") by staff?
  - Where the deposit amount belongs (contract vs reservation).
- **Dependencies:** Touches Reservation Settings (related to #20), check-in flow, adds a new Contracts domain to the codebase. **Significant scope** — likely a separate sprint slice.
- **Files affected (planned):** new `prisma/schema.prisma` `Contract` model, new `app/dashboard/contracts/` and/or contract section under reservation detail, new `app/api/contracts/` routes, [app/dashboard/settings/reservations/](app/dashboard/settings/reservations/), [app/api/reservations/[id]/check-in/route.ts](app/api/reservations/[id]/check-in/route.ts), [components/dashboard/views/TodayView.tsx](components/dashboard/views/TodayView.tsx) (button gating).
- **Status:** Open — captured per user request; defer implementation until the existing P1s are fixed.

## Issue #25: Corporate tenant — company name shown too small on reservation page (contact too prominent)
- **Scenario:** 8 — Multi-unit reservation (Hassan Al Wahaibi / Salalah Marine Services LLC)
- **Severity:** P2 (B2B identity / receptionist clarity)
- **Steps to reproduce:** Reservation page for a **corporate** tenant → contact-person name (Hassan Al Wahaibi) is rendered as the primary/large heading; the **company name** (Salalah Marine Services LLC) renders in small text underneath, easy to miss.
- **Expected:** For `tenantType === 'corporate'`, **the company name is the primary identity** (large/heading), and the contact person is the secondary line ("Contact: Hassan Al Wahaibi"). For `tenantType === 'individual'`, keep the current person-first layout. This matches B2B reality — the contract/invoice is to the company, not the contact.
- **Actual:** Detail header always treats `firstName + lastName` as primary regardless of tenant type, so corporate clients look like personal bookings at a glance.
- **Root cause:** Reservation detail header doesn't branch on `tenant.tenantType`; it renders person-name first universally.
- **Proposed fix:** In the reservation detail header (and likely list columns + cards):
  - When `tenant.tenantType === 'corporate'` and `tenant.corporateName` is set, render `corporateName` as the heading and `corporateContact ?? \`${firstName} ${lastName}\`` as the secondary "Contact:" line.
  - When individual, keep the current layout.
  - Audit other places that show the tenant identity (reservation list row, today view, invoices, contracts, PDFs) to apply the same rule consistently.
- **Files affected (likely):** [app/dashboard/reservations/[id]/ReservationDetail.tsx](app/dashboard/reservations/[id]/ReservationDetail.tsx), [app/dashboard/reservations/columns.tsx](app/dashboard/reservations/columns.tsx), [components/dashboard/views/TodayView.tsx](components/dashboard/views/TodayView.tsx). DB confirms: `firstName="Hassan"`, `corporateName="Salalah Marine Services LLC"`, `corporateContact="Hassan Al Wahaibi"`, `tenantType="corporate"` — fields all present, just under-used by the UI.
- **Status:** ✅ Fixed (reservation detail) — for `corporate`/`government` tenants with a `corporateName`, the detail guest card now renders the **company name as the heading**, the person as a secondary "Contact: …" line (new `reservations.detail.guest.contactPerson` key in both locales), and the avatar uses the company initials; individuals keep the person-first layout. Added `corporateContact` to the reservation GET select + detail type. The redundant 🏢 company stat now only shows for individuals with an associated company. **Follow-up (not done):** apply the same rule to the reservation **list columns**, **TodayView**, invoices, and PDFs — these need `tenantType`/`corporateName` plumbed through their data fetches. Tracking as a future task.

## Issue #26: Add Seasonal Price modal — monthly rate is required, should be optional
- **Scenario:** 10 — Seasonal pricing setup (Khareef on Unit 6)
- **Severity:** P2 (blocks short-term-only properties from setting seasonal pricing without dummy values)
- **Steps to reproduce:** Unit detail → Pricing → Add Seasonal Price → enter only daily rate → submit. Form blocks because monthly rate is required, even though many seasonal-pricing use cases are daily-only (Khareef short-term tourism).
- **Expected:** Monthly rate is **optional** in the seasonal price form. If omitted, the existing DEFAULT monthly rate continues to apply during the season (or the engine falls back to DEFAULT for any rate type the seasonal record doesn't override).
- **Actual / root cause:** [UnitPricingSection.tsx:428](components/dashboard/units/UnitPricingSection.tsx#L428) — the `monthlyRate` input has `required` set. (DEFAULT prices in the DB DO need both rates, but SEASONAL overrides shouldn't require both.) Likely a matching server-side validation also rejects missing `monthlyRate`.
- **Proposed fix:**
  - Drop `required` from the monthly input when `priceType === 'SEASONAL'` (keep it for DEFAULT).
  - Make `monthlyRate` nullable in the action/validator for SEASONAL rows (schema already allows `monthlyRate` as Decimal — if NOT NULL, may need a migration; otherwise just relax the input validation).
  - Engine impact: `getUnitPriceForRange()`/`calculateUnitTotal()` already pick a price record per night via priority — when a seasonal record has no `monthlyRate`, fall back to DEFAULT for monthly stays in that window (or treat the seasonal record as daily-only).
- **Files affected:** [components/dashboard/units/UnitPricingSection.tsx](components/dashboard/units/UnitPricingSection.tsx), seasonal price create/update action, [utils/pricing](utils/) (verify fallback behavior), [prisma/schema.prisma](prisma/schema.prisma) (if `monthlyRate` is NOT NULL).
- **Status:** Open

## Issue #27: Add settings to prevent monthly reservations during certain periods (feature)
- **Scenario:** 10 — Seasonal pricing setup (user-flagged proactively)
- **Severity:** P2 (revenue-management feature; common Salalah business rule during Khareef)
- **Type:** Feature / settings enhancement, not a bug
- **Requested behavior:** Allow the org to block monthly-rate-type reservations within a configured date range. Use case: during Khareef the owner wants to maximize short-term daily bookings at premium rates and **prevent long-term monthly leases** from locking up units cheaply.
- **Proposed design (two options):**
  1. **Piggyback on Seasonal Price:** Add a boolean `disallowMonthly` (and/or `disallowDaily`) on the `UnitPrice` SEASONAL record. The booking API rejects rate-type X when any active seasonal record covering the requested range has `disallow{X}=true`. Simple, lives near the existing pricing UI.
  2. **Separate Blackout/Restriction model:** New `BookingRestriction` model (property or unit scoped, date range, blocked rate types). More flexible but more scope.
- **Recommended:** Option 1 (extend `UnitPrice`) — it co-locates pricing and rate-type policy, matches existing seasonal UI, and is one new column.
- **Where it plugs in:** Pricing rule check in [POST /api/reservations](app/api/reservations/route.ts) and the BookingEngine availability/rate-type step (gray out "Monthly" if the date range overlaps a `disallowMonthly` seasonal record).
- **Open decisions for the user:**
  - **Scope:** per-unit (via UnitPrice) or per-property (so one toggle covers all units in a building)? Per-property may be more practical for managers.
  - **Existing monthly bookings that span into a blocked period:** what happens — allow if the booking was created before the rule, or block retroactively?
  - **UI surface:** alongside seasonal price form, or in Reservations Settings?
- **Dependencies:** Lands well alongside #26 (seasonal price form refinements). Smaller scope than #24 (contract).
- **Files affected (planned):** [prisma/schema.prisma](prisma/schema.prisma) (add column), [components/dashboard/units/UnitPricingSection.tsx](components/dashboard/units/UnitPricingSection.tsx) (toggle in form), [app/api/reservations/route.ts](app/api/reservations/route.ts) (enforcement), [components/dashboard/BookingEngine.tsx](components/dashboard/BookingEngine.tsx) (UI hint).
- **Status:** Open — captured per user request; bundle into a small "seasonal pricing v2" sprint slice with #26.

## Issue #29: Configurable reservation-number format (split from #18)
- **Scenario:** 6 — Create daily reservation
- **Severity:** P2
- **Type:** Feature / settings enhancement (the multi-tenancy/race part of #18 is already ✅ fixed).
- **Requested behavior:** Let owners/managers configure the reservation-number format in Reservation Settings — prefix (e.g. `RES`), whether to include the year token, zero-padding width, and reset-yearly vs continuous.
- **Proposed design:** Add fields on `Organization` (e.g. `reservationNumberPrefix`, `reservationNumberPadding`, `reservationNumberResetYearly`), read them in `generateReservationNumber()`, and surface them in [app/dashboard/settings/reservations/](app/dashboard/settings/reservations/). Mirror could later apply to invoice/payment numbers for consistency.
- **Files affected:** [prisma/schema.prisma](prisma/schema.prisma), [app/api/reservations/route.ts](app/api/reservations/route.ts), [app/dashboard/settings/reservations/](app/dashboard/settings/reservations/).
- **Status:** Open

## Issue #30: Full Edit Reservation flow (split from #23)
- **Scenario:** 6 — Create daily reservation
- **Severity:** **P1**
- **Steps to reproduce:** A receptionist needs to change a reservation's dates/units/rate after creation. The Edit button was removed (stopgap for #23), so there is currently no edit path at all.
- **Proposed fix:** Build the real flow — (a) `app/dashboard/reservations/[id]/edit/page.tsx` reusing BookingEngine in an edit mode (prefill tenant/units/dates/rates), (b) `PUT /api/reservations/[id]` that re-validates availability with `getUnitConflict` excluding the current reservation, recomputes pricing + `pricingSegments`, and guards immutable states (CHECKED_IN past actions, CANCELLED, COMPLETED, or any reservation with issued/non-cancelled invoices). Restore the Edit buttons in [ReservationDetail.tsx](app/dashboard/reservations/[id]/ReservationDetail.tsx) once live.
- **Dependencies:** Interacts with invoices (#11+) and double-booking. Scope carefully; likely its own slice.
- **Status:** Open

## Issue #31: Show seasonal segment breakdown on unit card during selection (split from #28)
- **Scenario:** 10 — Seasonal pricing across Khareef boundary
- **Severity:** P2
- **Steps to reproduce:** During unit selection, a unit whose stay spans >1 price segment shows a flat "25 OMR / night" on its card even though the summary total is correct. (The underlying data is now persisted — see #28.)
- **Proposed fix:** When the requested range spans >1 price segment for a unit, render a small breakdown on the card (`3 × 25 + 4 × 45`) or a blended-rate label + "View breakdown" tooltip. The summary step already computes segments — reuse the same component. Can read from the same segment math now persisted as `pricingSegments`.
- **Files affected:** [components/dashboard/BookingEngine.tsx](components/dashboard/BookingEngine.tsx).
- **Status:** Open

## Issue #28: Seasonal price breakdown not shown on unit card during selection — AND not persisted on reservationUnit
- **Scenario:** 10 — Seasonal pricing across Khareef boundary (Unit 6, Jun 28 → Jul 5)
- **Severity:** **P1** (two problems — surface UX issue is P2, underlying data-model gap is P1 because it will distort invoices/receipts/reports downstream)
- **Surface symptom (what user reported):** During unit selection, the Unit 6 card displays **"25 OMR / night"** even though the stay spans Khareef. The grand total shown at the summary step is correct (255.000), but the per-unit card during selection is misleading.
- **Underlying root cause (worse than UI):** The reservation creation DOES compute the segment math correctly (`grandTotal=255`), **but the breakdown is not persisted.** [DB verified] On the saved `reservationUnit` row: `rateAmount=25`, `rateSource="default_price"`, `seasonalPriceName=null`. The 3-night-DEFAULT + 4-night-SEASONAL split exists only in the booking wizard's transient calculation — after save, the row claims the whole stay was 25/night. Anywhere that re-reads `reservationUnit` (related-bookings views, invoices, receipts, PDFs, reports) will show 25/night, contradicting the 255 total.
- **Why it matters beyond the unit card:** Invoicing (Scenario #11 next), payment receipts, and revenue/aging reports will all need the per-segment data to render line items correctly ("3 nights × 25 + 4 nights × 45"). Without persistence, every downstream feature has to recompute from prices + dates, and any drift (price edits, season edits, deleted seasonal records) breaks history.
- **Proposed fix (two layers):**
  1. **Persist segments (the real fix):** Either (a) store an array of `{ startDate, endDate, nights, rateAmount, rateSource, seasonalPriceName }` on the reservationUnit (e.g. JSON column `pricingSegments` or a new `ReservationUnitPricingSegment` table), or (b) bump rateAmount to a weighted/blended rate and store the segments alongside. Snapshot at creation time so later price/season edits don't rewrite history.
  2. **UI on unit card:** When the requested date range spans >1 price segment for that unit, render the card as either a small breakdown (`3 × 25 + 4 × 45`) or at minimum a blended-rate label + a "View breakdown" hover/tooltip. The summary step already shows the breakdown — reuse the same component.
- **Files affected:** [prisma/schema.prisma](prisma/schema.prisma) (add `pricingSegments` JSON or new join table), [app/api/reservations/route.ts](app/api/reservations/route.ts) (write segments at create), [components/dashboard/BookingEngine.tsx](components/dashboard/BookingEngine.tsx) (per-unit breakdown on card), reservation detail / invoice templates / receipts.
- **Cross-link:** This issue must be fixed **before** invoice generation (Scenario #11) lands properly — invoices need the segments to render line items. Pair with #26/#27 in the seasonal-pricing-v2 sprint.
- **Status:** ✅ Persistence fixed (the load-bearing P1) — added `ReservationUnit.pricingSegments Json?`. The create route now snapshots the full segment array for every unit: daily uses `collapseToSegments(...)`, monthly uses `buildCalendarMonthBreakdown(...)`, and manual overrides write a single segment. Each segment stores `{label, startDate, endDate, nights, rateAmount, rateSource, seasonalPriceName, subtotal}`. `rateAmount`/`rateSource`/`seasonalPriceName` on the row stay as the first segment for back-compat. So a Khareef-spanning stay now persists `3×25 + 4×45` instead of claiming a flat 25/night. **Deferred:** the unit-card breakdown UI during selection (P2 surface symptom) → new **Issue #31 (P2)**. Downstream readers (invoices/receipts/reports) can now consume `pricingSegments`.
