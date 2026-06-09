# ConfirmDialog migration — Phase 1 audit

Pre-build inventory of every confirmation flow in the Salalah PMS codebase.
Scope: `app/`, `components/`, `lib/`. Conducted 2026-05-13.

This drives the migration plan for the new `components/ui/confirm-dialog/`
design-system component (Phase 2 onward).

---

## TL;DR

| Category | Count | Action |
| --- | --- | --- |
| `window.confirm()` calls | **2** | Replace in Phase 3 |
| Inline confirmation modals (custom dialog UI) | **6** | Replace in Phase 4 |
| Multi-step modals with embedded confirmation (extend/move/return) | **4** | **Out of scope** — keep as-is |
| Destructive actions firing without any confirmation | **1** | Phase 5, needs explicit approval |
| Reason-required confirmation workflows | **3** | Match in ConfirmDialog API |

Total candidate sites for migration: **9** (2 window.confirm + 6 inline + 1 missing-confirm).

---

## 1. `window.confirm()` calls

Verified via `grep -rn "[^a-zA-Z.]confirm(" app/ components/ lib/`.
Only 2 true positives (the rest are local `function confirm()` helpers inside
inline modals — false matches).

| # | File:line | Action gated | Message |
| - | --- | --- | --- |
| 1 | [app/dashboard/expenses/[id]/ExpenseActionPanel.tsx:54](app/dashboard/expenses/[id]/ExpenseActionPanel.tsx#L54) | DELETE `/api/expenses/{id}` (single expense detail page) | `t("deleteConfirm")` |
| 2 | [app/dashboard/expenses/ExpensesListClient.tsx:169](app/dashboard/expenses/ExpensesListClient.tsx#L169) | DELETE `/api/expenses/{id}` (row delete from list) | `tList("toasts.deleteConfirm")` |

Both fire DELETE immediately on confirm; both use native browser dialog with
no fallback or custom styling. **These are the highest priority** — they are
already considered destructive enough to warrant a confirmation, just using
the wrong primitive.

---

## 2. Inline confirmation modals — migration candidates

Custom UI built per-feature that asks "are you sure?" before an action.
These are *purpose-built confirmation dialogs*, distinct from multi-step
workflow modals (see §3).

### 2.1 Team — remove member
- **File:** [app/dashboard/settings/team/MemberRow.tsx:35,149-162](app/dashboard/settings/team/MemberRow.tsx#L149-L162)
- **Pattern:** `useState(confirming)` toggles an inline Yes/No prompt inside the row
- **Action:** server action `removeMember()`
- **Reason field:** No
- **Accessibility:** Not keyboard-trapped, no role="dialog"

### 2.2 Team — cancel invitation
- **File:** [app/dashboard/settings/team/InvitationRow.tsx:24,93-116](app/dashboard/settings/team/InvitationRow.tsx#L93-L116)
- **Pattern:** Same `setConfirming` row pattern as 2.1
- **Action:** server action `cancelInvitation()`
- **Reason field:** No

### 2.3 Expenses — reject expense
- **File:** [app/dashboard/expenses/modals/RejectExpenseModal.tsx:31-123](app/dashboard/expenses/modals/RejectExpenseModal.tsx#L31-L123)
- **Pattern:** Already uses the new design-system `Modal` (migrated during Modal phase, tone="destructive")
- **Action:** PATCH `/api/expenses/{id}/reject`
- **Reason field:** **Required** select; notes required when reason="other"
- **Status:** Built on `Modal` already, but reason+notes are bespoke. Migration would replace the whole modal body with the new `ConfirmDialog` reason prop.

### 2.4 Reservations — cancel reservation
- **File:** [app/dashboard/reservations/ReservationsView.tsx:307-382](app/dashboard/reservations/ReservationsView.tsx#L307-L382) (CancelModal)
- **Action:** PATCH `/api/reservations/{id}/cancel`
- **Reason field:** **Required** select (Guest Cancelled, No Show, Overbooking, Duplicate Booking, Other); notes required for Other
- **Extras:** Surfaces the OMR refund amount in an amber warning panel

### 2.5 Reservations — mark as no-show
- **File:** [app/dashboard/reservations/ReservationsView.tsx:384-424](app/dashboard/reservations/ReservationsView.tsx#L384-L424) (NoShowModal)
- **Action:** PATCH `/api/reservations/{id}/no-show`
- **Reason field:** No — simple yes/no confirmation showing guest name

### 2.6 Property — delete property
- **File:** [components/dashboard/DeletePropertyButton.tsx:16,33-73](components/dashboard/DeletePropertyButton.tsx#L33-L73)
- **Pattern:** Inline card (not a real modal) gated by `showConfirm` state
- **Action:** server action `deleteProperty()`
- **Reason field:** No, but explicit "this is permanent / will delete N units" warning copy

### 2.7 Property — archive / restore / delete (Danger Zone)
- **File:** [components/dashboard/PropertyDangerZone.tsx:38,82-189](components/dashboard/PropertyDangerZone.tsx#L82-L189)
- **Pattern:** State machine `"idle" | "archive" | "restore" | "delete"` swaps three inline confirm prompts inside the danger-zone card
- **Action:** 3 server actions
- **Reason field:** No
- **Note:** Counts as **one site** (one component, one state machine). Migrating dissolves the state machine — each action becomes its own `confirm(...)` call.

**Total inline confirmation sites to migrate:** 6 (2.1, 2.2, 2.3, 2.4, 2.5, 2.6+2.7 are split between two files but cover similar property-action surface).

---

## 3. Multi-step modals with embedded confirmation — out of scope

These are *workflow modals* not *confirmation modals*. They have form bodies,
multi-step state, pricing previews, etc. Replacing them with a generic
`ConfirmDialog` would lose functionality. Leave as-is.

| File | What it does | Why keep |
| --- | --- | --- |
| [app/dashboard/reservations/ReservationsView.tsx:158-206](app/dashboard/reservations/ReservationsView.tsx#L158-L206) (CheckInModal) | Pre-check-in: shows guest info + optional early check-in warning | Has conditional warning content, not just confirm |
| [app/dashboard/reservations/ReservationsView.tsx:208-304](app/dashboard/reservations/ReservationsView.tsx#L208-L304) (CheckOutModal) | Check-out: extra-charges input, force-with-balance toggle, adjust-charges checkbox | Has form fields and financial side effects |
| [components/reservations/ExtendStayModal.tsx](components/reservations/ExtendStayModal.tsx) | New checkout date picker, availability preview, per-unit rate overrides, pricing summary | Multi-step workflow |
| [components/reservations/MoveUnitModal.tsx](components/reservations/MoveUnitModal.tsx) | Destination unit picker, availability check, **required reason select**, pricing strategy, optional notes | Multi-step workflow; reason is a workflow input, not a confirmation gate |
| [app/dashboard/reservations/[id]/ReservationDetail.tsx:1117-1250](app/dashboard/reservations/[id]/ReservationDetail.tsx#L1117-L1250) (ReturnModal) | Refund calculator with reason + amount + notes | Form, not a confirmation |
| [app/dashboard/reservations/[id]/ReservationDetail.tsx:1419-1560](app/dashboard/reservations/[id]/ReservationDetail.tsx#L1419-L1560) (ProcessRefundModal) | Records refund payment method, amount, reference | Form, not a confirmation |

---

## 4. Destructive actions firing WITHOUT confirmation

| # | File:line | Action | Current safeguard | Risk |
| - | --- | --- | --- | --- |
| 1 | [components/reservations/ConfirmReservationCard.tsx:19-31](components/reservations/ConfirmReservationCard.tsx#L19-L31) | Server action `confirmReservation()` — flips status to CONFIRMED | Yellow context card around the button; idempotent on server | **Low.** State change is reversible (can be cancelled afterward). Adding a modal here would be UX friction without a real safety benefit. |

Cross-checked via `grep -rln "method:\s*['\"]DELETE['\"]"`: only the two
expense files contain DELETE fetches, and both already have (browser) confirm.
No other destructive fetches were found firing unguarded.

**Recommendation:** Phase 5 is essentially empty. Do not add new confirmations
unless the user explicitly requests them.

---

## 5. Reason-required confirmation workflows

Three workflows demand a typed reason before proceeding. The new
`ConfirmDialog` should accept a `reason` config (options + optional `notes`
field, optionally required by selected reason) to preserve these flows:

| Workflow | Reason options | Notes required when |
| --- | --- | --- |
| **Cancel reservation** ([ReservationsView.tsx:307-382](app/dashboard/reservations/ReservationsView.tsx#L307-L382)) | Guest Cancelled, No Show, Overbooking, Duplicate Booking, Other | reason = Other |
| **Reject expense** ([RejectExpenseModal.tsx:31-123](app/dashboard/expenses/modals/RejectExpenseModal.tsx#L31-L123)) | insufficient_receipt, amount_too_high, not_authorized, wrong_category, duplicate_expense, other | reason = other |
| **Move unit** ([MoveUnitModal.tsx:74-609](components/reservations/MoveUnitModal.tsx#L74-L609)) | Guest Request (3 variants), Maintenance Issue, AC/Plumbing, Noise Complaint, Management Decision, Complimentary Upgrade, Other | reason = Maintenance Issue, AC/Plumbing, or Other |

Move-unit's reason is one of many fields in a multi-step workflow — keep that
modal bespoke (§3). Cancel-reservation and reject-expense are the patterns
the new `ConfirmDialog` needs to support natively.

---

## 6. Common confirmation copy patterns

Observed across the audit; useful for `ConfirmDialog` tone defaults:

| Tone | Pattern | Examples |
| --- | --- | --- |
| `destructive` | "Permanently delete …? This cannot be undone." | expense delete, property delete |
| `destructive` | "Cancel …? Refund of X OMR will be issued." | cancel reservation |
| `warning` | "Mark as no-show?" / "Archive …?" | reservation no-show, property archive |
| `warning` | "Reject this expense?" + reason | reject expense |
| `info` | "Restore …?" | property restore |

The current Modal `tone` prop already supports `default | destructive | success`
— `ConfirmDialog` will likely need a `warning` tone added, or fold warning
into a separate prop on the dialog itself.

---

## 7. Recommended migration priority

### Phase 3 — `window.confirm()` replacements (1 commit)
Both calls are in expenses; can ship in a single commit.
- `app/dashboard/expenses/[id]/ExpenseActionPanel.tsx`
- `app/dashboard/expenses/ExpensesListClient.tsx`

### Phase 4 — inline confirmation modals (3-4 commits, by feature)
1. **Team management** (`MemberRow.tsx` + `InvitationRow.tsx`) — same pattern, ship together.
2. **Property danger zone** (`DeletePropertyButton.tsx` + `PropertyDangerZone.tsx`) — same feature surface, ship together. Dissolves the danger-zone state machine.
3. **Cancel reservation** (`ReservationsView.tsx` CancelModal) — reason-required path.
4. **No-show reservation** (`ReservationsView.tsx` NoShowModal) — simple path.
5. **Reject expense** (`RejectExpenseModal.tsx`) — reason-required path; smallest because the modal shell is already design-system.

### Phase 5 — destructive actions without confirmation
Only 1 candidate (`ConfirmReservationCard`), and risk is low. **Recommend skipping** unless explicitly asked.

---

## 8. Required `ConfirmDialog` capabilities (informs Phase 2 build)

Derived from the audit, the new component must support:

1. **Tones:** `default`, `destructive`, `warning`, `info` (mapped to icon + accent color).
2. **Async `onConfirm`:** all real actions are async; the dialog must show a loading state on the confirm button and disable Cancel until it resolves or errors.
3. **Optional reason:** dropdown of `{ value, label }[]` with optional `notesRequiredFor: string[]` triggering a textarea. Returns `{ confirmed: true, reason, notes }` to the caller.
4. **Type-to-confirm (optional):** for the very-destructive cases (e.g. property delete) — caller passes `typeToConfirm: "DELETE"` and Confirm stays disabled until the user types it.
5. **Custom body slot:** for the refund-amount warning panel pattern (CancelModal shows the OMR refund total). Either via a `description` that accepts ReactNode, or a `children` slot.
6. **Focus on Cancel by default** (safer for destructive flows).
7. **Translatable labels:** title, description, confirmLabel, cancelLabel, reason options all accept strings — caller supplies translated text via next-intl.
8. **Promise-based API via hook:** `const confirm = useConfirmDialog(); const ok = await confirm({ ... });` so callers don't manage `open` state per site.

---

## 9. Surprising / risky finds

- **No UI for invoice cancellation.** `PATCH /api/invoices/{id}/cancel` exists, but no button calls it directly — invoices cancel transitively when their reservation cancels. Not a confirmation issue; flagging for product visibility.
- **Property danger zone state machine.** Compact and type-safe, but couples three unrelated confirmations into one component. Migration will split them naturally.
- **Inline team-row confirmations aren't keyboard-trapped.** Migrating to `ConfirmDialog` (built on Headless UI Dialog) fixes this for free.
