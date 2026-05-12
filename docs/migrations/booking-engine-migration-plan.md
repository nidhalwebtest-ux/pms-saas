# BookingEngine — migration plan

Phase 1 analysis for migrating `components/dashboard/BookingEngine.tsx` to the
new form-field system. Audit only — no code changes.

- **File:** `components/dashboard/BookingEngine.tsx`
- **Size today:** 1286 lines
- **Form components available:** all 17 (see `components/ui/form/`)
- **Goal:** prove the form system works at production scale + surface any gaps
  that need filling before migrating BookingEngine.

---

## 1. Field inventory + replacement map

### Step 1 — Tenant (lines 519-658)

| Field | Current | New target | Notes |
| --- | --- | --- | --- |
| Tenant search | Custom controlled `<input>` (L565) + bespoke dropdown panel (L587) with row rendering of avatar + name + `ClassBadge` + phone + nationality + "Create one" empty-state link | `SearchableSelect` with `loadOptions` + `onCreate` | **Gap** — see §3 D1. SearchableSelect supports `option.description` but not the full avatar + badge row rendering. |
| Selected-tenant card | Custom card colored by classification (L626-647) with VIP/blacklisted/regular tinting + `ClassBadge` + check icon | **Keep bespoke** | This is domain UI (status-colored confirmation panel), not a generic form field. |
| Blacklisted warning banner | Conditional alert (L650-654) | **Keep bespoke** | Will move to a future `Alert` primitive (see open follow-ups in form-fields docs). |
| "Add new tenant" toggle | Inline `<button>` (L523) + embedded `<TenantForm>` (L542) | **Keep bespoke** | The toggle is a workflow switch, not a field. The embedded `<TenantForm>` is its own form. |

### Step 2 — Dates (lines 660-805)

| Field | Current | New target | Notes |
| --- | --- | --- | --- |
| Property selector | `<select>` (L668) bound to `propertyId` state | `Select` | Direct replacement. Maps to `options={[{value: id, label: name}]}`. |
| Rate type (daily/monthly) | Custom 2-button segmented control (L681-694) | `RadioGroup` *or* keep inline | **Decision needed** (D6). RadioGroup `variant="cards"` is a candidate but the current segmented buttons live in one row; a clean 2-button radio would match. Recommend small inline keep — workflow switch, not a "field". |
| Check-in date | `<input type="date">` (L721) | `DatePicker` | Direct replacement. Needs locale prop — see Gap D2. |
| Period (nights or months) | `<input type="number">` (L739) + manual ± stepper buttons (L735, L747) | `NumberField` with `stepper={true}` | **Gap** — see §3 D3. NumberField spec mentions `stepper` prop but it's not implemented. Either add it (~30 LoC) or keep the inline buttons + plain NumberField. |
| Check-out date | `<input type="date" min={startDate}>` (L768) when daily; read-only display when monthly | `DatePicker` with `minDate={startDate}` in daily mode; keep read-only display in monthly mode | Conditional rendering preserved as-is. |
| Calendar range mode (daily only) | `<DayPicker mode="range" numberOfMonths={2}>` (L781) toggled by `calMode` | `DateRangePicker` | **Opportunity** to eliminate the `calMode` toggle entirely — `DateRangePicker` is the spec's intended replacement. See D4. |
| Duration summary chip | Conditional blue banner (L794) | **Keep bespoke** | Computed display, not a field. |

### Step 3 — Units (lines 807-1057)

| Field | Current | New target | Notes |
| --- | --- | --- | --- |
| Conflict error panel | Custom red banner with reservation details (L811) | **Keep bespoke** | Server-error display. Will move to future `Alert` primitive. |
| Unit type filter chips | Pill buttons (L862) — ALL / STUDIO / 1BR / 2BR / 3BR / SUITE | **Keep bespoke** | Filter navigation. Belongs to a future `Tabs` / `SegmentedControl` primitive (already in `docs/component-inventory.md`). |
| Unit selection cards | Grid of bespoke cards (L887+) with status badge, name, beds/baths/area, rate, price-tag, hover/selected states, and inline custom-rate inputs | **Keep bespoke** | This is domain-specific UI. Neither `MultiSelect` (chip-based UX) nor `CheckboxGroup` (basic checkboxes) renders rich cards with this content. The card pattern is closer to a future `CheckboxCard` / `SelectCard` primitive — out of scope for this session. |
| Custom rate input per unit | `<input type="number">` (L1002) | `NumberField` with `currency="OMR"` (precision=3) | One per selected unit. Direct replacement. |
| Custom total input per unit | `<input type="number">` (L1033) | `NumberField` with `currency="OMR"` (precision=3) | One per selected unit. Direct replacement. Mutually exclusive with custom rate — same logic, just sources of value swap. |

