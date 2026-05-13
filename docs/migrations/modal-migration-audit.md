# Modal migration audit

Phase 1 of the Modal system rollout. Inventory of every modal-shaped pattern
in the codebase before the new primitive lands.

Scope: `app/`, `components/`, `package.json`. Date: 2026-05-12.

---

## 1. Headline numbers

| Metric | Value |
| --- | --- |
| Inline `fixed inset-0` modal scaffolds | **16 files** |
| Named modal helpers (`ModalShell`, `Modal`) | **2** (both local, both duplicates) |
| Files using Headless UI `Dialog` directly | **1** (`CreateTenantModal.tsx`) |
| Files using `@radix-ui/react-dialog` | **0** (not installed) |
| Files using `createPortal` directly | **0** |
| Files using a custom drawer pattern | **1** (`components/ui/SlideOver.tsx`) |
| Animation library (`framer-motion`, etc.) | **none** |
| Files with proper `role="dialog"` + `aria-modal` | **2** (CreateTenantModal via HUI, SlideOver via manual wiring) |
| Files with focus trap | **2** (same as above) |
| Files with scroll lock | **2** (same) |
| Estimated lines of inline-modal markup to consolidate | ~600 |

---

## 2. Libraries already in `package.json`

| Package | Version | Modal-relevant? |
| --- | --- | --- |
| `@headlessui/react` | `^2.2.9` | ✅ Yes — provides `Dialog`, `DialogPanel`, `DialogTitle`, `DialogBackdrop`, `Transition`. Already used by `Combobox`, `Listbox`, and one `Dialog` |
| `@heroicons/react` | `^2.2.0` | Icon source (close X, etc.) |
| `clsx` | `^2.1.1` | Conditional classnames |
| `tailwind-merge` | `^3.4.0` | Class merging |
| `next` | `^16.1.5` | Provides `@modal` parallel-route slot |
| `@radix-ui/react-dialog` | **NOT INSTALLED** | Spec recommendation |
| `framer-motion` | **NOT INSTALLED** | Spec-mentioned only for prefers-reduced-motion fallback |

---

## 3. The 2 existing local "ModalShell" implementations

### 3.1 `app/dashboard/reservations/ReservationsView.tsx::ModalShell` (L413)

```tsx
function ModalShell({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close">
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
```

- **Props:** `{ title, onClose, children }` — minimal.
- **Visual:** centered, `rounded-xl`, `max-w-md`, `bg-black/40` + `backdrop-blur-sm`.
- **A11y:** no `role="dialog"`, no focus trap, no scroll lock, no ESC handling. Background scrolling is technically possible.
- **Used by 4 call sites in the same file** — the CheckIn / CheckOut / Cancel / NoShow modals (each hosts its own form via this shell).
- **Footer convention:** the shell renders no footer; consumers add their own action row inside `children`.

### 3.2 `app/dashboard/reservations/[id]/ReservationDetail.tsx::Modal` (L277)

```tsx
function Modal({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close">
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
```

