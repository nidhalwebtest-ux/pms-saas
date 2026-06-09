# Modal — Design System

The composable modal primitive used everywhere from "Add tenant" forms to
full-screen receipt viewers. Built on `@headlessui/react@2.x` Dialog wrapped
in our `<Modal>` / `<ModalHeader>` / `<ModalBody>` / `<ModalFooter>` API. Call
sites never import Headless UI directly.

Migration audit: [docs/migrations/modal-migration-audit.md](../migrations/modal-migration-audit.md).

---

## Quick reference

| Component | Purpose |
| --- | --- |
| `Modal` | Outer container — open state, size, variant, tone, backdrop, animation, scroll lock, focus trap |
| `ModalHeader` | Title + subtitle + optional icon + close button (renders progress bar when `progress` is set) |
| `ModalBody` | Scrollable content area with `overscroll-contain`. Renders centered spinner / error retry when Modal's `loading` / `error` are set |
| `ModalFooter` | Sticky action row with `justify="end" \| "between" \| "start"` |
| `useModal` | `{ isOpen, open, close, toggle }` — local open-state helper |

**All exported from `@/components/ui`:**

```tsx
import {
  Modal, ModalHeader, ModalBody, ModalFooter,
  useModal,
} from "@/components/ui";
```

---

## When to use Modal vs Drawer vs BottomSheet

| Need | Variant |
| --- | --- |
| Standard form (add/edit) | `centered` (default) |
| Long form with room to grow | `top-aligned` |
| Detail view that shouldn't lose page context | `drawer-end` (or `drawer-start` rarely) |
| Mobile-first quick action | `bottom-sheet` |
| Full-screen lightbox / media viewer | `size="full"` `variant="centered"` `backdropBlur` |
| Destructive confirmation | Use [`ConfirmDialog`](./confirm-dialog.md) — not `Modal` directly |

**Below the `sm` breakpoint (< 640 px):**
- `centered` / `top-aligned` auto-convert to a bottom-sheet (full-width, slides up from the bottom). Override with `fullScreenOnMobile={false}` if you really want the desktop look.
- `drawer-*` stays a drawer but gets full-width.
- `size="xl"` / `size="full"` always fill the screen.

---

## Sizes

| Size | Sheet width (centered / top-aligned) | Drawer width |
| --- | --- | --- |
| `sm` | 480 px | 380 px |
| `md` | 640 px | 480 px |
| `lg` | 768 px | 640 px |
| `xl` | 1024 px | 800 px |
| `full` | min(90vw, 1280 px) | min(95vw, 1280 px) |

Sheet max-height: `min(85vh, 720px)`. Body scrolls when overflowed. Drawer
panels are always full-viewport-height.

---

## Common patterns

### 1. Standard form modal

```tsx
const modal = useModal();

<Button onClick={modal.open}>Add tenant</Button>

<Modal open={modal.isOpen} onClose={modal.close} size="md">
  <ModalHeader title="Add tenant" subtitle="Create a new tenant profile" />
  <form id="add-tenant" onSubmit={handleSubmit}>
    <ModalBody>
      <TextField label="Full name" name="fullName" required />
      <PhoneField label="Mobile" name="phone" required />
      <TextField label="Email" name="email" type="email" />
    </ModalBody>
    <ModalFooter>
      <Button variant="ghost" type="button" onClick={modal.close}>Cancel</Button>
      <Button type="submit" loading={pending}>Create tenant</Button>
    </ModalFooter>
  </form>
</Modal>
```

**Why the `form` ID + `type="submit"`:** the submit button lives in the footer
which is a sibling of the form body. Use a `form="add-tenant"` reference, or
wrap the whole `<Modal>` contents in a single `<form>` (footer included) as in
this example.

### 2. Drawer-end (detail view) with backdrop blur

```tsx
<Modal open={open} onClose={close} size="md" variant="drawer-end" backdropBlur>
  <ModalHeader title="Payment INV-2024-0421" subtitle="Received 12 Apr 2024" />
  <ModalBody>
    <PaymentTimeline events={timeline} />
    <ReceiptPreview src={receiptUrl} />
  </ModalBody>
  <ModalFooter justify="between">
    <Button variant="ghost">Download receipt</Button>
    <Button>Apply to invoice</Button>
  </ModalFooter>
</Modal>
```

In LTR the drawer slides in from the right; in RTL it slides in from the
left — via logical `ms-auto` / `me-auto` + direction-aware `translate`.

### 3. Destructive confirmation — use ConfirmDialog

Reach for [`ConfirmDialog`](./confirm-dialog.md) instead of building this
shape by hand. It composes `<Modal tone="destructive">` plus the
header icon, the Cancel/Confirm pair, and an imperative
`await confirm(...)` API. It also handles reason fields, type-to-confirm
guards, and async loading.

