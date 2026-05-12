# Form Field migration audit

Phase 1 of the Form Field System rollout. Inventory of every form-input
pattern in the codebase before the new primitives land.

Scope: `app/`, `components/`, `lib/`, `package.json`. Date: 2026-05-12.

---

## 1. Headline numbers

| Metric | Value |
| --- | --- |
| Files with inline `<input>` | **41** |
| Files with inline `<select>` | **26** |
| Files with inline `<textarea>` | **13** |
| Existing shared form components in `components/ui/` | 5 exports (`FormCard`, `PageHeader`, `FormInput`, `FormSelect`, `FormActions`) |
| Existing standalone helpers | `SearchableSelect` (Headless-UI Combobox) |
| Local "field" helpers shadowing the shared ones | 2 (`Field` in ProfileForm, `TextInput` + `FieldLabel` in PropertyForm) |
| Files using `useActionState` (React 19 server-action form state) | 3 |
| Files using `useTransition` (pending state) | 23 |
| Files using `aria-invalid` | **2** (OrgSettingsForm, OnboardingWizard) |
| Form library installed (`react-hook-form` / `zod` / `yup` / `formik`) | **None** |
| Calendar / date picker library | `react-day-picker@9.13.1` (already in deps) |

---

## 2. Existing shared form components

All in **[components/ui/FormComponents.tsx](components/ui/FormComponents.tsx)** (one file, 5 exports).

### `PageHeader` (well-adopted)
- API: `{ title, description, listHref? }`
- **9 importers** — the most-used existing DS surface.
- Verdict: **keep**. Out of FormField scope (this is a page-level surface).

### `FormCard`
- API: `{ children }` — white panel + 6-col grid.
- 2 importers.
- Verdict: **keep**. Out of FormField scope.

### `FormInput` (the legacy "TextField")
- API: `{ label, colSpan?, icon?, ...InputHTMLAttributes }` — extends native input.
- Styling: `ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600`, `rounded-md py-1.5`, `sm:text-sm`.
- 2 file importers.
- Verdict: **replace** with new `TextField`. Existing 2 importers can stay on `FormInput` until page-migration phase.

### `FormSelect` (the legacy "Select")
- API: `{ label, options: { label, value }[], colSpan?, ...SelectHTMLAttributes }`.
- 2 importers.
- Verdict: **replace** with new `Select`. Note: legacy uses `{ label, value }`, new spec uses `{ value, label }` — same shape, opposite key order. Either matches structurally.

### `FormActions`
- Already migrated to Button in Phase 2 of the Button work.
- Verdict: **keep as-is**.

---

## 3. Local "field" helpers (duplicates)

### Local `Field` — `app/dashboard/settings/profile/ProfileForm.tsx:34`
```ts
function Field({
  label, name, type = "text",
  defaultValue, placeholder, required, autoComplete,
  addon,
}: { … })
```
- Inline `<label>` (gray-700, mb-1.5) + `<input>` with `border border-gray-300` + ring focus.
- Has an `addon` slot positioned `absolute end-3`.
- Used 4× in `ProfileForm` for first-name / last-name / phone / email.
- Also feeds the local `PasswordField` (next item) via the `addon` slot.

### Local `PasswordField` — `app/dashboard/settings/profile/ProfileForm.tsx:79`
- Wraps `Field` with `type` toggled by an eye icon.
- Used 2× (current/new password forms).

### Local `FieldLabel` + `TextInput` — `components/dashboard/PropertyForm.tsx:60,68`
- `FieldLabel({ htmlFor, children, required })` — same shape as ProfileForm's inline label.
- `TextInput({ id, name, placeholder, defaultValue, required, type, min, max })` — uncontrolled, `rounded-lg border border-gray-300` + `focus:ring-blue-500/20`.
- Used throughout PropertyForm.

**Important nuance:** the audit said "2 FieldLabel implementations." On verification there's only **1 named** `FieldLabel` (in PropertyForm). ProfileForm has the same shape but rendered inline inside `Field`, not as a separate function. They're functionally equivalent.