### Step 4 — Details (lines 1059-1195)

| Field | Current | New target | Notes |
| --- | --- | --- | --- |
| Discount amount | `<input type="number" step="0.001">` (L1142) | `NumberField` with `currency="OMR"` | Direct replacement. |
| Source | `<select>` (L1152) | `Select` | Direct replacement. Maps `SOURCE_KEYS` (walk_in / referral / online / agent / returning / corporate_contract) to options[]. |
| Notes | `<textarea rows={2} resize-none>` (L1165) | `TextArea` with `minRows={2}` `maxRows={6}` | Direct replacement. Auto-resize is a bonus. |

### Step 5 — Confirm (lines 1197-1259)

| Element | Current | Action |
| --- | --- | --- |
| Tenant / dates / units / total summary cards | Read-only display | **Keep bespoke** — these are confirmation-step summary panels, not form fields. |
| Submit button | Inline `<button>` (L1251) with custom rounded-xl shadow styling | **Migrate to `Button`** | Already Phase 3 territory but easy to fold in. Use `<Button variant="primary" size="lg" fullWidth loading={submitting}>`. |

### Out of scope (deliberately not migrating)

| Element | Reason |
| --- | --- |
| Step indicator nav (L482-516) | UI navigation, not a form field. |
| Footer Back / Next buttons (L1263+) | Could migrate to `Button variant="ghost"` and `Button variant="primary"`. Small win — **fold in to Phase 3 too**. |
| `ClassBadge` (L118) | This is a local Badge wrapper that's already handled by Phase 4-A of the badge migration. Use `getTenantClassBadge` instead. |

---

## 2. Custom behaviors that must be preserved

11 behaviors. Each must be untouched by the migration.

1. **Tenant search debounce 350 ms** → fetch `/api/tenants?q=` → render results → select. (Current `SearchableSelect` debounces at 250 ms — see Gap D5.)
2. **"Create one" inline action** when search returns no results → opens `TenantForm` quick-add modal.
3. **Blacklisted warning banner** appears under the selected tenant card when classification is blacklisted.
4. **Rate-type change side-effects:** clears selected units + custom rates + custom totals, re-snaps period and endDate based on new mode (`handleRateTypeChange`).
5. **Start-date / period bidirectional sync:** changing one recomputes endDate using `addDays` (daily) or `addCalendarMonths` (monthly).
6. **End-date editable only in daily mode**; monthly endDate is computed-only (read-only display).
7. **Calendar range → text-input sync:** picking a range in the DayPicker flows to startDate/endDate; monthly mode snaps the range to complete months via `countCalendarMonths` + `addCalendarMonths`.
8. **Custom rate ↔ custom total mutual exclusion:** setting one clears the other within the same unit.
9. **`defaultUnitId` pre-selection** on first fetch only (consumed via `defaultUnitConsumed` ref).
10. **Conflict 409 handling:** server-returned double-booking error sets `conflictError` and jumps the form back to Step 3.
11. **`canAdvance()` validation gates per step:** tenant selected → property+dates+period > 0 → unit selected → always (review).

---

## 3. Gaps in the form components

Six gaps surface from the analysis. Each has a recommendation.

### D1 — `SearchableSelect` custom result rendering (most consequential gap)

**Current:** dropdown rows show
```
[avatar circle, classification-tinted]  Name LastName   [ClassBadge VIP/Blacklisted]
                                        phone · nationality
```

**`SearchableSelect` today:** supports `description` field for an extra line under the label. No avatar slot, no badge slot, no custom render.

