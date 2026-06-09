# ConfirmDialog — Design System

Imperative confirmation dialog for destructive and reversible-but-serious
actions. Built on top of `<Modal>` and `<Button>` so the visual language is
consistent with the rest of the system. Call sites use a hook —
`useConfirmDialog()` — and `await` the result; the dialog itself is mounted
once at the app root.

Migration audit: [docs/migrations/confirm-dialog-audit.md](../migrations/confirm-dialog-audit.md).

---

## Quick reference

| Export | Purpose |
| --- | --- |
| `ConfirmDialogProvider` | Mounted once near the app root (already wired into [app/layout.tsx](../../app/layout.tsx)). Renders the singleton dialog. |
| `useConfirmDialog` | Hook returning the `confirm(...)` function. Throws if no provider is mounted above the caller. |
| `ConfirmDialog` | The visual component (internal — you usually do not import it). |
| Types | `ConfirmDialogOptions`, `ConfirmDialogResult`, `ConfirmDialogTone`, `ConfirmDialogReasonConfig`, `ConfirmDialogTypeToConfirmConfig` |

All exported from `@/components/ui`:

```tsx
import { useConfirmDialog } from "@/components/ui";
```

---

## When to use ConfirmDialog vs Modal

| Need | Use |
| --- | --- |
| "Are you sure?" before a destructive action | **ConfirmDialog** |
| Same with a required reason + optional notes | **ConfirmDialog** (`reason` config) |
| Same with a type-the-name safety guard | **ConfirmDialog** (`typeToConfirm` config) |
| A form (anything with fields beyond reason+notes) | `<Modal>` |
| A multi-step workflow (check-in, extend stay, move unit) | `<Modal>` with `progress` |
| A drawer / detail view | `<Modal variant="drawer-end">` |

If the user must fill in more than a reason and an optional note before the
action runs, build a real `<Modal>`. ConfirmDialog is intentionally narrow.

---

## Tones

| Tone | Use for | Header tint | Header icon | Confirm button |
| --- | --- | --- | --- | --- |
| `destructive` | Irreversible action — delete, cancel, reject | `bg-error-50` | red exclamation triangle | `variant="destructive"` |
| `warning` | Reversible-but-serious — no-show, archive | default | amber exclamation triangle | `variant="destructive"` |
| `info` | Informational confirm — restore, publish | default | brand info icon | `variant="primary"` |
| `default` | Neutral — last-resort fallback | default | no icon | `variant="primary"` |

Pick the tone by intent, not by button color: `warning` still uses a
destructive-styled button because the user is committing to a state change,
even if reversible.

---

## API

```ts
type ConfirmFn = (options: ConfirmDialogOptions) => Promise<ConfirmDialogResult>;

interface ConfirmDialogResult {
  confirmed: boolean;        // false if user cancelled or backdrop/Esc dismissed
  reason?: string;           // selected reason value (if reason config was set)
  notes?: string;            // trimmed notes (if notes were shown)
}

interface ConfirmDialogOptions {
  title: ReactNode;
  description?: ReactNode;   // short prose under the title
  tone?: ConfirmDialogTone;  // default "default"
  confirmLabel?: string;     // default "Confirm"
  cancelLabel?: string;      // default "Cancel"
  reason?: ConfirmDialogReasonConfig;
  typeToConfirm?: ConfirmDialogTypeToConfirmConfig;
  body?: ReactNode;          // extra slot between description and reason fields
  hideCancel?: boolean;      // one-button "OK" dialogs
  onConfirm?: (result: { reason?: string; notes?: string }) => void | Promise<void>;
}
```

### `reason`

```ts
interface ConfirmDialogReasonConfig {
  options: { value: string; label: string }[];
  label?: string;            // default "Reason"
  placeholder?: string;      // default "Select a reason…"
  notesFor?: string[];       // reasons that reveal the notes textarea (optional)
  notesRequiredFor?: string[]; // reasons that make notes required (and revealed)
  notesLabel?: string;       // default "Notes"
  notesPlaceholder?: string;
}
```

- Reason is always required when the config is provided — Confirm stays disabled until a reason is picked.
- `notesFor` and `notesRequiredFor` are additive: a reason in either list shows the notes textarea; a reason in `notesRequiredFor` also blocks Confirm until notes have content.
- The notes textarea label gets a `*` automatically when required.

### `typeToConfirm`

```ts
interface ConfirmDialogTypeToConfirmConfig {
  value: string;             // the literal the user must type
  label?: string;             // default `Type ${value} to confirm`
}
```

Confirm stays disabled until the input value strictly equals `value`. Use for
the highest-stakes deletes — property deletion is the only consumer today.

### `onConfirm` — dialog-managed loading

If `onConfirm` is **omitted**, the dialog closes immediately when the user
clicks confirm and the promise resolves with `{ confirmed: true, … }`. The
caller does the work afterward.

If `onConfirm` is **provided**, the dialog stays open with the Confirm button
in a loading state while `onConfirm` runs. On success it closes and the
promise resolves with `{ confirmed: true, … }`. On failure (any throw) the
dialog closes and the promise resolves with `{ confirmed: false }` — the
caller is expected to surface the error itself (toast) before re-throwing.

---

## Patterns

### 1. Plain destructive confirm

```tsx
const confirm = useConfirmDialog();

async function handleDelete() {
  const { confirmed } = await confirm({
    title: t("deleteTitle"),
    description: t("deleteConfirm"),
    tone: "destructive",
    confirmLabel: t("deleteCta"),
    cancelLabel: t("cancelCta"),
  });
  if (!confirmed) return;
  await fetch(`/api/expenses/${id}`, { method: "DELETE" });
  // …
}
```

### 2. Warning tone (reversible action)