**Differences worth flagging:**
| Aspect | `Field` (Profile) | `TextInput` + `FieldLabel` (Property) | `FormInput` (shared) |
| --- | --- | --- | --- |
| Border style | `border border-gray-300` | `border border-gray-300` | `ring-1 ring-inset ring-gray-300` |
| Padding | `px-3 py-2` | `px-3 py-2.5` | `py-1.5` (height varies) |
| Radius | `rounded-lg` | `rounded-lg` | `rounded-md` |
| Focus | `focus:ring-2 focus:ring-blue-500` | `focus:ring-2 focus:ring-blue-500/20` | `focus:ring-2 focus:ring-inset focus:ring-blue-600` |
| Error display | none (server-side) | none | none |
| Controlled? | uncontrolled (`defaultValue`) | uncontrolled | passes-through |
| Has addon slot? | yes (`addon` prop) | no | yes (icon prop, left only) |

**The three are visually drifted.** Field uses `rounded-lg` + `border-` border, FormInput uses `rounded-md` + `ring-` border. Standardization is the whole point of the new system.

---

## 4. The third pattern — controlled inputs with manual validation

Best-in-class example: **`app/dashboard/settings/organization/OrgSettingsForm.tsx`** (the only file in the codebase doing this properly):
- `useState` for form state.
- Inline conditional `className` based on `aria-invalid`.
- Error message under the input with `ExclamationCircleIcon`.
- Banner-level error at top.

This is the closest existing pattern to what the new components should expose by default. We should adopt its **a11y semantics** (`aria-invalid`, `aria-describedby`) and **error-message shape** (icon + message below, in red) as the new system's default.

The `OnboardingWizard.tsx` (only other `aria-invalid` user) has a similar pattern but with different visual.

---

## 5. Form library — current state and recommendation

### Current state

**No client-side form library is in use.** The codebase is built around the Next.js 15 / React 19 Server-Action pattern:

```tsx
const [state, formAction, isPending] = useActionState(action, {});

return (
  <form action={formAction}>
    <input name="email" type="email" required />
    <input name="password" type="password" required />
    {state.error && <p>{state.error}</p>}
    <button type="submit">Submit</button>
  </form>
);
```

- 3 files use `useActionState` (cleanest)
- 23 files use `useTransition` + server-action call (older pattern, equivalent in effect)
- Many "client-controlled" forms (TenantForm, PropertyForm, UnitForm, BookingEngine) use `useState` for individual fields, then call a server action on submit.
- **Validation lives in server actions**, which return `{ error: string }` or `{ field, message }` objects. Some forms also use HTML5 attributes (`required`, `type="email"`, `pattern`).

### Recommendation — **no library, library-friendly components**

Build the form fields **uncontrolled-by-default** (`name` + `defaultValue`) so they work with `<form action={serverAction}>` natively — matching the existing pattern. Support `value` + `onChange` for the client-state cases. `forwardRef` on every component so **react-hook-form will work the day someone adds it** without us re-shipping the primitives.

**Why not add react-hook-form now?**
- The codebase has shipped 20+ forms without it. Adding it would create two patterns to maintain, not one.
- Server Actions are the right tool for ~80% of these forms (server-validated, full-form-on-submit).
- The 20% that legitimately need client-state (BookingEngine, AvailabilityCalendar filters) are already using `useState` and working fine.
- Components that `forwardRef` will be RHF-ready if the team decides to add it later for one specific complex form.

**Why not zod/yup?**
- Validation is happening server-side already (in server actions).
- Server actions can use zod internally without exposing it to the client.
- We can add zod **server-side only** for stricter validation in a follow-up. The form components don't need to know.

**Final recommendation:**
- Build the new components to support both controlled and uncontrolled.
- Every text-like component takes `name`, `defaultValue`, `value`, `onChange`, ref-forwarding.
- Error display is driven by the `error?: string | boolean` prop — caller passes the server-action error string. Components don't validate themselves.
- HTML5 `required` / `type` attributes still work and are passed through.

This is exactly what the FormSystem spec describes. It's the right call.

---

## 6. Inline-field heat map

By feature area, files with the most inline form fields (rough head-count of `<input` / `<select` / `<textarea` occurrences):