- **Props:** `{ title, onClose, children }` — same shape as ModalShell.
- **Drift vs ModalShell:** `rounded-2xl` (vs `rounded-xl`), `max-w-lg` (vs `max-w-md`), `bg-black/50` no blur (vs `bg-black/40` + blur), `max-h-[90vh] overflow-y-auto` (vs no scroll handling), padding `px-6 py-4 / px-6 py-5` (vs `px-5 py-4`).
- **A11y:** same gaps as ModalShell — no role, no trap, no scroll lock, no ESC.
- **Used by ~8 call sites in ReservationDetail** — GenerateInvoicesModal, ChangeUnitModal, RecordPaymentModal, CancelInvoiceModal, ApplyPaymentModal, etc. (it's the host for every action modal on the detail page).

**Two files, two different visual treatments, same conceptual job.** Spec consolidates both.

---

## 4. The Headless-UI `Dialog` already wired (the model)

**`app/dashboard/@modal/CreateTenantModal.tsx`** is the only file using `@headlessui/react` `Dialog` + `Transition`. It's the closest-to-correct pattern in the codebase:

- ✅ `Dialog as="div"` + `Dialog.Panel` provides `role="dialog"` and `aria-modal`.
- ✅ `Dialog.Title` provides `aria-labelledby`.
- ✅ `Transition.Root` provides open/close animation.
- ✅ Focus trap (HUI default).
- ✅ ESC key handling (HUI default).
- ✅ Body scroll lock (HUI default).
- ⚠ Backdrop uses `bg-gray-500 bg-opacity-75` (Tailwind-style legacy) instead of design tokens.
- ⚠ Close button rendered outside the title row via `absolute` positioning.
- ⚠ Form markup inside is bespoke (uses old inline inputs, not new form components).

**This file proves the HUI Dialog pattern works in our app today.**

---

## 5. The 16 inline modal scaffolds

Per `grep -ln "fixed inset-0"`:

| File | Type | Notes |
| --- | --- | --- |
| `components/ui/SlideOver.tsx` | Custom drawer | Powers Next.js @modal parallel-route slot; manual `role="dialog"` + `aria-modal`; bespoke CSS transition; 300ms timeout-based unmount |
| `components/dashboard/BookingEngineModal.tsx` | Large host | Hosts BookingEngine inside a `max-w-8xl` centered modal |
| `components/dashboard/AvailabilityCalendar.tsx` | Full-screen | Calendar overlay |
| `components/dashboard/AvailabilityCalendarButton.tsx` | FAB toggler | Spawns the above |
| `components/dashboard/CustomerPaymentForm.tsx` | Inline tenant-modal | **Duplicate of ReservationForm** — see §6 |
| `components/dashboard/ReservationForm.tsx` | Inline tenant-modal | **Duplicate of CustomerPaymentForm** — see §6 |
| `components/dashboard/units/UnitPricingSection.tsx` | PriceModal | Local component for rate add/edit |
| `components/reservations/ExtendStayModal.tsx` | Full modal | Date extension + availability check |
| `components/reservations/MoveUnitModal.tsx` | Full modal | Unit swap with rate-diff handling |
| `app/dashboard/expenses/modals/ProcessExpenseModal.tsx` | Bespoke | Payment method selector |
| `app/dashboard/expenses/modals/RejectExpenseModal.tsx` | Bespoke | Red header |
| `app/dashboard/expenses/modals/ReceiptLightbox.tsx` | Lightbox | Full-screen image viewer with keyboard nav |
| `app/dashboard/reservations/ReservationsView.tsx` | Uses local `ModalShell` (§3.1) | 4 inline modals |
| `app/dashboard/reservations/[id]/ReservationDetail.tsx` | Uses local `Modal` (§3.2) | ~8 inline modals |
| `app/dashboard/invoices/[id]/InvoiceActions.tsx` | Payment-record modal | Pure inline `fixed inset-0` |
| `app/dashboard/@modal/CreateTenantModal.tsx` | HUI Dialog (§4) | The gold-standard reference |

**Z-index hardcoded:** every file uses `z-50` except `CreateTenantModal` (`z-50` on outer + `z-10` on inner via HUI default). No stacking strategy.

**Backdrop colors:** `bg-black/40`, `bg-black/50`, `bg-black/85` (lightbox), `bg-gray-500 bg-opacity-75` (HUI), `bg-gray-500/75` — 5 different shades for the same conceptual layer.

**Panel radii:** `rounded-xl`, `rounded-2xl`, `rounded-lg` — three variants for the same conceptual surface.

**Padding inside panel:** `px-4 py-4`, `px-5 py-4`, `px-6 py-4 / py-5`, `px-4 pb-4 pt-5 sm:p-6` — five variants.

---

## 6. The duplicate inline tenant-modal (explicit migration target per the user prompt)

The two files at almost-identical inline modals:

### `components/dashboard/CustomerPaymentForm.tsx`
Inline tenant quick-add modal embedded in the payment form. Same shape:
- Backdrop + centered panel
- Header with title + close button
- Form with name + phone + email fields
- Footer with Cancel + Create buttons

### `components/dashboard/ReservationForm.tsx`
**Verbatim copy** of the above with cosmetic differences. Same fields, same submit behavior, same close logic.

Both are unwired manually:
- No focus trap.
- No ESC handling.
- No scroll lock.
- Backdrop click closes? Inconsistent.

After migration both call sites use `<Modal size="sm" open={open} onClose={close}>` rendering the same form body.

---

## 7. Accessibility today

| Concern | Status across the 16 files |
| --- | --- |
| `role="dialog"` + `aria-modal` | **2 / 16** (CreateTenantModal via HUI, SlideOver via manual wiring) |
| Focus trap | **2 / 16** (same as above) |
| Body scroll lock | **2 / 16** (same) |
| ESC closes | **2 / 16** (CreateTenantModal, SlideOver) |
| Backdrop click closes | mixed — most yes via `onClick={close}` on the backdrop div, some no (no handler) |
| Close button has `aria-label` | **Yes everywhere** (post-Phase-3 Button migration) |
| `aria-labelledby` to title | only on the 2 a11y-correct ones |
| Multiple modals stack correctly | No — every modal uses `z-50` without coordination |
| Return-focus on close | Not implemented in any inline modal |

---

## 8. Library recommendation — **Headless UI (already installed)**

The spec recommends `@radix-ui/react-dialog`. After reviewing the codebase I recommend **using `@headlessui/react` Dialog instead** for the following reasons:

| Factor | Headless UI | Radix UI |
| --- | --- | --- |
| Already in deps | ✅ `@headlessui/react@2.2.9` (used by Combobox, Listbox, one Dialog) | ❌ would need install (~10 KB gz) |
| Focus trap | ✅ built-in | ✅ built-in |
| Scroll lock | ✅ built-in | ✅ built-in |
| ESC + click-outside | ✅ built-in | ✅ built-in |
| Composable header/footer | ✅ via composition + Tailwind | ✅ slightly cleaner sub-components |
| Drawer transitions | Slightly more verbose with `Transition` | Slightly cleaner via `data-state` attrs |
| RTL | both fine (logical props in our Tailwind) | same |
| API surface | already familiar to the codebase | new mental model |

**Net:** the spec's Radix preference is defensible but the practical difference for our use case is small. Zero new deps + consistency with the existing Combobox / Listbox stack outweighs the marginal API improvement. Spec's accessibility requirements are met identically by both libraries.

**Recommendation:** `@headlessui/react` Dialog wrapped with our `<Modal>` / `<ModalHeader>` / `<ModalBody>` / `<ModalFooter>` API. Call sites never import `@headlessui/react Dialog` directly.

If the team strongly prefers Radix per the spec, it's a 1-commit dependency swap during Phase 2 — recommend deciding now before code lands.

---

## 9. Animation strategy

No animation library installed. Two choices:

### (a) Headless UI `Transition` + Tailwind classes (recommended)
HUI v2 supports `transition` prop on `Dialog` / `DialogBackdrop` / `DialogPanel`. We pass enter/leave class strings:

```tsx
<DialogBackdrop transition className="data-[closed]:opacity-0 ..." />
<DialogPanel transition className="data-[closed]:scale-95 data-[closed]:opacity-0 ..." />
```

- No new deps.
- Tailwind animation utilities (`duration-fast`, `ease-out`, our motion tokens) cleanly compose.
- HUI manages mount/unmount timing — no setTimeout dance.

### (b) Custom timeout-unmount pattern (like SlideOver)
Used by SlideOver today (`setTimeout(() => router.back(), 300)`). Fragile, requires per-modal timing constants.

**Recommendation: (a).** Modal's animation uses the design system's `duration-fast` / `duration-medium` tokens and HUI's `transition` prop. Reduced-motion respected via Tailwind's `motion-safe:` / `motion-reduce:` variants.

---

## 10. Migration scope estimate

### In scope for this session (per the user's spec)

1. **2 local ModalShell helpers** — `ReservationsView.tsx::ModalShell` and `ReservationDetail.tsx::Modal`. ~12 call sites combined.
2. **Inline tenant-modal in `CustomerPaymentForm`** (1 file).
3. **Inline tenant-modal in `ReservationForm`** (1 file).
4. **Any other inline modal patterns found** — TBD per file. Reasonable additions:
   - `app/dashboard/expenses/modals/ReceiptLightbox.tsx` — fits `size="full" noPadding`
   - `app/dashboard/expenses/modals/ProcessExpenseModal.tsx` — fits `size="sm"`
   - `app/dashboard/expenses/modals/RejectExpenseModal.tsx` — fits `size="sm"` `tone="destructive"`
   - `app/dashboard/invoices/[id]/InvoiceActions.tsx` payment modal — fits `size="md"`
   
   These are the small, self-contained modals where the migration is mechanical. **Recommend including them.**

### Out of scope per the user's "DO NOT IN THIS SESSION"

- **Page-level form modals:** `ExtendStayModal`, `MoveUnitModal`, `BookingEngineModal`, `UnitPricingSection`'s PriceModal, `AvailabilityCalendar` overlay, `CreateTenantModal` (Next.js @modal slot wrapper).
- **`SlideOver.tsx`** — used by the Next.js parallel-route slot mechanism. Touches routing semantics. Future migration.

---

## 11. Concerns / edge cases discovered

1. **Z-index collision** — every inline modal uses `z-50`. If two modals open simultaneously (e.g., a payment-record modal opening over a reservation-detail modal), they fight for the same layer. HUI Dialog handles this via portal stacking, but we should pick a base `z-index: 50` and increment per modal layer.

2. **Backdrop blur** today is binary — either `backdrop-blur-sm` or none. Spec recommends `off by default, on for drawers and full-screen` to keep transitions cheap on lower-end devices. Will follow.

3. **Mobile breakpoint behavior** — the spec says centered/top-aligned auto-convert to `bottom-sheet` below 640 px. Today every modal stays centered at all widths; on a phone the panel either overflows or gets cramped. Important behavior change worth highlighting.

4. **Two ModalShells render their "Cancel" buttons inline inside the body** rather than in a footer slot. After migration with `<ModalFooter>`, the visual changes from `body-end Cancel/Save` to `bordered footer with Cancel/Save`. Slight visual shift, more consistent across the app.

5. **The lightbox is `bg-black/85`** for image viewing — almost-opaque. New Modal's default backdrop is `bg-black/45`. `<Modal size="full" backdropBlur>` is the right migration; we may need a separate `backdropOpacity?` knob or just let the lightbox use a `className` override on the backdrop.

6. **`Transition` from `@headlessui/react`** is a different import in v2 (it's `Transition` from `@headlessui/react`, not `Transition.Root`). The existing `CreateTenantModal.tsx` uses the legacy v1-style `Transition.Root` and `Transition.Child`. When migrating we'll standardize on v2's `Transition` API. (HUI v2 supports both syntaxes for backward compat, but v2's cleaner form is preferred.)

7. **The form components shipped earlier are already RTL-safe** with logical props. Modal needs the same discipline — `ms-auto` / `me-auto`, `ps-*` / `pe-*`. Close button must be `top-* end-*`.

8. **Body scroll lock** without layout shift requires HUI's `RemoveScroll` (built into Dialog). Don't try to roll our own — the page-jump-when-modal-opens bug is a year-long classic.

9. **The `tone="destructive"`** variant from the spec doesn't have a current consumer (the existing modals don't tint their headers). It exists for `RejectExpenseModal` (which today has a red icon but neutral header). Worth implementing per spec since `ConfirmDialog` (next component) needs it.