**Options:**
- **(a) Add a `renderOption` prop to `SearchableSelect`** — `(opt: Option, ctx: { query, selected }) => ReactNode`. Generic. Unblocks BookingEngine + any future combobox with rich rows. **~20 LoC change.**
- **(b) Use `SearchableSelect` as-is** with description = "phone · nationality" — lose the avatar + classification badge in dropdown rows. The selected-tenant card (after pick) stays bespoke and *does* show the classification colors, so the data is still visible — just one click later.
- **(c) Keep tenant search inline** (don't migrate it). Skip the largest single line-save in this migration.

**Recommendation: (a)** — small, clean addition. Sets a pattern for any future rich-row combobox (unit search, contact search, etc.).

### D2 — `DatePicker` and `DateRangePicker` locale prop

**Current code:** existing `<DayPicker>` calls pass `locale={dateFnsLocale}` (arLocale or enLocale). Without this, Arabic locale renders weekday headers in English.

**Today's `DatePicker`/`DateRangePicker`:** don't expose `locale`.

**Recommendation:** add `locale?: Locale` prop to both, pass through to react-day-picker. **~5 LoC each.**

### D3 — `NumberField` stepper

**Current code:** period field has manual `−` and `+` buttons (L735, L747).

**Spec section 7.3:** mentions `stepper={true}` prop. I deferred it in Tier 1.

**Options:**
- **(a) Add `stepper` prop to `NumberField`** — renders `+`/`−` buttons on the start/end. **~30 LoC change.**
- **(b) Keep the inline buttons in BookingEngine** alongside `NumberField` (just wrap them in a flex container).

**Recommendation: (a)** — the spec asked for it and other forms will need it (price entry on UnitPricingSection, occupant count on TenantForm).

### D4 — Calendar mode toggle elimination

**Current code:** daily mode has a toggle button (`calMode`) that switches between two date inputs and a 2-month `<DayPicker mode="range">`.

**Opportunity:** `DateRangePicker` IS the calendar mode. Migrating fully eliminates the `calMode` state + toggle.

**Recommendation:** in daily mode, drop the toggle entirely — use `DateRangePicker` everywhere. Saves ~25 lines + removes a UI affordance receptionists rarely use deliberately.

**Caveat:** monthly mode still uses the auto-snap-to-complete-months logic. Keep manual inputs (DatePicker for check-in + read-only display for check-out) in monthly mode.

### D5 — `SearchableSelect` debounce time

**Current code:** tenant search debounces at 350 ms.
**`SearchableSelect`:** hardcoded 250 ms.

**Recommendation:** add `debounceMs` prop (default 250). **~3 LoC change.**

### D6 — Rate-type segmented control

Not technically a gap, but a UI decision. The current 2-button segmented control reads well as a switch, not a form field. The "fields" in this form are property/dates/units/details — rate-type is a workflow toggle.

**Recommendation:** **keep the inline buttons** for now. Future `SegmentedControl` primitive (already on the component inventory) absorbs this.

---

## 4. Complexity estimate

| Bucket | Count | Notes |
| --- | --- | --- |
| Simple field replacements | **8** | Property, Check-in date, Check-out date (conditional), Custom rate (per unit), Custom total (per unit), Discount, Source, Notes |
| Complex field replacements | **3** | Tenant search (needs Gap D1 fix), Period stepper (needs Gap D3 fix), Date range / calendar mode (eliminates `calMode` toggle, needs Gap D2 fix for locale) |
| Bespoke UI to keep as-is | **9** | Step indicator, tenant card, blacklisted banner, conflict panel, unit type filter chips, unit selection cards, summary panels, confirm summary, step nav buttons |
| Pre-fix gaps in form components | **5** | renderOption (D1) + locale (D2) + stepper (D3) + debounceMs (D5) + accept DateRangePicker for daily (D4) |
| Custom behaviors to preserve | **11** | listed in §2 |
| Estimated lines saved | **~120-150** | out of 1286 total |

This is **less dramatic than ProfileForm's −71/96 (74%)** because:
- BookingEngine is mostly non-field UI (step nav, summary panels, conflict displays, rich unit cards).
- The fields *we can* migrate save ~10-12 LoC each; the bespoke parts that stay (~60% of the file) don't shrink.
- The richer payoff isn't line count — it's **consistency** (same focus styles, error display, RTL behavior across the form) and **bug fixes** (mouse-wheel-changes-value on `type="number"`, weekday header localization).

---

## 5. Recommended phasing

### Phase 2 — Fill component gaps (5 small commits)

1. `feat(ui/form): Add renderOption prop to SearchableSelect for rich rows` (D1, ~20 LoC)
2. `feat(ui/form): Add locale prop to DatePicker / DateRangePicker` (D2, ~10 LoC)
3. `feat(ui/form): Add stepper prop to NumberField` (D3, ~30 LoC)
4. `feat(ui/form): Add debounceMs prop to SearchableSelect` (D5, ~3 LoC)
5. *(none needed for D4 — pure consumer change)*

All four are tiny isolated additions that don't break existing usages. Each can ship with its own commit.

### Phase 3 — Migrate BookingEngine section by section

Order matters — each step ends with a working form before moving to the next.

1. **Submit button + footer nav** (3 buttons → `<Button>`). Smallest, safest first commit. Proves no regression.
2. **Step 4 details (discount / source / notes)** — 3 simple fields, lowest risk.
3. **Step 2 property + date inputs** (Select + DatePicker + DatePicker, drop `calMode`, replace DayPicker with DateRangePicker, swap stepper). Largest single chunk; touches mutually-recursive state (start/end/period sync).
4. **Step 3 custom rate + custom total inputs** — 2 numeric fields per selected unit. Touches inner card markup.
5. **Step 1 tenant search → `SearchableSelect`** — depends on Gap D1 + D5 landing. Most behavior-rich; leave for last.

After each section: run tsc + render manually + verify scenarios.

### Phase 4 — Verification (final commit)

Single commit: `refactor: Migrate BookingEngine to design system form components`. Includes:
- Verification table (each scenario × result).
- Updated migration patterns in `docs/design-system/form-fields.md`.

Alternatively, leave the section-level commits in Phase 3 as the history and use Phase 4 just to update docs.

---

## 6. Decisions I need from you before Phase 2

1. **D1 — `renderOption` prop on `SearchableSelect`** — add it? Recommend: **yes** (unblocks tenant search + future rich combobox).
2. **D2 — `locale` prop on `DatePicker` / `DateRangePicker`** — add it? Recommend: **yes** (Arabic localization).
3. **D3 — `stepper` prop on `NumberField`** — add it? Recommend: **yes** (period stepper + future UnitPricingSection).
4. **D4 — eliminate `calMode` toggle in daily mode** (use `DateRangePicker` always)? Recommend: **yes** (cleaner UX).
5. **D5 — `debounceMs` prop on `SearchableSelect`** — add it? Recommend: **yes** (small, useful).
6. **D6 — rate-type segmented control** — keep inline, or migrate to RadioGroup? Recommend: **keep inline** (workflow switch, not a field).
7. **Submit / footer nav buttons** — fold migration into this session, or leave them? Recommend: **fold in** (already-discussed Phase 3 button pattern, trivial).

If you want defaults across the board, just say **"all defaults, go to Phase 2"**.

---

## 7. Risks & mitigations

- **Risk:** start-date / end-date / period sync logic is intricate. Migrating Step 2 could break sync.
  **Mitigation:** preserve the existing handler functions (`handleStartDateChange`, `handleEndDateChange`, `handlePeriodChange`, `handleRateTypeChange`) verbatim. Only swap the input *renderers*. Test the 4 sync paths (start→period, period→end, end→period, rate-type→period+end) before commit.

- **Risk:** `DateRangePicker` doesn't expose the "complete months" snap logic.
  **Mitigation:** monthly mode keeps the existing `<DatePicker>` (single) for check-in + read-only display for check-out. Only daily mode uses `DateRangePicker`.

- **Risk:** `SearchableSelect`'s async pattern expects `loadOptions(query) → Promise<Option[]>`, but the current tenant search does extra state management (separate `tenantQuery` + `tenantResults` + `tenantLoading`).
  **Mitigation:** wrap the existing fetch in a `loadOptions` callback that returns `(await fetch).map(...)`. Lose the manual state; `SearchableSelect` owns it internally.

- **Risk:** PhotoUpload / unit photos are bespoke; if I touch unit-card markup I might break something.
  **Mitigation:** Step 3 migration *only* swaps the rate/total inputs. Unit card chrome stays untouched.

- **Risk:** RTL / Arabic mode regressions.
  **Mitigation:** all new form components are RTL-safe via logical props. Manually verify by setting `<html dir="rtl">` in DevTools.

---

## 8. Out of scope for this session (deferred)

Things this migration WILL NOT do:
- Change submit URL / payload shape (`/api/reservations` POST body stays identical).
- Change validation rules.
- Change the `BookingEngine` component's props (`properties`, `defaultPropertyId`, `defaultTenant`, `defaultUnitId`).
- Migrate `TenantForm` (the embedded quick-add form) — separate piece.
- Migrate the `BookingEngineModal` wrapper (parent component).
- Build a `CheckboxCard` / `SelectCard` primitive for the unit cards (could be a future system-level addition; not blocking this migration).
- Build an `Alert` primitive for the blacklisted warning and conflict panel (flagged in form-fields docs).
- Touch the step indicator, summary cards, or confirm step content.

---

## 9. Acceptance criteria for "this migration succeeded"

After all Phase-3 work + Phase-4 verification:

- [ ] `tsc --noEmit --skipLibCheck` reports 0 errors.
- [ ] Form submits a daily 4-night, 2-unit reservation successfully (server returns 200, redirects to detail page).
- [ ] Form submits a monthly 3-month, 1-unit reservation successfully.
- [ ] Form recovers cleanly from a 409 double-booking error (jumps to Step 3, shows conflict panel, allows reselect).
- [ ] Form preserves `defaultTenant`, `defaultPropertyId`, `defaultUnitId` props.
- [ ] Form renders correctly in `dir="rtl" lang="ar"`.
- [ ] Form renders correctly at mobile width (320 px).
- [ ] Blacklisted tenant warning still appears.
- [ ] Tenant "Create one" flow still opens the inline `TenantForm`.
- [ ] Custom rate ↔ custom total mutual exclusion still works.
- [ ] Defaults: line count saved 100+, no behavioural regressions.