| File | Approx. inline fields | Notes |
| --- | --- | --- |
| `components/dashboard/TenantForm.tsx` | **25+** | Largest form in the app. Many `<button>` mocked-as-radio groups (ID type, guest type, gender). |
| `components/dashboard/BookingEngine.tsx` | 20+ | Step-by-step wizard. Has its own date picker, tenant search, custom rate. |
| `components/dashboard/PropertyForm.tsx` | 15+ | Type-card buttons (mocked-as-radio), stepper, toggle, name/desc/city. |
| `components/dashboard/UnitForm.tsx` | 12+ | Mix of `FormInput`/`FormSelect` + inline `<input>`. |
| `components/dashboard/CustomerPaymentForm.tsx` | 10+ | Tenant combobox, amount, method, allocation table inputs. |
| `app/dashboard/settings/organization/OrgSettingsForm.tsx` | 10 | The validation gold-standard pattern. |
| `app/dashboard/expenses/new/SubmitExpenseForm.tsx` | 8 | Category select, amount, description, receipt upload. |
| `app/dashboard/units/bulk/BulkCreateForm.tsx` | 8 | Number stepper, range inputs. |
| `components/dashboard/units/UnitPricingSection.tsx` | 8 | Rate name, amount, min/max guests, dates. |
| `app/dashboard/settings/profile/ProfileForm.tsx` | 6 | Uses the local `Field` helper. |
| `app/dashboard/reservations/[id]/ReservationDetail.tsx` | 5 | Modals for status updates have inline inputs. |
| ~15 others | 1-5 each | Filters, modal forms, small dialogs. |

---

## 7. Specialized inputs already in use

