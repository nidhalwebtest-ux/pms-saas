# Form Fields — Design System

The 17 form components in `components/ui/form/`. All compose through a shared
`FormField` layout primitive and a shared `useFieldA11y` hook for accessibility
wiring. Every component is RTL-safe, design-token-driven, and built to work
with **React Server Actions** out of the box (uncontrolled + `name`). Controlled
mode (`value` + `onChange`) is supported everywhere for client-state cases.

Audit + decisions log: [docs/form-field-migration-audit.md](../form-field-migration-audit.md)
Spec: `design/form/components/form/FormSystem.spec.md`

---

## Quick reference

| Component | Tier | Use for | Library |
| --- | --- | --- | --- |
| `TextField` | 1 | Single-line text, email, tel, url | — |
| `TextArea` | 1 | Multi-line text, auto-grows | `react-textarea-autosize` |
| `Select` | 1 | Single-choice from a known list | native `<select>` |
| `NumberField` | 1 | Numeric with locale formatting + currency | — |
| `PasswordField` | 2 | Passwords with show/hide toggle | — |
| `PhoneField` | 2 | E.164-validated phone numbers | `libphonenumber-js` |
| `Checkbox` / `CheckboxGroup` | 2 | Boolean / multi-toggle | — |
| `Radio` / `RadioGroup` | 2 | Single-choice (mutually exclusive) | — |
| `Toggle` | 3 | Boolean switches (settings, prefs) | — |
| `DatePicker` | 3 | Single date selection | `react-day-picker` |
| `DateRangePicker` | 3 | Date range with presets | `react-day-picker` |
| `SearchableSelect` | 3 | Single-select with search + async load | `@headlessui/react` Combobox |
| `MultiSelect` | 3 | Multi-select with chip display | `@headlessui/react` Listbox |
| `FileUpload` | 3 | Generic file upload with drag-drop | `react-dropzone` |
| `ImageUpload` | 3 | Image upload with thumbnail preview | `react-dropzone` |

**Importing.** All re-exported from `@/components/ui` for the unified surface:

```tsx
import {
  TextField, TextArea, Select, NumberField,
  PasswordField, PhoneField, Checkbox, CheckboxGroup, Radio, RadioGroup,
  Toggle, DatePicker, DateRangePicker, SearchableSelect, MultiSelect,
  FileUpload, ImageUpload,
} from "@/components/ui";
```

---

## Architecture

### One layout primitive, many atoms

`FormField` (`components/ui/form/FormField.tsx`) owns:
- The label row (`<label htmlFor>` + required asterisk + optional indicator)
- The message row (helper text / error / success)
- `min-h-4` on the message row by default to prevent layout shift when errors appear
- `role="alert"` on submit-time errors

Every atom calls `useFieldA11y()` once to get matching `id` / `messageId` /
`aria-invalid` / `aria-describedby`, then renders `<FormField id messageId ...>`
with its control as children.

### Shared visual language (`inputStyles.ts`)

- **`controlBase`** — `w-full bg-surface text-fg border rounded-md transition-colors duration-fast ease-out placeholder:text-fg-tertiary focus:outline-none disabled:bg-subtle disabled:text-fg-disabled disabled:cursor-not-allowed read-only:bg-subtle`
- **`controlSize`** — `sm` 32 px / `md` 38 px (default) / `lg` 44 px
- **`borderState`** — `default` (focus turns brand), `error` (red border + red focus ring), `success` (green border)

All atoms reference these tables — change a token, every input updates.

### `BaseFieldProps`

```ts
interface BaseFieldProps {
  label: ReactNode;                  // required — never use placeholder as label
  helperText?: ReactNode;             // hidden when `error` is present
  error?: string | boolean;           // truthy string shows red border + message
  required?: boolean;                  // adds asterisk + aria-required
  showOptional?: boolean;              // renders the word "optional" by the label
  disabled?: boolean;
  readOnly?: boolean;
  loading?: boolean;                   // shows a spinner on the right (where applicable)
  success?: boolean;                   // green border
  size?: "sm" | "md" | "lg";
  id?: string;                         // auto-generated via useId() if omitted
  name?: string;                       // for form submission
  className?: string;                  // outer wrapper class
  reserveMessageSpace?: boolean;       // default true; disable for filter bars
}
```

