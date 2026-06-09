# Alert migration — Phase 1 audit

Pre-build inventory of every inline alert / banner / status message in the
Salalah PMS codebase.
Scope: `app/`, `components/`. Conducted 2026-05-18.

This drives the migration plan for the new `components/ui/alert/`
design-system component (Phase 2 onward).

---

## TL;DR

| Category | Count | Status |
| --- | --- | --- |
| Reusable banner components | **1** | Local `StatusBanner` helper in `ProfileForm.tsx` — duplicated inline in `InviteForm.tsx` and `VerifyEmailClient.tsx` |
| Distinct inline alert / banner blocks | **~45** | Concentrated in `ReservationDetail.tsx` (~14) and `ReservationsView.tsx` (5) |
| Files containing inline alerts | **15** | Split across forms, list pages, detail pages, and auth flows |
| Toast call sites (`sonner`) | **167** | Across 28 files — **keep as-is**, transient feedback is not an Alert responsibility |
| Existing accessibility on inline alerts | **0** | No `role="alert"`, no `aria-live`, no keyboard-dismissible patterns |
| Form-level error summaries | **6 forms** | `ProfileInfoForm`, `ChangePasswordForm`, `OrgSettingsForm`, `InviteForm`, `AcceptForm`, `LoginForm` (3 banners) |
| Dark-theme alert variant | **1** | `AcceptForm.tsx` — `bg-red-900/30 text-red-400`, only place using dark surface tokens |

**Headline:** there is no shared Alert primitive today. The same green/red
"success/error" banner shape is reimplemented inline in at least 5 places, and
warning/info banners drift between `amber-*` and `yellow-*` palettes with no
consistent semantic mapping. The biggest single concentration is
`ReservationDetail.tsx`, which alone contains ~14 inline status blocks.

---

## 1. The one reusable pattern: `StatusBanner`