```tsx
const confirm = useConfirmDialog();

if ((await confirm({
  title: "Cancel reservation?",
  description: "This voids 2 invoices totaling 1,540.000 OMR.",
  tone: "destructive",
  confirmLabel: "Cancel reservation",
  cancelLabel: "Keep reservation",
})).confirmed) {
  // …
}
```

### 4. Multi-step with progress bar

```tsx
const [step, setStep] = useState(1);
const total = 4;

<Modal open={open} onClose={close} size="md" progress={{ step, total }}>
  <ModalHeader title={`Check-in · step ${step} of ${total}`} />
  <ModalBody>{renderStep(step)}</ModalBody>
  <ModalFooter justify="between">
    <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 1}>
      Back
    </Button>
    <Button onClick={() => setStep((s) => s + 1)} disabled={step === total}>
      Continue
    </Button>
  </ModalFooter>
</Modal>
```

Progress is a 2 px brand bar at the top of the panel. Width animates over
`duration-medium`.

### 5. Async-loaded detail

```tsx
<Modal
  open={open}
  onClose={close}
  size="lg"
  loading={isFetching}
  error={err}
  onRetry={refetch}
>
  <ModalHeader title="Activity log" />
  <ModalBody>
    {data && <ActivityTimeline events={data} />}
  </ModalBody>
</Modal>
```

When `loading` is true, `ModalBody` renders a centered Spinner + "Loading…"
text regardless of children. When `error` is set, it renders an icon + the
error string + a Retry button (when `onRetry` is also provided).

### 6. Full-screen lightbox / media viewer

```tsx
<Modal
  open={open}
  onClose={close}
  size="full"
  variant="centered"
  backdropBlur
  fullScreenOnMobile={false}
  className="!shadow-none !bg-transparent"
>
  <ModalBody noPadding>
    <img src={receiptUrl} alt="" className="max-h-[85vh] mx-auto object-contain" />
  </ModalBody>
</Modal>
```

The `!shadow-none !bg-transparent` overrides remove the modal chrome so the
image floats over the blurred backdrop. `ModalBody noPadding` removes the
default `px-6 py-5`.

---

## Programmatic usage via `useModal`

For in-component modals, `useModal` is the simplest helper:

```tsx
const modal = useModal();         // initial: false

// Open from a button
<Button onClick={modal.open}>Open</Button>

// Open from a row action
<button onClick={modal.open}>Edit</button>

<Modal open={modal.isOpen} onClose={modal.close}>…</Modal>
```

For **programmatic open from non-React contexts** (action menus, command
palette, async error handlers), the next component on the design-system
roadmap — `ConfirmDialog` — introduces a context-based dispatcher
(`useConfirmDialog()`) that you can call from anywhere. Until then, lift
your modal's state up to a parent component that's always mounted.

---

## Accessibility

All a11y guarantees come from Headless UI Dialog. You get these for free:

| Requirement | Source |
| --- | --- |
| `role="dialog"` + `aria-modal="true"` on the panel | `Dialog` |
| `aria-labelledby` pointing to the title | `DialogTitle` (rendered by `ModalHeader`) |
| Focus trap — Tab cycles only inside the panel | `Dialog` |
| Initial focus moves into the panel on open | `Dialog` |
| Focus returns to the trigger on close | `Dialog` |
| ESC closes (configurable via `closeOnEsc`) | `Dialog` |
| Backdrop click closes (configurable via `closeOnBackdrop`) | `Dialog` |
| Body scroll lock without layout shift | `RemoveScroll` (built into HUI) |
| Stacked modals are ordered correctly | HUI portal layering |
| Close button has `aria-label="Close"` | Wired in `ModalHeader` |
| Reduced motion respected | Tailwind transitions auto-skip transforms |

**What the consumer is responsible for:**
- Move focus to the right element after open if not the default (use `initialFocus` on a future enhancement, or call `.focus()` in `useEffect`).
- Don't render disabled `<Button>` elements as the first focusable child — Tab would skip them and confuse users.
- Don't disable both `closeOnBackdrop` AND `closeOnEsc` unless you've added an explicit close affordance in the footer.

---

## Animation specifications

| Phase | Duration | Easing | Property |
| --- | --- | --- | --- |
| Backdrop in | `duration-fast` (~80 ms) | `ease-out` | opacity 0 → 1 |
| Panel in (centered) | `duration-fast` | `ease-out` | scale 0.95 → 1, opacity 0 → 1 |
| Panel in (top-aligned) | `duration-fast` | `ease-out` | translateY(-16) → 0, opacity 0 → 1 |
| Panel in (drawer) | `duration-medium` (~150 ms) | `ease-out` | translateX(100%) → 0 |
| Panel in (bottom-sheet) | `duration-medium` | `ease-out` | translateY(100%) → 0 |
| Panel out (all) | reverse | — | — |
| Progress bar | `duration-medium` | `ease-out` | width transition |