Every component extends this and adds its own type-specific props.

---

## When to use each component

### Choosing between similar components

| Need | Use |
| --- | --- |
| Free-form text, < 1 line | `TextField` |
| Free-form text, multi-line | `TextArea` |
| Pick one from < 10 known options | `Select` (native — better for keyboard / server actions) |
| Pick one from a long list | `Select` for short, `SearchableSelect` once you'd otherwise scroll |
| Pick one from a server-loaded list | `SearchableSelect` with `loadOptions` |
| Pick multiple from a list | `MultiSelect` |
| Number with thousand separators / currency | `NumberField` |
| Phone number with dial code + validation | `PhoneField` |
| Boolean on/off | `Toggle` (preferences) or `Checkbox` (confirmations) |
| Pick one from 2-5 visible options | `RadioGroup` |
| Pick a single date | `DatePicker` |
| Pick a date range | `DateRangePicker` |
| Upload one or more files | `FileUpload` |
| Upload images with previews | `ImageUpload` |

### Why `Select` is native (and `MultiSelect` isn't)

Native `<select>` is the most accessible single-choice element. Mobile keyboard
keyboards know how to render it. Server actions work without any wiring. For
`MultiSelect`, native doesn't support the chip-based UX from the spec, so we
use `@headlessui/react` Listbox with multiple — same accessibility guarantees
under the hood.

---

## Form library integration

### Server Actions (the dominant pattern)

Most forms in this app post to a Server Action defined in an `actions.ts` file.
All components work natively — set `name` and the value lands in `FormData`.

```tsx
"use client";
import { useActionState } from "react";
import { TextField, PasswordField, Button } from "@/components/ui";
import { signIn } from "./actions";

export function SignInForm() {
  const [state, action, isPending] = useActionState(signIn, {});
  return (
    <form action={action} className="space-y-5">
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.email}
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />
      <Button type="submit" loading={isPending}>Sign in</Button>
    </form>
  );
}
```

**How values arrive at the server:**

- `TextField`, `TextArea`, `Select`, `PasswordField` — string via `formData.get("name")`.
- `NumberField` — emits a **hidden field** with the canonical parsed number, so
  `formData.get("rate")` returns `"1200"` (not `"1,200.000"`). Use
  `parseFloat(formData.get("rate") as string)`.
- `PhoneField` — hidden field with E.164 (`+96898765432`).
- `DatePicker` — hidden field with `yyyy-MM-dd`.
- `DateRangePicker` — two hidden fields (`name_from`, `name_to`), both `yyyy-MM-dd`.
- `Checkbox` — standard checkbox semantics: present in `FormData` when checked.
- `RadioGroup` — only the chosen `value` ships.
- `Toggle` — hidden field with `"on"` when checked, empty when off.
- `SearchableSelect` — hidden field with the selected value (string).
- `MultiSelect` — multiple hidden fields `name[]`; read via `formData.getAll("name[]")`.
- `FileUpload` / `ImageUpload` — bind the underlying file input via the `name` prop
  if you want native multipart submission; for most flows callers upload client-side
  via `onChange` and persist the resulting URL.

### Controlled / client-state pattern

Same components, just pass `value` + `onChange` (or `onValueChange`). Useful for:
- Filter bars (status, date range)
- Booking-engine-style wizards where partial state lives in `useState`
- Validation that runs as the user types

```tsx
const [search, setSearch] = useState("");
const [dates, setDates] = useState<DateRangeValue | null>(null);

<div className="flex gap-3">
  <TextField
    label="Search"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    leftIcon={<MagnifyingGlassIcon />}
    size="sm"
    reserveMessageSpace={false}
  />
  <DateRangePicker
    label="Dates"
    value={dates}
    onValueChange={setDates}
    size="sm"
    reserveMessageSpace={false}
  />
</div>
```