10. **The `progress` prop** for multi-step modals isn't used by any current modal. Speculative but harmless to implement.

---

## 12. Recommended approach

**Build `<Modal>` on top of `@headlessui/react` Dialog. Wrap once, never expose HUI directly.**

File structure (matches the user's Phase-2 instructions):

```
components/ui/modal/
├── Modal.tsx              ← wraps HUI Dialog + Transition; owns size/variant/tone/progress
├── ModalHeader.tsx         ← title + subtitle + icon + close + progress bar
├── ModalBody.tsx           ← scroll container + scroll shadows + loading/error/empty
├── ModalFooter.tsx         ← sticky footer with justify modes
├── useModal.ts              ← programmatic open/close hook (useDialog from spec)
├── types.ts                  ← ModalSize / ModalVariant / ModalTone / Props
└── index.ts                  ← barrel
```

API matches the spec exactly:
- `<Modal open onClose size variant tone closeOnBackdrop closeOnEsc backdropBlur progress fullScreenOnMobile loading error onRetry>`
- `<ModalHeader title subtitle icon hideClose>`
- `<ModalBody noPadding>`
- `<ModalFooter sticky justify>`

Re-export from `components/ui/index.ts` so consumers import via `@/components/ui`.

---

## 13. Decisions needed before Phase 2

1. **D1 — library**: Headless UI (recommended, no new deps) or Radix (spec preference, ~10 KB)? **Recommend: Headless UI.**
2. **D2 — Phase 3 scope**: which inline modals to include?
   - **Must include** (per user spec): 2 ModalShells, 2 inline tenant-modals (CustomerPaymentForm + ReservationForm). 4 migrations.
   - **Recommend also including** (small, self-contained): `ReceiptLightbox`, `ProcessExpenseModal`, `RejectExpenseModal`, `InvoiceActions` payment modal. **4 more migrations**, ~120 LoC saved.
   - **Defer**: ExtendStayModal, MoveUnitModal, BookingEngineModal, UnitPricingSection PriceModal, AvailabilityCalendar, CreateTenantModal, SlideOver. All page-level.
3. **D3 — standardize backdrop**: `bg-black/45` per spec (`oklch(0% 0 0 / 0.45)`)? Or keep variability? **Recommend: standardize to `/45`** (lightbox can override via `className` if needed).
4. **D4 — panel radius**: spec says `rounded-xl` for centered / top-aligned / drawer-end (with `rounded-s-xl` on drawer), `rounded-2xl rounded-b-none` for bottom-sheet. **Recommend: follow spec exactly.**
5. **D5 — mobile auto-convert**: centered / top-aligned become bottom-sheet < 640 px? **Recommend: yes per spec** (`fullScreenOnMobile` prop already in the spec interface).
6. **D6 — programmatic `useDialog` hook**: include in this session or defer? **Recommend: include `useModal`** as the programmatic surface — the spec mentions it and there's no good reason to defer. Will be used by `ConfirmDialog` next.

---

## 14. Acceptance criteria

After Phase 2 + Phase 3 land:

- [ ] `tsc --noEmit --skipLibCheck` reports 0 errors.
- [ ] Both local ModalShell helpers deleted; their ~12 call sites use `<Modal>`.
- [ ] Inline tenant-modal in `CustomerPaymentForm` + `ReservationForm` use the same `<Modal>` API.
- [ ] If included: lightbox, expense modals, payment-record modal use `<Modal>`.
- [ ] Focus trap works (Tab cycles within panel; Shift+Tab cycles back).
- [ ] ESC closes (configurable).
- [ ] Backdrop click closes (configurable).
- [ ] Body scroll locked when modal open; no layout shift on lock/unlock.
- [ ] Stacked modals don't fight z-indexes (HUI handles via portal layering).
- [ ] Mobile (< 640 px) auto-converts centered/top-aligned to bottom-sheet.
- [ ] RTL: close button stays at visual end; drawer-end is on the visual end.
- [ ] Tokens only — no hardcoded colors / spacing / shadows.

---

## 15. What this session WILL NOT do

- Migrate `ExtendStayModal`, `MoveUnitModal`, `BookingEngineModal`, `UnitPricingSection` PriceModal, `AvailabilityCalendar` overlay, `CreateTenantModal`, `SlideOver` — all page-level, separate sessions.
- Build `ConfirmDialog` (next component after Modal lands).
- Change any form logic inside modals.
- Touch routing (Next.js @modal parallel-route slot).
- Add `framer-motion` or `@radix-ui/react-dialog`.