Animations use Tailwind's `data-[closed]:*` variants on Headless UI's
`transition` prop. No `framer-motion` dependency.

`prefers-reduced-motion`: Tailwind utilities (`motion-safe:` / `motion-reduce:`)
respect the user setting — transforms are skipped, opacity-only is preserved.

---

## RTL behavior

Apply `[dir="rtl"]` once at the document root. Every Modal variant flips
correctly via logical Tailwind utilities:

| Aspect | LTR | RTL |
| --- | --- | --- |
| Close button | Top-right | Top-left (`-me-2`) |
| Drawer-end position | Right edge | Left edge (logical `end`) |
| Drawer-start position | Left edge | Right edge (logical `start`) |
| Footer alignment | `justify-end` → right | `justify-end` → left |
| Drawer entry direction | From right | From left (translate-x inverted via `rtl:` variant) |
| Progress bar fill | LTR | RTL (uses width, direction-agnostic) |

The close button's `-me-2` ensures it sits at the visual end regardless of
direction. Don't hard-code `mr-` / `ml-` anywhere inside Modal sub-components.

---

## Mobile behavior

- **Below `sm` breakpoint** (< 640 px), `centered` / `top-aligned` modals
  auto-convert to a bottom-sheet (full-width, slides up from the bottom).
- **Drawers** stay drawer-shaped at mobile but expand to full width.
- **Size `xl` / `full`** fill the screen.
- **Touch targets** in the modal header / footer are ≥ 40 px (the close
  Button is 28 × 28 but the wrapping label extends to 40 × 40 via padding).
- **Scroll behavior** is the same on mobile and desktop: only the body
  scrolls; header and footer are sticky.

To opt out of mobile auto-convert (rare — usually you want it):

```tsx
<Modal fullScreenOnMobile={false} … />
```

This is used by the `ReceiptLightbox` migration — full-screen image viewers
should fill the screen regardless of breakpoint.

---

## Customizing the backdrop

Default backdrop: `bg-black/45` per the design tokens. Three knobs:

- **`backdropBlur={true}`** — adds `backdrop-blur-sm`. Use for drawers and
  full-screen modals where the page behind would distract.
- **Hard override via Modal `className`** — affects the panel; not the
  backdrop. For backdrop overrides, a `backdropClassName` prop is a planned
  follow-up.
- **Image viewers** that need a near-opaque backdrop should follow the
  `ReceiptLightbox` pattern (Modal `className="!bg-transparent"` + `ModalBody
  className="bg-black/85"`).

---

## Migration guide — from inline `fixed inset-0`

The 8 inline modals migrated in this session follow these patterns.

### Pattern A — Simple form modal with footer actions

```tsx
// BEFORE
{open && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
    <div className="bg-white rounded-2xl shadow-xl ring-1 ring-gray-200 w-full max-w-md overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">Process expense</h3>
        <button onClick={onClose}><XMarkIcon className="h-5 w-5" /></button>
      </div>
      <div className="px-5 py-4 space-y-4">{/* form */}</div>
      <div className="px-5 py-3 bg-gray-50 border-t flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={handle}>Process</Button>
      </div>
    </div>
  </div>
)}

// AFTER
<Modal open={open} onClose={onClose} size="sm">
  <ModalHeader title="Process expense" />
  <ModalBody>{/* form */}</ModalBody>
  <ModalFooter>
    <Button variant="ghost" onClick={onClose}>Cancel</Button>
    <Button onClick={handle}>Process</Button>
  </ModalFooter>
</Modal>
```

### Pattern B — Destructive confirmation

```tsx
// BEFORE — bespoke red header
<div className="px-5 py-4 bg-red-50 border-b border-red-100 …">
  <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
  <h3>Reject expense</h3>
</div>

// AFTER — use the tone prop
<Modal open={open} onClose={close} size="sm" tone="destructive">
  <ModalHeader
    title="Reject expense"
    icon={
      <div className="p-2 bg-error-100 rounded-md">
        <ExclamationTriangleIcon className="h-5 w-5 text-error-600" />
      </div>
    }
  />
  …
  <ModalFooter>
    <Button variant="ghost" onClick={close}>Cancel</Button>
    <Button variant="destructive" onClick={reject}>Reject</Button>
  </ModalFooter>
</Modal>
```

### Pattern C — Local "ModalShell" helper

If you find yourself with a local `ModalShell` or `Modal` helper in a file:

```tsx
// BEFORE
function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 …">
      <div className="bg-white rounded-xl … max-w-md">
        <div className="… border-b …">
          <h3>{title}</h3>
          <Button onClick={onClose} aria-label="Close"><XMarkIcon /></Button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

<ModalShell title={t("title")} onClose={onClose}>
  {/* body */}
</ModalShell>

// AFTER — delete the helper, use Modal directly
<Modal open onClose={onClose} size="sm">
  <ModalHeader title={t("title")} />
  <ModalBody>
    {/* body */}
  </ModalBody>
</Modal>
```

If the call sites are many (10+) and the body content varies, `sed` is the
fastest way to mechanically swap opening / closing tags — see the
`ReservationDetail` migration commit for an example.

### Pattern D — Full-screen lightbox / media viewer

```tsx
// BEFORE
<div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm">
  <img src={…} className="max-h-[85vh] mx-auto" />
  <button onClick={close}>×</button>
</div>

// AFTER
<Modal
  open
  onClose={close}
  size="full"
  variant="centered"
  backdropBlur
  fullScreenOnMobile={false}
  className="!shadow-none !bg-transparent"
>
  <ModalBody noPadding>
    {/* image + overlay UI */}
  </ModalBody>
</Modal>
```

### Pattern E — Quick "add nested entity" modal embedded in a form

```tsx
// BEFORE — duplicate in CustomerPaymentForm + ReservationForm
{isTenantModalOpen && (
  <div className="fixed inset-0 z-[60] …">
    <div className="bg-white rounded-xl … max-w-2xl">
      <div className="sticky top-0 …">
        <h2>Add Quick Tenant</h2>
        <button onClick={() => setIsTenantModalOpen(false)}><XMarkIcon /></button>
      </div>
      <div className="p-6">
        <TenantForm onSuccess={…} />
      </div>
    </div>
  </div>
)}

// AFTER — same shape, both files
<Modal
  open={isTenantModalOpen}
  onClose={() => setIsTenantModalOpen(false)}
  size="lg"
  backdropBlur
>
  <ModalHeader title="Add Quick Tenant" />
  <ModalBody>
    <TenantForm onSuccess={…} />
  </ModalBody>
</Modal>
```

---

## What's NOT in this system (deferred follow-ups)

- **`ConfirmDialog`** — prebuilt destructive / info confirmation with a
  `useConfirmDialog()` hook. Next component on the roadmap.
- **Scroll-shadow indicators on `ModalBody`** — top/bottom shadow strips
  when content overflows. Implementation deferred (~30 LoC IntersectionObserver).
- **`backdropClassName` prop** — for cases like ReceiptLightbox needing a
  much darker backdrop than the standard `/45`. Workaround for now is to
  set `Modal className="!bg-transparent"` and tint the body separately.
- **Programmatic context dispatcher** — `useDialog()` provider for opening
  modals from outside React. ConfirmDialog will land this pattern.
- **`success` tone auto-close** — spec mentions a 1.2 s auto-close after a
  green flash. Today the tone-tint works; the auto-close timing is
  consumer-managed.
- **`initialFocus` ref** — defaults to the first focusable element in the
  panel. Custom initial focus (e.g. a specific form field) needs a
  `useEffect` on the consumer side for now.

---

## What this session migrated (Phase 3, 8 commits)

| File | Pattern | Commit |
| --- | --- | --- |
| `app/dashboard/expenses/modals/ReceiptLightbox.tsx` | Full-screen image viewer | Phase 3.1 |
| `app/dashboard/expenses/modals/ProcessExpenseModal.tsx` | Standard form modal | Phase 3.2 |
| `app/dashboard/expenses/modals/RejectExpenseModal.tsx` | Destructive confirmation | Phase 3.3 |
| `app/dashboard/invoices/[id]/InvoiceActions.tsx` | Payment-record modal | Phase 3.4 |
| `components/dashboard/CustomerPaymentForm.tsx` | Inline tenant-modal duplicate | Phase 3.5 |
| `components/dashboard/ReservationForm.tsx` | Inline tenant-modal duplicate | Phase 3.6 |
| `app/dashboard/reservations/ReservationsView.tsx` | Local `ModalShell` helper + 4 call sites | Phase 3.7 |
| `app/dashboard/reservations/[id]/ReservationDetail.tsx` | Local `Modal` helper + 10 call sites | Phase 3.8 |

**Out of scope** (page-level, separate sessions): `ExtendStayModal`,
`MoveUnitModal`, `BookingEngineModal`, `UnitPricingSection` `PriceModal`,
`AvailabilityCalendar` overlay, `CreateTenantModal` (Next.js `@modal` slot),
`SlideOver`.

---

See `components/ui/modal/` for the production source and
`docs/migrations/modal-migration-audit.md` for the pre-migration inventory.