### React Hook Form (not used today, but supported)

Every component `forwardRef`s its underlying input. If RHF lands later:

```tsx
const { register, handleSubmit, formState: { errors } } = useForm();

<TextField
  label="Email"
  {...register("email", { required: "Email is required" })}
  error={errors.email?.message}
/>
```

`Controller`-based usage works for the custom controls (`DatePicker`, `SearchableSelect`, etc.).

### Validation philosophy

**Validation lives server-side.** Client-side gets:
- Native HTML5 attrs (`required`, `pattern`, `minLength`, `maxLength`, `min`, `max`, `type`)
- The `error` prop on every component — pass server-returned strings here

No client-side validation library is included. If you want one, install `zod`
server-side first (use it inside actions to return strict errors), keep the
client thin. **Do not** introduce zod on the client unless there's a strong
reason — the bundle cost isn't worth it for our flows.

---

## Common patterns and recipes

### Field-level error from a Server Action

```tsx
// actions.ts
"use server";
export async function createTenant(_: any, fd: FormData) {
  const email = String(fd.get("email") ?? "");
  if (!email.includes("@")) {
    return { fieldErrors: { email: "Enter a valid email" } };
  }
  // …
}

// Form
const [state, action] = useActionState(createTenant, {});
<TextField name="email" label="Email" error={state.fieldErrors?.email} />
```

### Form-level error banner

For non-field errors (rate-limited, network, etc.), render an inline alert above
the form (use the existing `StatusBanner` in `ProfileForm` as a model, or a
future `Alert` primitive once it lands).

### "Optional" indicator vs required asterisk

```tsx
<TextField label="Phone" name="phone" />                    // No indicator — implies optional
<TextField label="Phone" name="phone" showOptional />       // Explicitly "optional" next to label
<TextField label="Phone" name="phone" required />           // Red asterisk
```

Per the spec, **the asterisk + `aria-required` is the standard for required**.
Use `showOptional` sparingly — only when the form is mostly required and you
want to highlight the few optional fields.

### Mobile-friendly numeric input

```tsx
// Wrong — type=number scrolls value on mouse wheel + breaks formatting
<input type="number" name="amount" />

// Right — NumberField handles formatting, locale, currency
<NumberField label="Amount" name="amount" currency="OMR" />
// Renders as "1,200.000 OMR" in UI, submits "1200" to server
```

OMR precision defaults to 3 (`1 OMR = 1000 baisa`) per CLAUDE.md.

### Multi-step form with partial state

```tsx
const [draft, setDraft] = useState({ name: "", units: [] as string[], notes: "" });

<TextField
  label="Name"
  value={draft.name}
  onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))}
/>
<MultiSelect
  label="Units"
  options={availableUnits}
  value={draft.units}
  onValueChange={(v) => setDraft(d => ({ ...d, units: v }))}
/>
<TextArea
  label="Notes"
  value={draft.notes}
  onChange={(e) => setDraft(d => ({ ...d, notes: e.target.value }))}
/>
```

### Async tenant search (real-world pattern)

```tsx
const [tenant, setTenant] = useState<{ value: string; label: string } | null>(null);

<SearchableSelect
  label="Tenant"
  name="tenantId"
  required
  loadOptions={async (q) => {
    const res = await fetch(`/api/tenants/search?q=${encodeURIComponent(q)}`);
    const tenants = await res.json();
    return tenants.map((t: any) => ({
      value: t.id,
      label: `${t.firstName} ${t.lastName}`,
      description: t.phone,
    }));
  }}
  recentOptions={recentTenants}
  onCreate={(q) => openQuickAddTenantModal(q)}
  selectedOption={tenant}
  value={tenant?.value ?? null}
  onValueChange={async (v) => {
    if (!v) return setTenant(null);
    const t = await fetchTenant(v);
    setTenant({ value: t.id, label: `${t.firstName} ${t.lastName}` });
  }}
/>
```

### Reservation dates with Khareef season preset

