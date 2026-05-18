# Alert — Design System

Single primitive for inline status banners, validation summaries, and
informational announcements. Replaces a long tail of duplicated inline divs
(`bg-{color}-50 border border-{color}-200 …`) with one accessible component
that handles role, `aria-live`, dismissal, and the success / warning / error
palette in one place.

Migration audit: [docs/migrations/alert-audit.md](../migrations/alert-audit.md).

---

## Quick reference

| Export | Purpose |
| --- | --- |
| `Alert` | The root component. Renders one banner. |
| `FormErrorSummary` | Preset: form-level error consolidator with anchored field links. |
| `TrialExpiryBanner` | Preset: top-of-page trial countdown + upgrade CTA. |
| `MaintenanceBanner` | Preset: solid full-bleed maintenance strip. |
| `FeatureAnnouncement` | Preset: dismissible brand-tinted product news. |
| `PendingApprovalsBanner` | Preset: warning with count chip + review CTA. |
| `PaymentRecorded` | Preset: success confirmation with primary/secondary actions. |
| `NetworkErrorRetry` | Preset: error with loading-aware retry button. |
| `TenantBlacklistedWarning` | Preset: non-dismissible tenant flag. |
| Types | `AlertProps`, `AlertVariant`, `AlertSize`, `AlertAppearance`, plus one props type per preset. |

All exported from `@/components/ui`:

```tsx
import { Alert, FormErrorSummary } from "@/components/ui";
```

---

## When to use Alert vs Toast vs Inline error

| Need | Use |
| --- | --- |
| Persistent banner the user must see while on the page | **Alert** |
| Form-level error summary at the top of a form | **`FormErrorSummary`** preset |
| Top-of-app announcement (trial, maintenance, feature news) | **Alert** or one of the banner presets |
| Transient action feedback ("Saved", "Sent") that auto-dismisses | **Toast** (`sonner`) |
| Field-level validation message tied to a single input | The form field's own `error` prop, not Alert |

Rule of thumb: if it should disappear by itself in a few seconds, it is a
toast. If it must remain until the user acts on it, it is an Alert. If it is
attached to one input, it is a field error.

---

## Variants

Semantic intent — pick by meaning, not by colour.

| Variant | Default icon | Surface (subtle) | Default a11y |
| --- | --- | --- | --- |
| `info` | `InformationCircleIcon` | `bg-info-50 border-info-200 text-info-700` | `role="status"`, `aria-live="polite"` |
| `success` | `CheckCircleIcon` | `bg-success-50 border-success-200 text-success-700` | `role="status"`, `aria-live="polite"` |
| `warning` | `ExclamationTriangleIcon` | `bg-warning-50 border-warning-200 text-warning-700` | **`role="alert"`, `aria-live="assertive"`** |
| `error` | `ExclamationCircleIcon` | `bg-error-50 border-error-200 text-error-700` | **`role="alert"`, `aria-live="assertive"`** |
| `neutral` | `BellAlertIcon` | `bg-subtle border-border-subtle text-fg-secondary` | `role="status"`, `aria-live="polite"` |
| `announcement` | `MegaphoneIcon` | `bg-brand-50 border-brand-200 text-brand-700` | `role="status"`, `aria-live="polite"` |

The default icon comes from `@heroicons/react/24/outline`. Pass `icon={<… />}`
to override, or `icon={null}` to suppress.

---

## Sizes

`sm` / `md` (default) / `lg` — drives padding, radius, icon size, and type
scale.

| Size | Radius | Padding | Title | Description | Icon |
| --- | --- | --- | --- | --- | --- |
| `sm` | `rounded-md` | `px-3 py-2` | `text-sm semibold` | `text-xs` | 16 px |
| `md` | `rounded-lg` | `px-4 py-3` | `text-sm semibold` | `text-sm` | 18 px |
| `lg` | `rounded-lg` | `px-5 py-4` | `text-base semibold` | `text-sm` | 20 px |

Use `sm` inside dense modal bodies (reservation check-in, return preview).
`md` is the default for forms and detail pages. `lg` is for hero / page-top
banners where the alert is the only thing in that horizontal band.

---

## Appearances

| Appearance | Use for |
| --- | --- |
| `subtle` (default) | The 95% case — soft tinted background + light border |
| `outline` | Surfaces that already have a background (cards, drawers) |
| `solid` | Full-bleed maintenance strips, top-of-app urgent banners |

`solid` flips icon and text to white-on-colour automatically. Caller is
responsible for the full-bleed wrapper if needed (the Alert itself does not
stretch).

---

## API

```ts
interface AlertProps {
  variant?:     AlertVariant;     // default "info"
  size?:        AlertSize;        // default "md"
  appearance?:  AlertAppearance;  // default "subtle"

  title?:       ReactNode;        // short heading
  description?: ReactNode;        // body copy — strings or JSX (links, <strong>, etc.)
  icon?:        ReactNode | null; // override default icon; pass null to suppress
  actions?:     ReactNode;        // typically rendered <Button>s

  dismissible?:  boolean;          // shows an X; you control unmount via onDismiss
  onDismiss?:    () => void;
  dismissLabel?: string;           // default "Dismiss"

  role?:    "alert" | "status";              // override auto-derived role
  ariaLive?: "polite" | "assertive" | "off"; // override auto-derived live region

  className?: string;
  testId?:    string;
  children?:  ReactNode;           // escape hatch — replaces title/description
}
```

Notes:
- The `children` prop bypasses `title`/`description` entirely. Use it when you
  need a list, a checkbox row, or other markup inside the content area —
  see the early-checkout pattern below.
- Action buttons should be `<Button>` instances. Inline `<button>`s in the
  `actions` slot will render but lose the design-system focus / hover states.