| Input type | Where | Existing approach |
| --- | --- | --- |
| Date range | BookingEngine, ReservationForm, BookingEngineModal | `react-day-picker@9.13.1` (in deps). The `ReservationDatePicker` wrapper was deleted in earlier cleanup. |
| Combobox / SearchableSelect | CustomerPaymentForm, ReservationForm | `@headlessui/react` Combobox via `components/ui/SearchableSelect.tsx` (works, has its own option shape `{ id, name }` instead of the new spec's `{ value, label }`). |
| Phone | TenantForm, OrgSettingsForm, ProfileForm, LoginForm, InviteForm | Plain `type="tel"` input. No country picker, no formatting. |
| Password | LoginForm, ProfileForm | Local helper in ProfileForm; LoginForm has its own copy. |
| Image upload | SubmitExpenseForm (receipts), PhotoUpload component, OrgSettingsForm (logo) | Native `type="file"` + custom drag-drop in `PhotoUpload`. No library. |
| Toggle / switch | PropertyForm (active/inactive booking) | `role="switch"` `<button>` with custom styling. |
| Radio group | TenantForm (ID type, guest type, gender), expense category selection | `role="radio"` `<button>` groups — fake radio. |
| Checkbox | Various lists (expense bulk-select), reservation early-checkout | Plain `<input type="checkbox">` + Tailwind. |
| Number with currency | UnitPricingSection (OMR amounts), CustomerPaymentForm | Plain `<input type="number">` with currency text adjacent. Some files use `inputMode="decimal"` with `type="text"`. |

---

## 8. Concerns & edge cases discovered

### Critical
1. **`@headlessui/react` Combobox is already used.** Our new `SearchableSelect` should keep this engine, not switch to `cmdk` — switching would mean a duplicate listbox-management implementation. The spec mentions cmdk OR Radix; Headless UI is acceptable.
2. **`react-day-picker@9.x`** is already in `package.json`. New `DatePicker` / `DateRangePicker` should use it. Don't add cmdk just for Select either — Headless UI handles it.
3. **`OnboardingWizard` ID-document form** is wizard-state-driven (10+ steps with inputs that submit at the end). It will need careful migration; flag for the page-migration phase, not this one.
4. **`type="number"` mouse-wheel scroll-to-change is a real bug**. Existing `<input type="number">` uses fire across the app — when a receptionist scrolls a payments page, the number changes accidentally. The spec's recommendation (`type="text" inputMode="decimal"` + locale formatter) fixes this. New `NumberField` should follow that.
5. **OMR currency has 3 decimal places** (per CLAUDE.md: 1 OMR = 1000 baisa). Existing code uses `.toFixed(3)` everywhere; the new `NumberField` `precision` prop must default to 3 when `currency="OMR"`.

### Moderate
6. **No client-side validation library.** All validation today is HTML5 (`required`, `pattern`, `type`) + server-action returns. The new form components mustn't introduce a hidden validation library — the `error?` prop is the only contract; callers pass strings in.
7. **i18n for error messages.** Server actions return English strings now. When errors become more nuanced, they'll need translation. Components shouldn't bake in any language.
8. **The 2 existing `FormInput` / `FormSelect` consumers** (9 files importing from `FormComponents.tsx`) are mostly `PageHeader` users, not field users — only a handful of pages currently use the actual field exports. The "consolidation" in Phase 5 of the rollout is therefore small (~5 files).
9. **Local helpers (`Field`, `TextInput`, `FieldLabel`, local `PasswordField`)** are tightly coupled to their parent files. Migrating those parent files is part of the **page-migration phase later, not this session**.
10. **`<SearchableSelect>` has a different option shape** (`{ id, name }`) than the spec (`{ value, label }`). If we keep the same component name with new shape, both call sites break. Recommendation: build new `SearchableSelect` under `components/ui/form/SearchableSelect.tsx` with new shape; deprecate the old one but keep it alive until callers migrate.

### Minor
11. **`@heroicons/react`** is the icon library. All form components should import icons from there (no new icon dep).
12. **`clsx`** is in deps and used in `FormComponents.tsx`. Continue using it for conditional classnames.
13. **`sonner`** is in deps for toasts — form success often shows a toast. Not part of the form components themselves; callers handle it.
14. **`next-intl`** is the i18n library. Every form uses `useTranslations` from `next-intl`. Form components must accept already-translated strings; never call `t(...)` internally.

---

## 9. Libraries to add (and not add) for this work

### Already in deps (use them)
- `react-day-picker@9.13.1` — `DatePicker`, `DateRangePicker`
- `@headlessui/react@2.2.9` — `Select`, `MultiSelect`, `SearchableSelect`, `Toggle` (via Switch), `DatePicker` popover wrapper
- `@heroicons/react@2.2.0` — all icons
- `clsx@2.1.1` — conditional classnames
- `tailwind-merge@3.4.0` — already in deps; useful for the form components that accept `className` overrides
- `date-fns@4.1.0` — date formatting (already used)

### Recommended to add in **Tier 2/3 phases** (not now)
- `react-textarea-autosize` — TextArea auto-resize (~2 KB gz). Add when shipping `TextArea`.
- `libphonenumber-js` — PhoneField formatting + validation. ~70 KB metadata but the `min` build is ~15 KB. Add when shipping `PhoneField`.
- `react-dropzone` — FileUpload / ImageUpload drag-drop (~15 KB gz). Add when shipping those.
- `chrono-node` (optional) — natural-language date parsing fallback for DatePicker manual input. Skippable.

### Explicitly NOT recommended
- `react-hook-form` — out of scope per Section 5. Components support it via `forwardRef` if added later.
- `zod` / `yup` — out of scope, server-side validation continues.
- `cmdk` — Headless UI already handles combobox; adding cmdk = duplicate dependency.
- `downshift` — same reason as cmdk.

---

## 10. Architectural recommendation for the build

The build phase should hew to the FormSystem spec section 1 architecture:

```
components/ui/form/
├── FieldShell.tsx          ← label + required + helper + error + a11y wiring
├── useFieldA11y.ts          ← hook: IDs, aria-describedby, aria-invalid
├── inputStyles.ts            ← shared classes: control base, sizes, states
├── TextField.tsx             ← Tier 1
├── TextArea.tsx              ← Tier 1
├── NumberField.tsx           ← Tier 1
├── Select.tsx                ← Tier 1
└── index.ts                  ← barrel
```

**Per-component contract:**
- `forwardRef`
- Extends spec's `BaseFieldProps` (label, helperText, error, required, showOptional, disabled, readOnly, loading, success, size, id, name, className, reserveMessageSpace).
- Extends native `HTMLInputAttributes` (or Select/Textarea) minus the props we own.
- Renders the control inside `<FieldShell>`.
- A11y wired via `useFieldA11y` (auto IDs + `aria-describedby` + `aria-invalid`).

**Token usage (all design-system tokens, no hardcoded values):**
- Colors: `border-default`, `bg-surface`, `text-fg`, `text-fg-tertiary`, `brand-500`, `error-500`, `success-500`, `error-600`, `success-700`, `bg-subtle`, `fg-disabled`.
- Spacing: `--space-1` between rows, `--space-5` between fields.
- Sizes: `sm` 32px, `md` 38px, `lg` 44px (need arbitrary values since 38 px isn't on the project's spacing scale — same situation as Button/Badge).
- Motion: `duration-fast`, `ease-out`.
- Radius: `--radius-md`.

**RTL:** logical props throughout (`ps-*`, `pe-*`, `ms-*`, `me-*`, `start-*`, `end-*`).

---

## 11. What stays vs. what gets replaced

### Stays (keep, don't touch in this session)
- `components/ui/FormComponents.tsx::FormCard` — page-layout wrapper, not a field
- `components/ui/FormComponents.tsx::PageHeader` — page header, not a field
- `components/ui/FormComponents.tsx::FormActions` — already uses the new Button
- `components/ui/SearchableSelect.tsx` (the old one) — kept alive until the new one ships and consumers migrate; eventually delete

### Replaces (in this session, Tier 1)
- `components/ui/FormComponents.tsx::FormInput` → new `TextField`
- `components/ui/FormComponents.tsx::FormSelect` → new `Select`
- New: `NumberField`, `TextArea`

### Replaces (in later tiers, this session)
- Local `Field` in ProfileForm → new `TextField`
- Local `PasswordField` in ProfileForm + LoginForm → new `PasswordField` (Tier 2)
- Local `TextInput` + `FieldLabel` in PropertyForm → new `TextField` (page migration phase, not this session)
- Various inline `<input>` / `<select>` / `<textarea>` across 50+ files → new components (page migration phase)

### Phase-5 consolidation in this session (small scope per the prompt)
- Delete local `Field` + `PasswordField` in `app/dashboard/settings/profile/ProfileForm.tsx` and migrate its 4 call sites to new `TextField` / `PasswordField`. This is ONE file, contained.
- Delete local `TextInput` + `FieldLabel` in `components/dashboard/PropertyForm.tsx` and migrate its call sites to new `TextField`. This is ONE file but PropertyForm is 429 lines with 15+ inline fields — bigger than Profile but still bounded.
- The 41+ files of broader inline-input migration come **later**, per the prompt's "DO NOT IN THIS SESSION" rule.

---

## 12. Decisions I need from you before Phase 2

1. **Form library:** confirm we skip `react-hook-form`, keep server-action pattern, build components uncontrolled-by-default with controlled support + forwardRef? **(I strongly recommend this.)**
2. **Validation:** confirm we don't add `zod`/`yup` in this session? Server-side validation continues as today; the `error` prop is the only client contract.
3. **`SearchableSelect` migration:** the old one stays (different option shape, 2 consumers). The new one ships under `components/ui/form/SearchableSelect.tsx`. Old gets deprecated, removed in a follow-up. OK?
4. **OMR precision default:** confirm `NumberField`'s `precision` defaults to 3 when `currency="OMR"` (per CLAUDE.md decimal rule)?
5. **PhoneField default country:** Oman (`+968`)? Or detect from `orgContext` (the organization's country)?
6. **Phase 5 scope:** which local-helper migrations should ship in this session vs. defer?
   - **Recommend in scope:** ProfileForm local `Field` + `PasswordField` (small, 1 file).
   - **Recommend deferred:** PropertyForm local `TextInput` + `FieldLabel` (15+ field call sites, bigger surgery, better as part of the page-migration phase).
7. **Library additions:** OK to add `react-textarea-autosize` for `TextArea` and `libphonenumber-js` for `PhoneField` when those tiers land? (Both small, justified.)
8. **`react-dropzone`** for FileUpload/ImageUpload — OK when Tier 3 lands?
9. **Should we keep `chrono-node`** as a stretch for the DatePicker manual-input fallback, or use only the configured format? (Recommend: skip chrono-node for v1.)

---

## 13. Recommended order for Phase 2 (Tier 1)

When you approve:

1. **`inputStyles.ts`** — shared class tables (base, sizes, border states, message-row).
2. **`useFieldA11y.ts`** — the hook (3-line helper to generate IDs + describedby + invalid).
3. **`FieldShell.tsx`** — the layout primitive everyone composes through.
4. **`TextField.tsx`** — first atom; smoke-tests the architecture.
5. **`TextArea.tsx`** — extends TextField, adds auto-resize.
6. **`NumberField.tsx`** — wraps TextField with formatter + currency.
7. **`Select.tsx`** — Headless UI `Listbox` for accessible dropdown.
8. **`index.ts`** — barrel exports.
9. **Tier 1 commit:** `feat(ui): Add Tier 1 form components (TextField, TextArea, Select, NumberField)`.

Estimated: 4 small files + 4 atoms + 1 barrel = ~700-900 LoC across Tier 1.

---

## 14. Out of scope reminder (per the prompt)

The session does NOT include:
- Migrating `TenantForm`, `UnitForm`, `BookingEngine`, etc. (45+ files of page-level rework — separate phase later).
- Changing validation logic, submission handlers, business logic, server actions.
- Adding react-hook-form, zod, or yup.
- Database / API changes.

This session DOES include:
- Building the 17 form primitives (across Tier 1/2/3 phases, with approval gates).
- Consolidating the 2 small local-helper duplicates (Phase 5).
- Comprehensive docs at `docs/design-system/form-fields.md` (Phase 6).