Defined at [app/dashboard/settings/profile/ProfileForm.tsx:18-34](app/dashboard/settings/profile/ProfileForm.tsx#L18-L34).

```tsx
function StatusBanner({ state }: { state: { error?: string; success?: string } }) {
  if (state.success)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
        <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />
        {state.success}
      </div>
    );
  if (state.error)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <ExclamationCircleIcon className="h-4 w-4 flex-shrink-0" />
        {state.error}
      </div>
    );
  return null;
}
```

Consumed twice in the same file (ProfileInfoForm + ChangePasswordForm) and
re-implemented inline (same shape, copy-pasted) in:

- [app/dashboard/settings/team/InviteForm.tsx:21-32](app/dashboard/settings/team/InviteForm.tsx#L21-L32) — success + error
- [app/verify-email/VerifyEmailClient.tsx:90-110](app/verify-email/VerifyEmailClient.tsx#L90-L110) — warning + success + error (adds `items-start gap-2.5`)

These four files are the **canonical Phase 3 migration targets** — they are
exactly what the new `Alert` component should replace, drop-in.

---

## 2. Inline alert inventory by file

Counts are distinct alert blocks (one block = one `<div>` rendered as a banner).
Excludes button hover states, list-item highlights, focus rings, and decorative
gradients.

| File | Count | Variants present | Notes |
| --- | --- | --- | --- |
| [app/dashboard/reservations/[id]/ReservationDetail.tsx](app/dashboard/reservations/[id]/ReservationDetail.tsx) | **~14** | success, info, warning, error | Highest concentration. Mix of `bg-yellow-50` and `bg-amber-50`. Includes a full-width yellow header strip at [L1797](app/dashboard/reservations/[id]/ReservationDetail.tsx#L1797). |
| [app/dashboard/reservations/ReservationsView.tsx](app/dashboard/reservations/ReservationsView.tsx) | **5** | warning, error (×2), warning-stacked, warning | Validation messages, conflict lists, double-booking warnings (L180, L246, L257, L271, L515). |
| [app/verify-email/VerifyEmailClient.tsx](app/verify-email/VerifyEmailClient.tsx) | **3** | warning, success, error | StatusBanner-shaped. (L90, L98, L106) |
| [app/login/LoginForm.tsx](app/login/LoginForm.tsx) | **3** | error, error, warning | One on signup screen (L71), two on sign-in (L249, L257). Uses `rounded-xl` not `rounded-lg`. |
| [app/dashboard/settings/profile/ProfileForm.tsx](app/dashboard/settings/profile/ProfileForm.tsx) | **2** | (StatusBanner) | Counted as 2 call sites of the helper. |
| [app/dashboard/settings/team/InviteForm.tsx](app/dashboard/settings/team/InviteForm.tsx) | **2** | success, error | Copy-pasted StatusBanner shape. |
| [app/dashboard/settings/organization/OrgSettingsForm.tsx](app/dashboard/settings/organization/OrgSettingsForm.tsx#L138) | **1** | error | `items-start gap-2.5` form-level error summary. |
| [app/dashboard/settings/team/page.tsx](app/dashboard/settings/team/page.tsx#L119) | **1** | warning (header strip) | "Pending invitations" amber banner with count chip. |
| [app/dashboard/payments/new/SmartPaymentForm.tsx](app/dashboard/payments/new/SmartPaymentForm.tsx#L629) | **1** | warning | Amber inline note inside form. |
| [app/dashboard/payments/[id]/page.tsx](app/dashboard/payments/[id]/page.tsx#L349) | **1** | info / warning | Amber "no allocations" notice. |
| [app/dashboard/invoices/[id]/page.tsx](app/dashboard/invoices/[id]/page.tsx#L255) | **1** | error | Red inline note for invoice-level error text. |
| [app/invite/[token]/AcceptForm.tsx](app/invite/[token]/AcceptForm.tsx#L75-L80) | **1** | error (dark) | **Only dark-themed alert in the app**: `bg-red-900/30 text-red-400`. Runs on the marketing-dark auth shell. |
| [app/dashboard/units/bulk/BulkCreateForm.tsx](app/dashboard/units/bulk/BulkCreateForm.tsx#L403) | **1** | info | Bulk-create summary card (light-blue). Borderline — could remain a non-alert info tile. |
| Misc reservation modals (`Cancel/Extend/etc`) | reused | varies | Several show error states that share the same red-50 pattern. |

Approx. total: **~45 inline alert blocks across 14 production files** (plus 1
StatusBanner helper).

The marketing home page `app/page.tsx` has decorative red/green/yellow surfaces
that are part of a hero illustration, not real alerts — excluded from this
audit.

---

## 3. Variant usage observed

Six semantic intents appear in the codebase today, but they are not consistently
mapped to colours.

| Intent | Predominant palette | Alternates seen | Recommended Alert variant |
| --- | --- | --- | --- |
| Success / completed | `green-50 / green-200 / green-700` | `green-50 / green-200 / green-800` | `success` |
| Error / validation | `red-50 / red-200 / red-700` (also red-800) | dark variant in `AcceptForm` | `error` |
| Warning / attention | **`amber-50 / amber-200 / amber-800`** *and* **`yellow-50 / yellow-200 / yellow-800`** used interchangeably | `bg-yellow-500` for header strip | `warning` |
| Informational | `blue-50 / blue-200 / blue-800` | none | `info` |
| Announcement (e.g. trial banner) | not present today | — | `announcement` (new) |
| Neutral / dimmed | not present today | — | `neutral` (new) |

The warning amber-vs-yellow split is the single most visible inconsistency:
`ReservationDetail.tsx` reaches for `yellow-50` while `ReservationsView.tsx`
and `LoginForm.tsx` pick `amber-50`. Two paint colours, one meaning.

---

## 4. Styling inconsistencies

Tracked so the Alert component can settle each tension with one design decision.

| Dimension | Values found | Notes |
| --- | --- | --- |
| Border radius | `rounded-lg`, `rounded-xl` | `LoginForm` and `AcceptForm` use `rounded-xl`; everything else `rounded-lg`. |
| Padding | `px-4 py-3`, `px-4 py-3.5`, `p-3`, `p-4` | No standard. |
| Alignment | `items-center` (single-line) vs `items-start` (multi-line) | Long-content alerts need `items-start` for icon top alignment. |
| Gap between icon + text | `gap-2`, `gap-2.5`, `gap-3` | Drift only — same intent. |
| Icon size | `h-3.5`, `h-4`, `h-5` | `ReservationDetail` mixes h-4 and h-5 in adjacent blocks. |
| Icon set | `CheckCircleIcon`, `ExclamationCircleIcon`, `ExclamationTriangleIcon`, `InformationCircleIcon` from `@heroicons/react/24/outline` | 70 imports across `app/`. Outline style is dominant — match in Alert defaults. |
| Border weight | `border` (1 px) standard, `border-b` on the team header strip | Acceptable variation; keep `border` as Alert default. |
| Text weight | always normal weight | No emphasis on headings; Alert presets should introduce explicit `AlertTitle` typography. |

---

## 5. Accessibility gaps

Verified via `grep -r 'role="alert"' app/ components/` and `grep -r 'aria-live'
app/ components/`.

| Gap | Affected | Risk |
| --- | --- | --- |
| **No `role="alert"`** anywhere in `app/` | All ~45 inline alerts | Screen readers do not announce error/warning state. The two existing `role`/`aria-live` hits in `components/ui/` are for `SkeletonCard` and `EmptyState`, not alerts. |
| **No `aria-live` regions** for dynamic banners | Form-level error summaries (6 forms), payment + reservation flows | Server-action error responses appear silently to AT users. |
| **No keyboard-dismissible alerts** | No alerts are dismissible at all today | Spec requires ESC support on dismissible variants. |
| **Color-as-only-signal in `app/page.tsx` hero** | Marketing only | Out of scope (decorative), but flag if hero ever becomes a real alert. |
| **Dark variant in `AcceptForm`** | 1 surface | Contrast not yet checked against WCAG AA on dark theme. The Alert component should provide first-class dark-surface support so this is not a one-off. |

---

## 6. What stays as toast (do NOT migrate)

`sonner` is invoked **167 times across 28 files**, heaviest in:

| File | toast calls | Why toast is correct |
| --- | --- | --- |
| `app/dashboard/reservations/[id]/ReservationDetail.tsx` | 30 | All transient action feedback (check-in, payment, cancel). |
| `app/dashboard/expenses/new/SubmitExpenseForm.tsx` | 18 | Async submission, validation feedback. |
| `app/dashboard/payments/new/SmartPaymentForm.tsx` | ~10 | Async payment recording. |
| Others (25 files) | balance | Action-result confirmation. |

These are **transient** notifications that auto-dismiss. They are not alerts in
the design-system sense, and the spec explicitly excludes building a toast
system in this session. **Leave all 167 sites untouched.**

---

## 7. Recommended migration priority

Five phases, each one a discrete commit.

### Phase 2 — Build the Alert component system (next, blocking)

Files to create under `components/ui/alert/`:
- `Alert.tsx` — root component, props for `variant`, `size`, `layout`, `dismissible`, `title`, `actions`.
- `AlertIcon.tsx`, `AlertTitle.tsx`, `AlertDescription.tsx`, `AlertActions.tsx`, `AlertDismiss.tsx`.
- `icons.tsx` — variant → default Heroicon mapping.
- `types.ts`, `index.ts`.
- Variant tokens added to `styles/design-tokens.css` so colour mapping is centralised.
- Presets (Phase 2 also covers these, per spec): `FormErrorSummary`, `TrialExpiryBanner`, `MaintenanceBanner`, `PaymentRecorded`, `NetworkErrorRetry`, `FeatureAnnouncement`, `TenantBlacklistedWarning`, `PendingApprovalsBanner`.

### Phase 3 — Drop-in StatusBanner replacements (low risk)

Replaces the duplicated success/error banner shape in 4 files:
1. [app/dashboard/settings/profile/ProfileForm.tsx](app/dashboard/settings/profile/ProfileForm.tsx) — delete the local helper, switch both call sites to `<Alert variant="success" />` / `<Alert variant="error" />` (or the `FormErrorSummary` preset).
2. [app/dashboard/settings/team/InviteForm.tsx](app/dashboard/settings/team/InviteForm.tsx).
3. [app/dashboard/settings/organization/OrgSettingsForm.tsx](app/dashboard/settings/organization/OrgSettingsForm.tsx#L138).
4. [app/verify-email/VerifyEmailClient.tsx](app/verify-email/VerifyEmailClient.tsx).

### Phase 4 — App-wide inline alert sweep (medium risk)

Files in priority order (highest alert density first):
1. `ReservationDetail.tsx` — ~14 blocks, careful: icon sizes mixed, several use `bg-yellow-*` that should become `warning`.
2. `ReservationsView.tsx` — 5 blocks, validation + conflict groups.
3. `LoginForm.tsx` — 3 blocks, decide on `rounded-xl` retention (likely standardise to whatever the Alert ships with).
4. `AcceptForm.tsx` — 1 block, **needs dark-theme variant support in the Alert before migration**.
5. `SmartPaymentForm.tsx`, `payments/[id]/page.tsx`, `invoices/[id]/page.tsx`, `settings/team/page.tsx` — single banners each.
6. `BulkCreateForm.tsx` — decide whether to migrate (more of an info tile than an alert).

### Phase 5 — Documentation

`docs/design-system/alert.md` — variants, sizes, layouts, presets, accessibility
contract, RTL behaviour, dos and don'ts.

---

## 8. Surprises & risks

- **No existing reusable alert at all.** Even the `StatusBanner` is a local
  helper, not exported. Migration is greenfield, not refactor.
- **One dark-theme alert** in `AcceptForm.tsx`. The Alert component should bake
  dark-surface tokens in from day one or this file will block Phase 4.
- **`ReservationDetail.tsx` mixes `yellow-*` and `amber-*` for the same intent.**
  Doing the migration is also the first time these become consistent.
- **No `role="alert"` exists today.** Once added, voice-over will start
  announcing things that were previously silent. Worth a brief QA pass — there
  is a non-zero chance some banners are rendered on initial mount and shouldn't
  trigger an `assertive` announce; the spec's `aria-live="polite"` default
  handles this.
- **`LoginForm.tsx` uses `rounded-xl`** to match the auth-screen visual style.
  If the Alert ships with `rounded-lg`, that page will look subtly different
  post-migration. Either expose a `radius` prop or accept the visual change.
- **`Number of toast calls (167)`** is deceptively large but unrelated — they
  are out of scope. Resist the temptation to fold them in.
- **Form-level error summaries (6 forms)** would benefit from the
  `FormErrorSummary` preset, which groups field errors with anchor links. Spec
  calls for that preset; Phase 4 should adopt it rather than 1:1-replacing the
  current single-error banners.