```tsx
<DateRangePicker
  label="Stay"
  name="stay"            // emits stay_from + stay_to
  required
  minDate={new Date()}
  showPresets             // includes "Khareef season"
/>
```

### Payment-method radio cards

```tsx
<RadioGroup label="Payment method" required defaultValue="cash" variant="cards">
  <Radio name="method" value="cash"     label="Cash"          description="Pay at the front desk" />
  <Radio name="method" value="card"     label="Card"          description="Visa / Mastercard" />
  <Radio name="method" value="transfer" label="Bank transfer" description="Wire to operator account" />
</RadioGroup>
```

### Receipt upload on an expense form

```tsx
const [files, setFiles] = useState<File[]>([]);

<ImageUpload
  label="Receipt"
  name="receipt"
  required
  maxSize={5 * 1024 * 1024}
  value={files}
  onChange={setFiles}
  hint="JPG, PNG, or HEIC. Max 5 MB."
  capture="environment"   // back camera on mobile
/>

// On submit: upload files[0] to Supabase Storage, persist the URL
```

---

## Accessibility

Every component bakes in:

- **`<label htmlFor>`** — every field has a real label (no placeholder-as-label).
- **`aria-required`** — set when `required` is true; visual asterisk is separate.
- **`aria-invalid`** — set when an error is present.
- **`aria-describedby`** — points at the message row (helper or error).
- **`role="alert"`** — on the message row only when error is present (avoids
  on-keystroke spam).
- **Group semantics** — `CheckboxGroup`, `RadioGroup`, `DateRangePicker` use
  native `<fieldset>` + `<legend>`. Don't fake it with `<div role="group">`.
- **Disabled vs read-only** — `disabled` removes from tab order;
  `readOnly` keeps it but announces "read only".
- **Keyboard:**
  - Tab/Shift+Tab moves between fields
  - Space toggles `Checkbox` / `Toggle`
  - Arrow keys navigate `RadioGroup` and `Select` / `SearchableSelect` listboxes
  - Enter activates select/picker triggers + submits forms
  - Escape closes any open popover (`Select`, `DatePicker`, `SearchableSelect`)
- **Async validation** — announce result via `aria-live="polite"` on a sibling
  container; don't put the validation result inside the field itself.

---

## RTL behavior

Apply `[dir="rtl"]` once on `<html>` (already wired via `app/layout.tsx` based on
locale). Every form component flips correctly because they use logical Tailwind
utilities (`ps-*`, `pe-*`, `ms-*`, `me-*`, `start-*`, `end-*`) throughout.

Specific behaviors:

| Component | RTL notes |
| --- | --- |
| `TextField` / `TextArea` | Icons swap sides. Input `dir="auto"` so Arabic words flow RTL while embedded numbers stay LTR. |
| `NumberField` | Field always `dir="ltr"` — numbers don't bidi-flip. Currency suffix moves to the visual end. |
| `PasswordField` | Eye toggle stays on the visual end side via `end-0`. |
| `PhoneField` | `dir="ltr"` on the input. Dial code stays on the visual start. |
| `Select` / `MultiSelect` | Chevron moves to the visual end. Selected chips in MultiSelect flow naturally. |
| `DatePicker` / `DateRangePicker` | Calendar layout is symmetric; presets sit on the visual start. |
| `Checkbox` / `Radio` | Box / dot on the visual start; label after. |
| `Toggle` | Track flips horizontally — "on" thumb on the visual start. |
| `FileUpload` / `ImageUpload` | Dropzone is symmetric; remove × buttons swap sides. |

---

## Migration guide — from the old patterns

### From local `Field` / `TextInput` / `FieldLabel`

The local helpers in `ProfileForm` (migrated in this session) and `PropertyForm`
(deferred) follow the same mechanical replacement:

```tsx
// BEFORE — local Field helper
<Field
  label="First name"
  name="firstName"
  defaultValue={firstName}
  required
/>

// AFTER — design-system TextField
<TextField
  label="First name"
  name="firstName"
  defaultValue={firstName}
  required
/>
```