```tsx
await confirm({
  title: tNoShow("title"),
  description: tNoShow.rich("prompt", {
    name: `${res.tenant.firstName} ${res.tenant.lastName}`,
    b: (chunks) => <strong>{chunks}</strong>,
  }),
  tone: "warning",
  confirmLabel: tNoShow("confirm"),
  onConfirm: async () => {
    const r = await fetch(`/api/reservations/${res.id}/no-show`, { method: "PATCH" });
    const data = await r.json();
    if (!r.ok) {
      toast.error(data.error ?? tNoShow("failed"));
      throw new Error("no-show failed");
    }
    toast.success(data.message);
    fetchData();
  },
});
```

The dialog manages its loading state through `onConfirm`. The caller's role
is to toast the error and `throw` — the dialog will close.

### 3. Reason + conditional notes

```tsx
await confirm({
  title: tCancel("title"),
  tone: "destructive",
  body: totalPaid > 0 ? <RefundWarning amount={totalPaid} /> : undefined,
  reason: {
    label: tCancel("reasonLabel"),
    placeholder: tCancel("selectReason"),
    options: CANCEL_REASONS.map((r) => ({
      value: r.value,
      label: tCancel(`reasons.${r.labelKey}`),
    })),
    notesFor: nonOtherReasons,           // show textarea, optional
    notesRequiredFor: ["Other"],         // and require it for "Other"
    notesLabel: tCancel("notesLabel"),
    notesPlaceholder: tCancel("notesPlaceholder"),
  },
  confirmLabel: tCancel("confirm"),
  cancelLabel: tCancel("keep"),
  onConfirm: async ({ reason, notes }) => {
    const r = await fetch(`/api/reservations/${res.id}/cancel`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, notes: notes ?? "" }),
    });
    // …
  },
});
```

The `body` slot is where extra context goes — a refund warning, a list of
affected records, etc. It renders between the description and the reason
field.

### 4. Type-to-confirm (highest-stakes delete)

```tsx
await confirm({
  title: tD("title"),                    // "Delete permanently"
  tone: "destructive",
  body: (
    <div className="space-y-2 text-sm text-fg-secondary">
      <p>{tD("body")}{unitCount > 0 && tD.rich("unitsInfo", { count: unitCount, b: ... })}</p>
      <p className="rounded-md border border-error-200 bg-error-50 px-3 py-2 text-xs font-medium text-error-700">
        {tD("confirmWarning")}
      </p>
    </div>
  ),
  typeToConfirm: {
    value: propertyName,
    label: tD("typeToConfirmLabel", { name: propertyName }),
  },
  confirmLabel: tD("confirmYes"),
  cancelLabel: tD("cancel"),
  onConfirm: async () => { /* ... */ },
});
```

Confirm stays disabled until the user types `propertyName` exactly.

---

## Translations

All copy is supplied by the caller — the dialog has zero hard-coded strings
in any locale. For Salalah PMS this means routing strings through
`useTranslations(...)`:

- Title, description, button labels — plain strings (or `t.rich(...)` for the description, which accepts `ReactNode`).
- Reason options — `{ value, label }[]` where `label` is the translated text.
- The reason `value` is whatever your API expects — it is the only piece you receive back in the result.

For RTL, the dialog inherits direction from the document and uses logical
properties throughout (no `left`/`right` literals).

---

## Accessibility

- Built on `@headlessui/react` Dialog — focus trap, Escape to close, backdrop click to dismiss, `aria-labelledby` wired to the title.
- The header close (X) button is hidden — the Cancel button is the dismissal path. This keeps the cancel/confirm pair as the only two paths out, which matters most for destructive flows.
- During `onConfirm` loading: Esc, backdrop click, Cancel, and the close button are all suppressed. Only the resolution of `onConfirm` closes the dialog.
- Required reason / notes / type-to-confirm fields use the standard FormField required marker (`*`) and screen-reader-friendly error descriptions.

---

## Things to avoid

- **Do not call `useConfirmDialog()` in event handlers.** Like every React hook, it must be called at the top of the component. Store the returned function and call *that* from inside handlers.
- **Do not nest `await confirm(...)` calls.** The provider replaces any pending dialog with the new one (resolving the previous as cancelled). If you need a stacked flow, redesign — usually one dialog plus a follow-up toast is enough.
- **Do not put forms in the `body` slot.** If you find yourself adding inputs beyond what the `reason` config provides, you actually want a `<Modal>`.
- **Do not put `useConfirmDialog` in server components.** It is a client-only hook (the dialog itself is "use client"). Call it from a `"use client"` boundary.
- **Do not skip `tone="destructive"` for destructive actions** just because the description spells it out. The red header tint is what users register at a glance.

---

## Wiring (already done — for reference)

```tsx
// app/layout.tsx
<NextIntlClientProvider locale={locale} messages={messages}>
  <ConfirmDialogProvider>
    {children}
  </ConfirmDialogProvider>
  <Toaster position="top-center" richColors dir={dir} />
</NextIntlClientProvider>
```

One provider. Every page below it can call `useConfirmDialog()`.

---

## Migration history

Phase 1 audit → Phase 2 build → Phase 3 `window.confirm()` replacements →
Phase 4 inline-modal consolidation (team rows, property danger zone, no-show,
cancel reservation, reject expense). Phase 5 (adding confirmations to
destructive actions that did not have them) was skipped — the only candidate
was `ConfirmReservationCard`, and its server action is reversible.

Files retired during the migration:

- `app/dashboard/expenses/modals/RejectExpenseModal.tsx`
- `components/dashboard/DeletePropertyButton.tsx` (was already dead code)
- `NoShowModal` and `CancelModal` inline components inside `ReservationsView.tsx`

Net change across Phases 3–4: **~470 lines removed** with one consistent
confirmation pattern replacing six bespoke ones.
