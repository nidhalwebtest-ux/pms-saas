# Binaya PMS — Scenario Testing Results Log

> Session goal (today): Complete Categories A & B (Scenarios 1–10).
> Tester executes in the app; Claude observes, verifies, and documents.

---

## Session Log

| Scenario | Title | Result | Issues Found |
|----------|-------|--------|--------------|
| 1 | Create organization | ✅ PASS (core flow) — 3 adjustments noted | #1, #2, #3 |
| 2 | Add building with units | ✅ PASS (core flow) — 5 adjustments noted | #4, #5, #6, #7, #8 |
| 3 | Add tenant (individual Omani) | ✅ PASS (core flow) — 1 real bug + 3 adjustments | #9, #10, #11, #12 |
| 4 | Add tenant (corporate) | ✅ PASS (core flow) — 1 adjustment | #13 |
| 5 | Add VIP tenant | ✅ PASS — no issues | — |
| 6 | Create daily reservation (4 nights) | ⚠️ PASS w/ bugs — pricing correct, 4 P1s + 6 lower | #14–#23 |
| 7 | Create monthly reservation (3 months) | ✅ PASS — pricing correct, 1 feature request | #24 |
| 8 | Multi-unit reservation (3 units, 5 nights) | ✅ PASS — math + availability correct, 1 UX issue | #25 |
| 9 | Double-booking prevention (negative test) | ✅ PASS — **no issues** — integrity layer holds | — |
| 10 | Seasonal pricing across Khareef boundary | ⚠️ PASS — math correct, but **breakdown not persisted** | #26, #27, #28 |

---

## Category C — Invoicing & Payments (Plan)