Most props are 1:1. The new component adds `helperText`, `error`, `size`,
`success`, `loading`, `leftIcon`, `rightIcon`, `reserveMessageSpace`.

### From inline `<input>` with hand-rolled styling

```tsx
// BEFORE
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1.5">
    Email
  </label>
  <input
    type="email"
    name="email"
    className="block w-full rounded-lg border border-gray-300 px-3 py-2..."
  />
</div>

// AFTER
<TextField label="Email" type="email" name="email" />
```

41 files have inline inputs (audit §1) — they migrate the same way.

### From legacy `FormInput` / `FormSelect`

The old `components/ui/FormComponents.tsx::FormInput` and `FormSelect` work but
use slightly different styling. They stay live for now; replace as part of
page-level form migration.

```tsx
// BEFORE
<FormInput label="Name" name="name" colSpan="sm:col-span-3" />

// AFTER
<TextField label="Name" name="name" className="sm:col-span-3" />
```

### From the legacy `SearchableSelect`

`components/ui/SearchableSelect.tsx` (the original) uses `{ id, name }` option
shape and a controlled-only API. The new `components/ui/form/SearchableSelect.tsx`
uses `{ value, label }` and supports both controlled + uncontrolled, async,
recents, and create-new.

```tsx
// BEFORE — legacy
<SearchableSelect
  label="Unit"
  options={[{ id: "u1", name: "Floor 3 - 301" }]}
  value={unit}
  onChange={setUnit}
/>

// AFTER — new
<SearchableSelect
  label="Unit"
  options={[{ value: "u1", label: "Floor 3 - 301" }]}
  defaultValue={unitId}
  name="unitId"
/>
```

The two coexist until consumers (`CustomerPaymentForm`, `ReservationForm`)
migrate.

### From inline `react-day-picker` direct usage

```tsx
// BEFORE — BookingEngine pattern
const [range, setRange] = useState<DateRange>();
<DayPicker mode="range" selected={range} onSelect={setRange} numberOfMonths={2} />

// AFTER
<DateRangePicker
  label="Stay"
  value={range}
  onValueChange={setRange}
  showPresets
/>
```

The `BookingEngine` / `ReservationForm` migrations are part of the page-level
phase.

### From `<input type="number">`

```tsx
// BEFORE
<input
  type="number"
  name="rate"
  step="0.001"
  className="..."
/>

// AFTER
<NumberField
  label="Rate"
  name="rate"
  currency="OMR"     // precision defaults to 3
/>
```

Fixes the mouse-wheel-changes-value bug + adds locale-aware formatting.

### From `<input type="checkbox">` with custom styling

```tsx
// BEFORE
<label className="...">
  <input type="checkbox" name="active" className="..." />
  Active
</label>

// AFTER
<Checkbox label="Active" name="active" defaultChecked />
```

### From custom radio-as-button groups (PropertyForm, TenantForm)

```tsx
// BEFORE
<button type="button" role="radio" aria-checked={value === "vip"}
  onClick={() => setValue("vip")}
  className="border rounded-lg ...">
  VIP
</button>

// AFTER
<RadioGroup label="Classification" name="classification" defaultValue="regular">
  <Radio value="regular"     label="Regular" />
  <Radio value="vip"         label="VIP" />
  <Radio value="blacklisted" label="Blacklisted" />
</RadioGroup>
```

---

## Sizing scale

| Size | Height | Font | Padding | Use case |
| --- | --- | --- | --- | --- |
| `sm` | 32 px | 13 px | 10 px x | Dense filter bars, inline table edits |
| `md` | 38 px | 14 px | 12 px x | **Default.** Forms, dialogs |
| `lg` | 44 px | 16 px | 14 px x | Hero search, marketing forms, onboarding |

Touch target is always ≥ 40 px even when the visible control is smaller —
clickable area extends through the wrapper label.

---

## Performance notes

- `react-textarea-autosize`, `libphonenumber-js`, `react-day-picker`,
  `react-dropzone` are tree-shakeable. Importing the form barrel
  (`@/components/ui`) doesn't pull all libraries — only what each used component
  needs.