- ESC is intercepted **only when the alert is dismissible AND focus is inside
  the alert** — it does not steal global Esc handling.

---

## Patterns

### 1. Simple success confirmation

```tsx
<Alert variant="success" description={t("savedSuccessfully")} />
```

### 2. Error with title and description

```tsx
<Alert
  variant="error"
  title={t("outstandingBalance", { amount: balance.toFixed(3) })}
  description={t("unpaidWarning")}
/>
```

### 3. Form-level error summary

Use the preset — it renders anchored links that focus the offending field on
click.

```tsx
<FormErrorSummary
  errors={[
    { fieldId: "email",    message: t("errors.emailInvalid") },
    { fieldId: "password", message: t("errors.passwordTooShort") },
  ]}
/>
```

Pass a string instead of an array for a single message.

### 4. Inline warning with embedded controls (children escape hatch)

```tsx
<Alert
  variant="warning"
  title={t("earlyCheckout", { count: savedNights })}
  description={
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={adjustCharges}
        onChange={(e) => setAdjustCharges(e.target.checked)}
        className="rounded border-warning-200"
      />
      <span>{t("recalcCharges")}</span>
    </label>
  }
/>
```

### 5. Custom icon

```tsx
<Alert
  variant="info"
  icon={<BanknotesIcon className="h-[18px] w-[18px] text-info-600" aria-hidden="true" />}
  description={t("invoicesExist", { count: invoiceCount })}
/>
```

When overriding the icon, set the size and colour yourself — the Alert only
applies its defaults to the auto-derived icon. The container handles
positioning and `flex-shrink-0` automatically.

### 6. Dismissible announcement

```tsx
const [dismissed, setDismissed] = useState(false);
if (dismissed) return null;

<FeatureAnnouncement
  title={t("newCalendar.title")}
  description={t("newCalendar.body")}
  actionLabel={t("tryIt")}
  onAction={() => router.push("/dashboard/calendar")}
  onDismiss={() => {
    setDismissed(true);
    localStorage.setItem("dismissed-new-calendar", "1");
  }}
/>
```

The Alert never unmounts itself — the parent decides when to remove it.

### 7. Top-of-app solid banner

```tsx
<MaintenanceBanner
  severity="warning"
  message={t("maintenance.tonight", { time: "22:00" })}
/>
```

Render directly inside the layout shell, above the `<Header>`, so it spans the
full viewport.

---

## Accessibility

- Error and warning variants set `role="alert"` and `aria-live="assertive"`
  so screen readers announce them immediately. The other variants use
  `role="status"` and `aria-live="polite"`. Override via the `role` /
  `ariaLive` props when needed.
- The icon carries `aria-hidden="true"` so it does not duplicate the title for
  AT users; semantics come from the role + text.
- Colour is **never** the only signal — the icon and the title carry the
  meaning. Variant changes never hide content from non-sighted users.
- Dismiss button has `aria-label` (defaults to "Dismiss") and is reachable in
  natural tab order.
- ESC inside the alert calls `onDismiss` if `dismissible` is set. This does
  not propagate, so it will not also close a surrounding modal.
- Animations inherit the global `prefers-reduced-motion` override from
  `styles/design-tokens.css` — no per-component handling needed.

---

## RTL

The Alert uses logical flex layout (`flex` + `gap`) and no `left`/`right`
literals, so it flips automatically with `dir="rtl"`. The icon stays on the
inline-start edge in both directions. Dismiss button stays on the inline-end
edge.

If you pass JSX into `description`, use logical Tailwind utilities (`ms-*`,
`me-*`, `ps-*`, `pe-*`) for any custom spacing.

---

## Things to avoid

- **Do not use Alert for transient feedback.** "Saved" / "Sent" / "Copied"
  belong in a `sonner` toast. Alerts persist until the user acts on them.
- **Do not stack three alerts in a row.** If you have multiple errors,
  use `FormErrorSummary` with an `errors` array — one alert with a list reads
  much better than three separate banners.
- **Do not put `<button>` markup in `actions`.** Use the `<Button>` component
  so focus rings, loading states, and hover treatment stay consistent.
- **Do not pick the variant by colour.** "I want amber" is not a reason —
  pick by intent: is this a warning (something needs attention) or info
  (something for context)?
- **Do not put alerts inside table cells.** Inline errors belong on the field;
  row-level state belongs in a badge.
- **Do not migrate composite data tiles to Alert.** The guest profile chip
  and the multi-state stay summary in `ReservationDetail` look alert-shaped
  but are persistent data displays — Alert's announce semantics would be
  wrong there.
- **Do not migrate `sonner` toasts to Alert** during a refactor. Toasts have
  their own dismissal and queueing model; pulling them into Alert would
  break the transient-feedback contract.

---

## Migration history

Phase 1 audit → Phase 2 build (Alert + 8 presets, six variants, three sizes,
three appearances, palette tokens added) → Phase 3 four-file
`StatusBanner` retirement → Phase 4 inline-alert sweep across
`ReservationDetail`, `ReservationsView`, `LoginForm`, `SmartPaymentForm`,
and the payments / invoices detail pages.

Deferred:
- `AcceptForm.tsx` — uses a dark auth-shell surface (`bg-red-900/30
  text-red-400`). The Alert does not yet ship an `appearance="dark"`. Pick
  up when that variant lands.
- The full-bleed urgent banner and the refund-pending strip in
  `ReservationDetail` (`L1788`, `L1797`) — kept as bespoke layouts; their
  full-page-width treatment does not fit the Alert container model.

Net change across Phases 3–4: **~170 lines of inline alert markup removed**
in exchange for a single accessible primitive. The amber-vs-yellow
inconsistency the audit flagged is resolved — every warning surface now
shares the same palette.