> **Environment:** tester runs the **`design-system-v2`** branch via Vercel (preview / production-like). Same collaborative format — tester executes in the app; Claude verifies (DB + math) and documents.
> **Prerequisite met:** all Category A/B issues (#1–#31) are fixed on `design-system-v2`, including #28 (segments now persisted on `reservationUnit`) which was load-bearing for invoicing.

| # | Scenario | Result | Key checks |
|---|----------|--------|-----------|
| 11 | Generate invoices — daily / short-term reservation | ✅ PASS (after fixes) | Custom-rate invoice now correct (154); found+fixed #32, #33, #35–#39 |
| 12 | Generate invoices — monthly reservation | ✅ PASS (after fixes) | Cycles correct (15th→15th, 3×600); all-DRAFT correct for a future stay. Fixed #40 (DRAFT shown as Pending), #41 (monthly line math) |
| 13 | Issue a DRAFT monthly cycle + Invoice Settings | ✅ PASS | Built configurable Invoice Settings (#43); 6 timing/auto-issue/require combos verified in DB. Fixed #42 (issue→PENDING) |
| 14 | Invoice for the Khareef reservation | ✅ Pass | Line items mirror persisted segments — the #28 payoff. RESNOOR-2026-00017: 3×45 + 1×25 = 160; INV-2026-00022 has matching Khareef/Default lines |
| 15 | Record a full payment | ✅ PASS | full→PAID, allocation created, balance 0 |
| 16 | Record a partial payment | ✅ PASS (after fixes) | partial→PARTIALLY_PAID. Fixed #46 (balance column), #47 (overpayment policy + Payment Settings) |
| 17 | Manual allocation across multiple invoices | ⏳ Pending | Oldest-first auto vs manual selection |
| 18 | Payment receipt PDF | ⏳ Pending | Bilingual, correct totals |
| 19 | Overdue calculation | ✅ Pass (after fix) | Calculated, never stored. Found+fixed #51 (inconsistent rule: DRAFT counted, "due today" flagged, missing PENDING) — unified to one canonical rule across 7 call sites |
| 20 | Cancel invoice / cancel-reservation guard | ✅ Pass | Cancel blocked only if invoices have payments; unpaid DRAFT/PENDING auto-cancelled & excluded from financials. Rule clarified in CLAUDE.md |

> Stretch (21+): early-checkout proration (current period full, future cycles cancelled), overstay invoice, returns/refunds.

---

## Progress

- **Scenarios completed:** 10 / 10 — **TODAY'S TARGET REACHED · Categories A & B COMPLETE**
- **Issues found:** 28
- **P0:** 0 · **P1:** 6 · **P2:** 16 · **P3:** 6

### Scenario 14 notes (Khareef invoice — #28 payoff, clean pass)
- **RESNOOR-2026-00017** (Unit 6, Al Noor Residence, DAILY, 2026-08-29→2026-09-02): segments persisted as 3 nights @ 45 (Khareef 2026 seasonal) + 1 night @ 25 (default), total **160.000 OMR**.
- Generated **one** invoice **INV-2026-00022** (DRAFT — reservation still PENDING, correct per #43). Line items mirror the persisted segments exactly: `Khareef 2026 rate (08-29–08-31) 3×45=135` + `Default rate (09-01) 1×25=25`. No flat-rate collapse — the #28 fix holds end-to-end (booking → reservationUnit.pricingSegments → invoice line items).
- Old pre-#28 reservations (e.g. RES-2026-00143) still have `pricingSegments: null` and would fall back to flat rate; only affects reservations created before the fix.

### Scenario 19 notes (Overdue calculation)
- **Core rule correct:** overdue is always *calculated*, never stored. Spot-checked INV-2026-00003 (RES-2026-00004, due 2026-05-01, bal 150) and INV-2026-00008 (RES-2026-00002, due 2026-04-28, bal 2) — both correctly overdue.
- **Found #51 (P2):** the overdue derivation was duplicated across ~7 call sites with **three** divergent definitions — (1) DRAFT counted as overdue in the reservation summary + manager receivables/aging; (2) "due today" wrongly flagged because of a timestamp (not day-level) compare; (3) the `/api/invoices` count omitted PENDING. Unified all to one canonical rule: `status ∈ {ISSUED, PENDING, PARTIALLY_PAID} AND dueDate(day) < today(day) AND balance > 0`.
- **DB verification after fix:** 78 billed invoices overdue · 3 DRAFT past-due now excluded · 2 due-today now excluded · manager receivables/aging now exclude DRAFT (no revenue posted).

### Scenario 20 notes (Cancel-reservation guard)
- **Behavior confirmed safe:** cancel is blocked only if an invoice has recorded payments (PAID/PARTIALLY_PAID) — "cancel those invoices first"; unpaid DRAFT/PENDING invoices are auto-cancelled, units freed, `refundPending` flagged if any payment existed.
- Documented rule in CLAUDE.md was overly literal ("can't cancel if any invoice exists") — updated to match the implemented (safer + more convenient) behavior. User chose to keep current behavior.

### Scenario 10 notes
- **Math correct:** RES-2026-00143, DAILY, 7 nights, **grandTotal 255.000 OMR** = 3×25 + 4×45 ✅. Seasonal record won at priority 1 (vs DEFAULT priority 10) for Jul 1–4. Engine correctly used the half-open Khareef window: Jul 1 night = Khareef, Jul 5 check-out night not slept-in.
- **Setup sub-issues (user-flagged):** #26 monthly rate should be optional in seasonal-price modal (DEFAULT requires both, SEASONAL shouldn't); #27 feature — add settings to prevent monthly reservations during a date range (Salalah Khareef revenue-management use case).
- **#28 — bigger finding (P1):** the saved `reservationUnit` stores only `rateAmount=25, rateSource=default_price, seasonalPriceName=null` — **the segment breakdown is not persisted**. So the unit card during selection (and any later reader: invoices, receipts, reports, reservation detail) sees "25/night" while grandTotal says 255. The math is right at creation, but history is wrong. This **must be fixed before Scenario #11 (invoice generation)** because invoices need segment line items.
- Category B sets the table for Category C: **the segment-persistence gap is the load-bearing issue** — without it, downstream invoicing/receipts/reports inherit incorrect per-night data.

### Category B wrap-up (Scenarios 6–10)
- Core booking flows all PASS at the math level. **Pricing engine math is correct** for daily, monthly, multi-unit, and seasonal — but several supporting layers (number generation, UI gating, segment persistence, edit flow) are incomplete.
- 15 issues in Category B (#14–#28): 5 P1 + 9 P2 + 1 P3.
- **Category B P1s — must be fixed before Category C invoicing/payments:**
  - **#16** tenant click-select broken (blocks normal booking flow)
  - **#18** reservation number is global, not org-scoped (multi-tenant leak + collision risk; needs configurable format)
  - **#20** no Check-In button despite `allowEarlyCheckIn=ON` (UI ignores setting)
  - **#23** Edit Reservation 404 (route never built)
  - **#24** require contract before check-in (feature — user flagged "crucial")
  - **#28** seasonal segments not persisted on `reservationUnit` (load-bearing for invoices)
- Cross-cutting clusters worth bundling in fixing sessions:
  - **Pricing v2:** #26 (optional monthly) + #27 (block monthly periods) + #28 (persist segments) — one sprint slice.
  - **Reservation polish:** #14 i18n + #15 responsive + #17 daily picker UX + #19 unit link + #21 availability modal + #22 RTL gradient + #25 corporate display — bundled UX pass.
  - **Workflow gates:** #20 early check-in button + #24 contract gate — both touch settings + check-in API.

### Scenario 9 notes (★ critical integrity check — clean pass)
- **Full overlap (Jun 11–13 inside Ahmed's Jun 10–14):** Unit 1 correctly disabled in the picker, with a **helpful conflict card** showing reservation number + tenant + dates. Excellent UX — receptionist instantly understands *why* it's unavailable, not just *that* it is.
- **Back-to-back (Jun 14 → Jun 17, Ahmed checks out Jun 14):** Unit 1 **available**, total 75.000 OMR (3 × 25.000) — **half-open interval rule working correctly** (`[10,14)` vs `[14,17)` don't overlap). Critical: getting this wrong would lose legitimate revenue.
- **Partial straddle (Jun 13 → Jun 16):** Unit 1 occupied (Ahmed's Jun 13 night) AND Unit 2 occupied (Khaled's monthly starts Jun 15). Both correctly blocked.
- **DB verified:** Still 3 reservations total, Unit 1 still has only Ahmed's record — **zero phantom rows from rejected attempts**. The API-level guard (not just UI) held.
- The double-booking-prevention infrastructure (from my memory: half-open intervals, shared `getUnitConflict`, transactional row-level locking) is **doing its job at every level tested**.

### Scenario 8 notes
- Multi-unit booking **verified in DB**: RES-2026-00142, PENDING, DAILY, 5 nights, **3 reservationUnits (Unit 3/4/5)**, each rateAmount=25 × 5 nights = 125 → sum = **375.000 OMR = grandTotal** (no rounding drift). Hassan Al Wahaibi (corporate / Salalah Marine Services LLC) correctly linked.
- **Availability check works across rate types** (key sanity): Unit 2 was correctly shown as occupied/disabled in the unit picker because of Khaled's overlapping monthly (Jun 15 – Sep 15). The `getUnitConflict` check is treating daily and monthly stays as overlapping correctly.
- Multi-select UX: clean per user — "selected the 3 units easily".
- **#25 (P2):** for corporate tenants, the **company name is small** on the reservation page while the contact-person name is the primary heading. For B2B the company should be the heading; contact secondary. Fields are all in the DB — just under-used by the UI.

### Scenario 7 notes
- Monthly booking + pricing **verified in DB**: RES-2026-00141, PENDING, MONTHLY, 92 nights (Jun15→Sep15), 1,800.000 OMR (3 × 600.000), Unit 2, Khaled (vip), `rateSource=default_price` — no seasonal applied (correct, no seasonal config on this unit). Engine took monthly path (not nights × daily = 2,300.000 — sanity passed).
- Confirms **#18** again: next number was 00141 (global counter +1), not 00002.
- No invoices generated yet (correct — invoicing is deferred to a separate action in Scenario #11).
- **#24 (new, P1 feature request — user flagged as "crucial"):** add Reservations settings to require **contract creation/signing before check-in**, with optional auto-create-on-confirm. Significant scope (new Contract domain) — captured now, defer build until existing P1s are fixed.

### Scenario 6 notes
- Core booking worked & **pricing verified correct in DB**: RES, PENDING, DAILY, 4 nights, 100.000 OMR (4×25.000), Ahmed, org-scoped, no invoice yet. Engine math is right.
- **First P1s of the session (4):**
  - #16 tenant click-select broken (re-fetches `?q=<uuid>`; API never matches by id) — blocks normal booking flow.
  - #18 reservation number GLOBAL not org-scoped → first booking = RES-2026-00140 (multi-tenant leak + race risk). Wants configurable format in settings.
  - #20 no Check-In button before start date despite `allowEarlyCheckIn=ON` (UI gating ignores setting; API already supports it).
  - #23 Edit Reservation 404 — route never implemented (detail links to nonexistent `/edit`).
- P2/P3: #14 reservation filter i18n keys (same as #9), #15 step responsive, #17 daily picker UX, #19 unit name not linked, #21 availability Show disabled under All Properties, #22 RTL split-day gradient.
- **i18n drift now confirmed in 2 areas (#9, #14)** → schedule a coverage sweep in fixing session.

### Scenario 5 notes
- VIP classification works fully: star/amber styling on selection + detail + list, and classification filter functions. DB verified: Khaled Al Rashdi, classification=vip, special requests saved. Org now 3 tenants (2 regular + 1 vip).
- First scenario with zero issues — clean.

### Category A wrap-up (Scenarios 1–5)
- All foundation flows PASS at the core level. **No P0/P1 found** — data integrity, org scoping, validation, and persistence are solid.
- 13 issues, all P2/P3 (UX, redirects, i18n, modals, phone input).
- Cross-cutting fixes that collapse multiple issues:
  - **Phone input** (#2 + #10): adopt shared PhoneField / country picker once.
  - **Modal-off** (#4 + #12): disable the 3 `(.)…/new` interceptors once.
  - **Redirect policy** (#8 create→list, #13 edit→detail): define once, apply per-mode across Property/Unit/Tenant forms.
  - **i18n coverage** (#9): fix missing keys + recommend a coverage check (likely more gaps).

### Scenario 4 notes
- Corporate tenant create worked; corporate fields (companyName/contact) appeared on selecting "Corporate". DB verified: Hassan Al Wahaibi, corporate, Salalah Marine Services LLC, org now has 2 tenants.
- #13: editing a tenant shows toast but never redirects (redirect guarded by `!isEdit`). Note: create→list (#8) vs edit→detail (#13) are different modes; both fixes can coexist.
- (Cosmetic, unlogged) test-entry email typo creq→crew; harmless.

### Scenario 3 notes
- Full-form tenant create worked; redirected to tenant detail page. DB verified: Ahmed Al Balushi, Omani, national_id 12345678, nationalId legacy synced, individual/regular/walk_in, clean org scoping.
- **First real bug:** #9 — tenants list filter tabs render raw i18n keys (statusAll/statusActive/statusInactive + typeLabel/allSources missing in BOTH en.json & ar.json). Likely a broader missing-translation class → recommend an i18n coverage sweep.
- #10 phone (+968 hardcoded, country code stripped on save — stored as `91234567`), #11 Quick→Full loses first/last name (uncontrolled inputs; controlled fields persist), #12 modal-off (dup of #4).
- Recurring theme: **phone input** (#2 onboarding + #10 tenants) and **modal-off** (#4 + #12) should each be fixed once, shared.

### Scenario 2 notes
- Building create + bulk-add 15 units worked end-to-end. DB verified: 1 property (Al Noor Residence), 15 AVAILABLE units (Unit 1–15, ONE_BR, basePrice 25), 15 DEFAULT price records (daily 25 / monthly 600). Clean org scoping.
- Architecture note: buildings & units are **separate flows** (building form has no unit-count field). Bulk-add at /dashboard/units/bulk handles multi-unit + optional default pricing.
- Cosmetic (unlogged): units sort as strings (Unit 1, 10, 11, … 2) — natural-sort tweak available if wanted.
- 5 adjustments logged as Issues #4–#8 (modals off, optional base price, auto-regen, remove price column, redirect-to-list).

### Scenario 1 notes
- Full flow worked: signup → verification email received & verified → 3-step onboarding → redirected to dashboard with empty state (dashboard, properties, units, tenants, reservations, payments, expenses all 0).
- DB verified: org `Al Noor Properties QA` (id f0981e0c…), plan=FREE, currency=OMR, tz=Asia/Muscat, owner user role=OWNER, logo uploaded. Clean — no duplicates/orphans.
- 3 adjustments logged as Issues #1–#3 (all P2, batched for later fixing session).
- Edge cases confirmed by tester: existing-email rejection ✓, password-mismatch block ✓.

---

## Notes

<!-- Running observations, environment notes, blockers -->