- `libphonenumber-js` has a `min` build that's the default — ~15 KB gzipped.
- `react-day-picker` v9 is ~12 KB gzipped (date-fns peer dep is already used elsewhere).
- `react-dropzone` is ~10 KB gzipped.
- All form components are **client components** (`"use client"` at the top of
  each file). The form atoms work inside server components — they hydrate in
  place. Don't put a server-only function inside a form atom's children.

---

## Token map

Every form component reads from these design tokens (no hardcoded values):

| Token | Purpose |
| --- | --- |
| `bg-surface` | Control background |
| `bg-subtle` | Disabled / read-only background |
| `bg-muted` | Progress bar background, focus subtle overlays |
| `text-fg` | Primary input text |
| `text-fg-tertiary` | Placeholder, helper text, secondary icons |
| `text-fg-disabled` | Disabled text |
| `border-default` | Idle border |
| `border-strong` | Hover border |
| `border-subtle` | Disabled / readonly border |
| `brand-50` / `brand-500` / `brand-600` / `brand-700` | Focus / selected / hover-active / pressed |
| `error-50` / `error-500` / `error-600` / `error-700` | Error border + ring + message |
| `success-50` / `success-500` / `success-600` / `success-700` | Success border + check + message |
| `info-*`, `warning-*` | Used by `Badge` (chips in MultiSelect, etc.) |
| `shadow-focus` / `shadow-focus-error` | 3 px focus ring |
| `duration-fast` / `ease-out` / `ease-spring` | Transitions |
| `radius-md` / `radius-sm` | Field / chip radii |

---

## What's NOT in this system (deferred / out of scope)

- **`Alert` primitive** — `StatusBanner` is currently inlined in `ProfileForm`
  and `OrgSettingsForm`. A dedicated `Alert` is a follow-up component.
- **`RadioCard` chrome** — `RadioGroup variant="cards"` is layout-only today;
  bordered card styling per option is a follow-up small atom.
- **Country picker in `PhoneField`** — Tier 2 ships single-country phone; the
  country dropdown is a Tier 3+ follow-up that pairs with `SearchableSelect`.
- **Password strength meter / rule list** — flagged in spec section 7.4 but
  deferred until the team agrees on the rule set.
- **`react-image-crop` integration** for `ImageUpload` `crop` prop — spec
  scaffolds the prop; full integration is a v2.
- **`zod` server-side schemas** — recommended in the audit §5 as a follow-up
  for stricter action validation.
- **`@hookform/resolvers`** — would arrive only if/when `react-hook-form` is
  adopted. Today's components support RHF via `forwardRef` if added later.

---

## Migration audit reference

The remaining inline form fields to migrate (counts from
[docs/form-field-migration-audit.md](../form-field-migration-audit.md)):

| Surface | Approx. inline fields | Status |
| --- | --- | --- |
| `TenantForm.tsx` | 25+ | **Pending** (largest form) |
| `BookingEngine.tsx` | 20+ | Pending (depends on new `DateRangePicker` + `SearchableSelect`) |
| `PropertyForm.tsx` | 15+ | Pending (local `TextInput` + `FieldLabel` helpers in scope) |
| `UnitForm.tsx` | 12+ | Pending (mix of `FormInput` + inline) |
| `CustomerPaymentForm.tsx` | 10+ | Pending |
| `OrgSettingsForm.tsx` | 10 | Pending (model for validation pattern) |
| `SubmitExpenseForm.tsx` | 8 | Pending |
| `BulkCreateForm.tsx` | 8 | Pending |
| `UnitPricingSection.tsx` | 8 | Pending |
| `ProfileForm.tsx` | 6 | ✅ **Migrated (Phase 5 of this work)** |
| Others (filters, dialogs) | 30+ across ~15 files | Pending |

Total remaining: ~140 inline fields across ~20 files. Page-migration phase
will tackle these one form at a time, with the new components covering 100%
of the patterns identified in the audit.
