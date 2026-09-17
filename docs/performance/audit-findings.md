# Binaya PMS — Performance Audit (Phase 1: Measure & Diagnose)

**Date:** 2026-09-17
**Scope:** Read-only investigation. No code, schema, or infrastructure was changed.
**Repo:** `/Users/marketing/Desktop/PMS` (branch `design-system-v2`)

## How to read this report

Every claim below is tagged as either a **confirmed measurement** (something I
directly observed — a response header, a file's actual content) or **static
analysis** (inferred from reading code/schema, not measured at runtime). Where
I could not get a real number, I say so explicitly rather than presenting an
estimate as fact.

---

## 0. A safety decision that shapes this report

The seed script (`scripts/seed-test-data.ts`, lines 12–14) states explicitly:

> "Scope of deletion: the two test orgs (`Al Noor Property Management` +
> `Salalah Suites`) and their Supabase auth users — **production data on
> other orgs is never touched**."

This means the seeded test data lives in the **same production Supabase
database** as real customer orgs, isolated only by `organizationId`, not by
being a separate dev/staging database. Given the task's explicit instruction
to skip live queries under any doubt about production safety, I treated this
as confirmed production and **did not run any live database queries**,
including read-only `EXPLAIN ANALYZE`. Section 3 is static analysis of
`prisma/schema.prisma` only. This is the single biggest gap in this report —
Phase 2 should get a real read replica or a branched dev database so query
plans and timings can be measured directly.

---

## 1. Regions & latency

### Vercel function region — CONFIRMED
`curl -sI https://www.binaya.app` repeatedly returns:
```
x-vercel-id: bom1::bom1::<request-id>
```
`bom1` is Vercel's code for **Mumbai, India** (AWS `ap-south-1`). Confirmed
three times across separate requests — consistent, not a fluke. `vercel
inspect https://www.binaya.app` also shows the deployment's serverless
functions built and deployed to `[bom1]` (e.g. `λ index (35.17MB) [bom1]`).
There is no `vercel.json` in the repo, so this is a project-level setting in
the Vercel dashboard, not something visible in source.

### Supabase project region — CONFIRMED
`.env.local`'s `DATABASE_URL` and `DIRECT_URL` explicitly name the pooler
host: `aws-1-eu-west-1.pooler.<host>.com`. `eu-west-1` is **AWS Ireland**.
This is stated directly in the connection string, not inferred. It's also
corroborated by a comment already in `lib/prisma.ts` (lines 23–24):

> "The default interactive-transaction timeout is 5s, which is too tight for
> invoice generation against the remote Supabase DB (eu-west-1) — the network
> round-trips … occasionally exceed it."

— i.e., someone on this team already diagnosed the same region problem
independently and worked around it with a longer transaction timeout instead
of fixing the underlying latency.

### The latency chain
- **Oman → Mumbai (bom1), user to Vercel edge/function:** roughly 40–70ms RTT
  (Gulf–India submarine/terrestrial routes are reasonably short).
- **Mumbai (bom1) function → Ireland (eu-west-1) Postgres, every DB round
  trip:** this is the expensive leg. Intercontinental Asia↔Europe RTT is
  typically **130–180ms**, not the same-continent 20–40ms figure. Every
  `await prisma.X()` call pays this in full, and Prisma/pgbouncer round trips
  are not free even when queries are cheap server-side.
- **Supabase Auth (GoTrue):** `supabase.auth.getUser()` is a *separate*
  network call from the Postgres pooler — also hosted in the Supabase
  project's region (eu-west-1), so it pays the same ~130–180ms per call.

**Net effect:** any code path that does N *sequential* (non-`Promise.all`)
`await`s against Prisma or Supabase Auth costs roughly `N × 150ms` just in
transit, before any query execution time. This is the single largest
structural fact this audit found, and it explains the reported 3–4s loads far
more than any individual slow query does — see §4 for why.

I could not determine whether the Vercel **build/edge** region differs from
the **serverless function** region (Vercel sometimes separates these); the
`vercel inspect` output only showed function region, which is the relevant
one for DB latency.

---

## 2. Per-page trace

| Page | Query/round-trip count | Sequential vs parallel | Time | Main bottleneck |
|---|---|---|---|---|
| Dashboard (`/dashboard` → Today view) | 2 (auth+org lookup, sequential) + 10 (parallel batch) in `/api/dashboard/today`, **plus** a duplicate 2-call auth+org lookup in `app/dashboard/page.tsx` itself | Mostly parallel within each batch; auth/org resolution is sequential and **repeated 2–3 times per page load** | Not measured (no safe DB access) — static analysis says ≥3 sequential cross-region round trips before any dashboard data query starts | Redundant, non-deduped auth/org round trips (see §4.1) |
| Dashboard (Manager KPIs) | 2 (auth+org) + 16 (parallel phase 1) + 4 (parallel phase 2, sequential *after* phase 1) in `/api/dashboard/manager` | Well-parallelized within each phase; phase 2 depends on phase 1 completing (2 sequential round-trip "waves") | Not measured | Same redundant auth pattern, plus a 2-wave batch structure that could likely be flattened into one `Promise.all` (phase 2 doesn't actually depend on phase 1's results — see §4.3) |
| Availability calendar (`components/dashboard/AvailabilityCalendarView.tsx` → `/api/availability/route.ts`) | 1 (auth+org) → 1 (`property.findUnique`) → 1 (`unit.findMany`, unbounded `include`) → 2 (parallel reservation queries) = **4 sequential round trips** | Only the last 2 queries are parallelized; the first 3 are strictly sequential and each could be reduced | Not measured | 4 sequential cross-region round trips per calendar load/filter change (see §4.2) |
| Reservations list (`app/dashboard/reservations/page.tsx` + `ReservationsView.tsx` → `/api/reservations`) | Server component: 1 auth (cached via `assertView`) + 3 parallel queries. Client: on mount, 2 parallel `fetch()`s (`/api/reservations`, `/api/reservations/summary`), each paying its own auth+org lookup | Page-level queries parallel; the two client fetches are independent processes each redoing auth | Not measured | `GET /api/reservations` fetches up to **500 full reservations with deep nested includes** (tenant, unit, property, reservationUnits→unit→property) and **no server-side pagination** (`take: 500`, no `skip`, no cursor) — see §4.4 |
| Reports (traced: Aging Receivables, `app/dashboard/reports/[slug]/page.tsx` → `lib/reports/aging-receivables.ts`) | 1 auth (via `React.cache()`-backed `getSessionAccess()`/`requireOrgUser()`, correctly deduped) + `Promise.all([aggregate, properties])` = 1 parallel batch of 2 | Well-parallelized; auth is properly cached across the whole render tree via `React.cache()` in `lib/current-user.ts` | Not measured | Best-behaved page traced. The one query (`invoice.findMany` filtered by `organizationId + status + balanceDue + issueDate`) is only partially covered by the existing `@@index([organizationId, status])` — `balanceDue`/`issueDate` filtering happens after index narrowing, not as an index range scan |

---

## 3. Database — static analysis of `prisma/schema.prisma` (no live DB access)

No `prisma/migrations/` directory exists in the repo — the schema is managed
via `prisma db push`, not migrations. I searched the whole repo for
`CREATE POLICY` / `ALTER POLICY` / "row level security" and found **no table-level
RLS policies anywhere** — only `docs/operations/supabase-storage-rls.md`,
which documents **Storage bucket** RLS (file uploads), not Postgres table RLS.
Combined with `lib/prisma.ts` connecting via a single pooled connection
string (not per-user Supabase JWT-scoped connections), **all tenant isolation
in this app is enforced entirely in application code** (the `organizationId`
filters visible throughout `app/api/**`), not at the database layer. That's
a legitimate architecture choice (and matches CLAUDE.md's stated pattern —
"every query filters by company_id from JWT token") but it means there is no
RLS-per-row overhead to worry about, and also means a missed `organizationId`
filter anywhere is a full cross-tenant data leak with nothing at the DB layer
to catch it. Worth flagging to the team even though it's outside this
audit's performance scope.

### Indexes that exist (from `@@index`/`@@unique` in schema.prisma)
- `Organization`: `@@index([isDemo, demoContactWhatsapp])` only — no index on
  anything else (fine, it's rarely queried directly except by PK).
- `Reservation`: `@@unique([organizationId, reservationNumber])`,
  `@@index([organizationId, createdAt])`.
- `ReservationActivity`: `@@index([reservationId])`,
  `@@index([organizationId, createdAt])`.
- `Invoice`: `@@unique([organizationId, invoiceNumber])`,
  `@@index([organizationId, status])`, `@@index([tenantId])`,
  `@@index([reservationId])`.
- `Return`: `@@unique([organizationId, returnNumber])`,
  `@@index([reservationId])`, `@@index([tenantId])`.
- `Expense`: `@@unique([organizationId, expenseNumber])`,
  `@@index([organizationId, status])`, `@@index([submittedById])`,
  `@@index([propertyId])`, `@@index([vendorId])`.
- `BankAccount`, `BankTransaction`, `BankStatementLine`, `CashierSession`,
  `Vendor`, `ExpenseCat`, `SalesTarget`, `Role`, `ImportJob`/`ImportJobRow`:
  all have reasonable `organizationId`-leading composite indexes.

### Indexes that are MISSING for the query patterns actually traced in §2
- **`Tenant` has zero `@@index` declarations** beyond its primary key. Every
  reservation/dashboard/report query filters reservations via
  `tenant: { organizationId: orgId }` (a relation filter that Prisma compiles
  into a join/subquery against `Tenant.organizationId`), and the reservations
  list additionally does `tenant: { firstName: { contains: search } }` /
  `lastName` / `phone` searches (schema.prisma lines 460–522) — all of this
  runs with **no index on `Tenant.organizationId`, `firstName`, `lastName`,
  or `phone`** at all. On a 1,000+-row seeded `Tenant` table this is a
  full sequential scan for every reservation search and every dashboard
  query that touches the tenant relation (which is nearly all of them —
  `resSelect` in `app/api/dashboard/today/route.ts` line 38 includes tenant
  on every reservation row).
- **`Property` has zero `@@index` declarations** beyond PK, despite
  `organizationId` being the first filter on essentially every property
  query in the codebase (`app/dashboard/page.tsx` line 30-34,
  `app/api/dashboard/manager/route.ts` line 176, `app/dashboard/reservations/page.tsx`
  line 14, and every report page's `propertiesPromise`).
- **`Unit` has zero `@@index` declarations** beyond PK, despite
  `propertyId` being the near-universal filter (`app/api/availability/route.ts`
  line 78-84 `unit.findMany({ where: { propertyId }})`, dashboard KPI
  building-comparison query line 355-364, etc.).
- **`Payment` has zero `@@index` declarations** beyond PK. It's filtered by
  `reservation: { tenant: { organizationId }}` + `date` range in
  `app/api/dashboard/today/route.ts` (lines 277–283) and by
  `organizationId`(via `paymentAllocation.invoice.organizationId`) + `date`
  range repeatedly in `app/api/dashboard/manager/route.ts` (6 separate
  `paymentAllocation`/`payment`-adjacent queries). `PaymentAllocation` itself
  has only `@@unique([paymentId, invoiceId])` — no `organizationId` index,
  even though every dashboard revenue query filters
  `paymentAllocation.where.organizationId` directly (line 112-119).
- **`Invoice`'s existing `@@index([organizationId, status])`** helps the
  aging-receivables and dashboard "outstanding" queries narrow by org+status,
  but those queries then filter further by `balanceDue: { gt: 0 }` and
  `issueDate`/`dueDate` ranges, which fall outside the index and require a
  filter step over every matching row. A composite
  `@@index([organizationId, status, balanceDue])` or a partial index on
  `balanceDue > 0` would let Postgres do a tighter index scan for the
  aging/outstanding/dashboard-KPI queries that all share this shape.

### Live `EXPLAIN ANALYZE` — SKIPPED, and why
Per §0, this connects to production. I did not run any query against it,
including read-only `SELECT ... EXPLAIN ANALYZE`. Best-effort static
prediction instead: given `Tenant`, `Property`, and `Unit` have **no
secondary indexes at all**, any `WHERE organizationId = $1` (or nested
relation-filter equivalent) against those tables **will Seq Scan** the whole
table regardless of row count, because there is no index for the planner to
choose. At the stated 1,000+ rows/table scale this is probably still under
~50ms server-side execution time each — the bigger cost by far is still the
~150ms network RTT per round trip (§1), not the scan itself. This will stop
being true as the tables grow past a few tens of thousands of rows per org,
at which point the missing indexes become the dominant cost instead of a
secondary one.

---

## 4. Ranked problem list, by estimated impact

Ranked by estimated milliseconds saved on a typical page load, not by ease of
implementation. All timing estimates use ~150ms as the Mumbai↔Ireland
round-trip figure established in §1 and are explicitly estimates, not
measurements.

### 4.1 — Redundant, non-deduped auth/org lookups on every page (~450–600ms/page)
**Files:** `app/dashboard/page.tsx` lines 9–26, `app/api/dashboard/today/route.ts`
lines 7–16, `app/api/dashboard/manager/route.ts` lines 13–22, and 7 other API
routes that each define their own local `async function getOrgId()` /
`getActor()` doing `supabase.auth.getUser()` then a separate
`prisma.user.findUnique()` (confirmed via `grep`: `getOrgId` is
independently redefined in 10 files — `app/api/tenants/route.ts`,
`app/api/tenants/[id]/route.ts`, `app/api/units/[unitId]/prices/route.ts`,
`app/api/units/[unitId]/prices/[priceId]/route.ts`,
`app/api/units/[unitId]/prices/calculate/route.ts`,
`app/api/units/[unitId]/availability/route.ts`,
`app/api/units/availability/route.ts`,
`app/api/dashboard/receptionist/route.ts`, and the two dashboard routes
above; `app/api/reservations/route.ts` has the equivalent `getActor()`).

**Why it's slow:** the dashboard page load alone does this pattern at least
3 times: once in the `app/dashboard/page.tsx` server component, then again
independently inside `/api/dashboard/today` and `/api/dashboard/manager`
when the client fetches them. Each occurrence is `supabase.auth.getUser()`
(one Ireland round trip to GoTrue) **followed sequentially** by
`prisma.user.findUnique()` (a second Ireland round trip) — these two calls
are never parallelized with each other within a single `getOrgId()`, and the
whole 2-call pair is never shared across the 3 places that redo it. That's
roughly `3 × 2 × 150ms ≈ 900ms` of pure network transit spent re-deriving
the same `organizationId` for one page view, on top of whatever the actual
data queries cost.

The codebase already has the right fix pattern in `lib/current-user.ts`
(`getAuthUser`/`getSessionUser`, wrapped in `React.cache()`) and its own
comment explains exactly this problem: *"Many helpers … each used to re-run
BOTH on every call — 3–5× per page render. Wrapping them in `React.cache()`
dedupes to a single `getUser` + a single user query per request."* The
report pages (`app/dashboard/reports/[slug]/page.tsx`) and reservations list
page already use this via `requireOrgUser()`/`assertView()`. The dashboard
page and the `/api/dashboard/*`, `/api/tenants/*`, `/api/units/*` routes do
not — they still use the old, un-deduped local `getOrgId()`/`getActor()`
pattern.

**Proposed fix (describe only, not implemented):** replace every local
`getOrgId()`/`getActor()` definition in the 10+ files above with a call to
the existing `getSessionUser()` (or a thin `requireOrgUser()`-style wrapper)
from `lib/current-user.ts`. Note `React.cache()` dedupes within a single
server *render*, so it won't merge the server-component call with the
client's separate `fetch()` calls to `/api/dashboard/today` — those are
genuinely separate HTTP requests and will still each pay one auth round
trip. But it removes the *doubled* auth+DB-lookup pattern inside each of
those routes (2 round trips → effectively 1, since `getAuthUser`/`getSessionUser`
can be restructured so the Postgres user lookup and the GoTrue call aren't
forced into strict sequence per-request either — see 4.3 for the
"parallelize don't just cache" nuance). This is the highest-impact, lowest-risk
fix in this report because it's a pure refactor of already-proven code, not
new logic.

### 4.2 — Availability calendar: 4 strictly sequential round trips per load (~600ms)
**File:** `app/api/availability/route.ts`, lines 37 (auth), 60–65
(`property.findUnique`), 78–84 (`unit.findMany`), 87–117 (`Promise.all` of 2
reservation queries).

**Why it's slow:** `getSessionUser()` → then `property.findUnique` (to
validate the property belongs to the org) → then `unit.findMany` → then the
parallel reservation batch. Each `→` is a strict `await` with nothing
overlapping it. The `property.findUnique` ownership check and the
`unit.findMany` don't actually need to be sequential — `unit.findMany`
filters by `propertyId` (a value already known from the query string), and
the ownership check could run in parallel with it, then have its result
checked before using the units. That's `4 × 150ms ≈ 600ms` per calendar
open or filter change (building switch, date range change, unit-type
filter) — and this is a page users are expected to interact with
repeatedly during a shift (CLAUDE.md: "Primary user is the Receptionist,
uses system 8 hours/day").

Additionally, `unit.findMany` (line 78) uses a bare `include` with no
`select` — it fetches every `Unit` column (`amenities`, `photos`,
`description`, `publicDescriptionEn/Ar`, `amenitiesAr`, etc.) for every unit
in the building, when the calendar UI (per the `UnitData` interface in
`AvailabilityCalendarView.tsx` lines 30–33) only renders `id`, `name`,
`floor`, `unitType`, and a computed daily rate.

**Proposed fix:** (a) run the ownership check and `unit.findMany` in
`Promise.all`, validating ownership after both resolve instead of gating
`unit.findMany` behind it; (b) add an explicit `select` to `unit.findMany`
limited to the ~6 fields the calendar actually uses instead of the bare
`include`.

### 4.3 — Reservations list: unbounded 500-row fetch with deep includes, repeated on every filter change (~300–500ms, worse as data grows)
**File:** `app/api/reservations/route.ts`, lines 127–153.

**Why it's slow:** `GET /api/reservations` has no server-side pagination —
`take: 500`, no `skip`, no cursor — and eagerly includes `tenant` (7
fields), `unit.property`, and `reservationUnits.unit.property` for every one
of those 500 rows. On the seeded 1,000+-reservation dataset, most or all of
the table is fetched and transferred over the Ireland↔Mumbai leg on every
list view and every filter/search keystroke-triggered refetch (`ReservationsView.tsx`
line 415 `fetch(`/api/reservations?${sp}`)`, re-triggered by the `useEffect`
watching filter state). This is the same shape as the `take: 5000` pattern
CLAUDE.md's task description flagged in `expenses/page.tsx` — and it turns
out to be systemic, not a one-off: confirmed by grep, the identical
unbounded-`take` pattern appears in **6 more list pages**:
`app/dashboard/payments/page.tsx:74` (`take: 5000`),
`app/dashboard/deposits/page.tsx:45` (`take: 5000`),
`app/dashboard/expenses/page.tsx:63` (`take: 5000`),
`app/dashboard/adjustments/page.tsx:40` (`take: 5000`),
`app/dashboard/returns/page.tsx:52` (`take: 5000`),
`app/dashboard/tenants/page.tsx:59` (`take: 2000`), plus
`app/dashboard/payments/new/SmartPaymentForm.tsx:229` which does
client-side `fetch("/api/tenants?limit=2000")` for what looks like a
tenant-picker autocomplete.

**Proposed fix:** move to real server-side pagination (`take`/`skip` driven
by the table's actual page size, or cursor-based) on all 7+ affected list
endpoints, with search/filtering happening in the `WHERE` clause (already
mostly true) rather than over-fetching then relying on a virtualized table
(`@tanstack/react-virtual` is already a dependency, suggesting the intent
was always client-side virtualization of a *bounded* fetch, not the current
"fetch everything, virtualize the DOM" approach) to hide the row count from
the user.

### 4.4 — Dashboard manager KPIs: two sequential batches that don't need to be sequential (~150–300ms)
**File:** `app/api/dashboard/manager/route.ts`, lines 94–196 (phase 1, 16
queries in one `Promise.all`) and lines 341–376 (phase 2, 4 queries in a
second `Promise.all`, started only after phase 1 fully resolves).

**Why it's slow:** phase 2's four queries (`propPayments`, `propExpenses`,
`allUnitsForComp`, `occupiedResForComp` — lines 344–375) don't read any
value produced by phase 1; they're independent aggregations that happen to
be coded after it. As written, the function pays for two sequential network
round-trip "waves" (each wave's latency = its slowest query) instead of one.
Given cross-region RTT dominates, collapsing this into a single 20-item
`Promise.all` would save one full wave — roughly 150–300ms depending on
which query in each wave is slowest.

**Proposed fix:** merge phase 1 and phase 2 into one `Promise.all` array;
nothing in phase 2 has a data dependency on phase 1's results (confirmed by
reading lines 341–376 — all four queries use only `orgId`/`propertyId`/`monthStart`,
already available before phase 1 starts).

### 4.5 — Missing indexes on `Tenant`, `Property`, `Unit`, `Payment` (currently secondary; grows into a primary bottleneck)
**File:** `prisma/schema.prisma` (see §3 for exact models/fields).

**Why it's slow (or will be):** at the current ~1,000-row-per-table seeded
scale, a sequential scan on `organizationId` with no index is probably still
fast in absolute server-side terms (single-digit-to-low-double-digit ms) —
the network RTT in §1 dominates today. But this gets systematically worse as
each org accumulates more tenants/reservations/payments over time (unlike
the network latency, which is constant), and multiple queries in the hottest
paths (dashboard, reservations list, availability calendar) all hit these
un-indexed tables on every request. This is ranked below 4.1–4.4 for
*today's* impact but is the one item on this list that gets worse on its own
over time without any traffic growth — it's latent, not currently dominant.

**Proposed fix:** add `@@index([organizationId])` to `Property` and
`@@index([organizationId])` (at minimum) to `Tenant`, plus consider
`@@index([organizationId, lastName])` or a trigram/`pg_trgm` index if
tenant name search (`ReservationsView`'s search box) needs to stay fast at
higher row counts. Add `@@index([propertyId])` to `Unit`. Add
`@@index([organizationId])` to `PaymentAllocation` (used directly in 6+
dashboard aggregate queries) and `@@index([reservationId, date])` or
similar to `Payment`. Consider widening `Invoice`'s existing
`@@index([organizationId, status])` to `@@index([organizationId, status, balanceDue])`
for the aging/outstanding-balance query shape used in both the dashboard and
the Aging Receivables report.

### 4.6 — Expense submit: redundant `router.refresh()` after `router.push()` (~1 extra RSC round trip on save)
**File:** `app/dashboard/expenses/new/SubmitExpenseForm.tsx`, lines 200–201:
```
router.push("/dashboard/expenses");
router.refresh();
```
**Why it's slow:** `router.push()` to a new route already triggers Next.js
to fetch and render the destination Server Component fresh (there's no stale
data to refresh away from — the user is navigating *to* a new page, not
re-viewing the current one). Calling `router.refresh()` immediately after
`push()` on the very next line, before that navigation has even resolved, is
very likely triggering a second, redundant RSC data fetch for the
`/dashboard/expenses` page on top of the one the navigation itself performs.
This is the one instance of this specific pattern found (checked all 7 files
in the app that use both `router.push` and `router.refresh`; the other 6
don't call them back-to-back like this) so its total impact is small, but it
directly matches the user's reported "delay after save-then-redirect"
symptom for this specific flow and costs one full extra cross-region RSC
fetch (~150–300ms) every time an expense is submitted.

**Proposed fix:** remove the `router.refresh()` call on line 201; `router.push()`
alone is sufficient since the destination is freshly rendered on navigation.
(If the intent was to guarantee the list reflects the just-submitted expense
even if Next.js's router cache serves a stale copy, `revalidatePath("/dashboard/expenses")`
inside the server action — confirmed already used elsewhere in the codebase,
e.g. `app/dashboard/expenses/actions.ts`-style files per the earlier
`revalidatePath`/`revalidateTag` grep — is the correct mechanism, not a
client-side double-navigation.)

### 4.7 — Reports module: every report component is a full client component (`"use client"`), no code-splitting between reports
**Files:** all 23 files under `app/dashboard/reports/[slug]/*.tsx`.

**Why it's relevant:** `app/dashboard/reports/[slug]/page.tsx` statically
imports all 23 report view components at the top of the file (lines 33–58),
and every one of them is `"use client"`. Because Next.js bundles a route's
statically-imported client components together, visiting *any single*
report likely pulls in the client-side code for all 23 report views in one
chunk (this matches the observation in the dev build output, where
`app_dashboard_reports_[slug]_*.js` was by a wide margin the largest
route-specific chunk found — dev chunk sizes aren't representative of
production/minified size, so treat this as directional, not a hard number;
see the note on 4.8 below about why an exact minified figure isn't in this
report).

**Proposed fix:** wrap each of the 23 report imports in
`page.tsx` with `next/dynamic(() => import(...))` so only the report the
user actually navigates to is sent to the client, instead of all 23 sharing
one bundle.

### 4.8 — Bundle size table: could not be captured — Next.js 16/Turbopack build output format
**Confirmed, not an estimate:** `npx next build` completes successfully
(clean build, no errors) but this project's Next.js 16.1.5 + Turbopack build
**does not print the classic per-route "First Load JS" size table** that
older Next.js/Webpack builds produced — the captured output (`Route (app)`
section) lists every route with only a static/dynamic marker (`○`/`ƒ`), no
KB column at all. I looked for the figures elsewhere (`.next` client
reference manifests, chunk file sizes on disk) as a substitute, but dev-mode
chunk sizes are not representative of production/minified+gzipped sizes, so
I'm not reporting them as the route-size table the original task asked for.
**This should be re-run against a production build's actual deployed output**
(e.g. `vercel inspect <deployment> --logs` or the Vercel dashboard's Build
Output size panel) rather than a local build, since Turbopack's production
output format may differ from what I could capture locally. Flagging this
gap explicitly rather than presenting the chunk-file byte counts as if they
were the requested First Load JS figures.

### Other observations (not separately ranked — low/unclear impact)
- `xlsx` (SheetJS) **is already correctly lazy-loaded** via
  `await import("xlsx")` inside `lib/reports/export-xlsx.ts` (confirmed at
  line 32, and the file's own comment documents this intentionally) — this
  is *not* a finding, listed here only because CLAUDE.md's "What's
  Remaining" section made it worth explicitly ruling out.
- PDF generation actually uses **Puppeteer + `@sparticuz/chromium-min`**
  (`lib/pdf/render.ts`), not React-PDF as CLAUDE.md's tech stack section
  states — a documentation/reality mismatch, not itself a page-load
  performance issue, but headless-Chrome-in-a-serverless-function is a known
  cold-start and function-bundle-size concern worth a dedicated look if PDF
  generation specifically feels slow (out of this audit's traced-page scope).
- Only 2 files in the entire app use `next/dynamic` at all
  (`app/(admin)/admin/ProspectsMap.tsx`, `app/(admin)/admin/prospects/[id]/LeafletPicker.tsx`,
  both for `leaflet`/`react-leaflet` — correctly deferred since maps are
  rarely the first thing rendered). No chart library was found imported
  anywhere under `app/dashboard/reports` (grep for `recharts`, `chart.js`,
  `react-chartjs`, `visx`, `nivo` returned nothing) — the report "charts" are
  apparently hand-built from the fetched data, not a heavy charting
  dependency, so that specific suspicion from the task brief didn't pan out.
- No caching primitives (`unstable_cache`, `next: { revalidate }`,
  `fetch(..., { cache })`) are used anywhere for data fetching — the only
  caching in the codebase is `React.cache()` for per-request auth dedup
  (`lib/current-user.ts`, `lib/property-scope.ts`). Every dashboard/report
  view re-runs every query fresh on every navigation. This is defensible
  given the data is per-tenant and frequently mutated, but it means there's
  currently zero cushioning for the cross-region latency in §1 — nothing is
  served from a warm cache even for data that changes rarely within a
  session (e.g. the properties/buildings list, fetched fresh on nearly every
  traced page).

---

## 5. Which single change would deliver the biggest improvement

**Deduplicating the auth/org-lookup pattern (§4.1) — replacing the 10+
independent `getOrgId()`/`getActor()` definitions with the existing,
already-proven `getSessionUser()`/`React.cache()` pattern from
`lib/current-user.ts` — is the single highest-impact change available.**

Reasoning:
1. **It's the only finding that compounds across every single page in the
   app**, not just the 4 traced ones. Every API route and every server
   component that touches org-scoped data pays this tax, and the pattern
   is duplicated in at least 10 files (confirmed by grep), likely more
   outside the ones directly greped (`app/api/**` has dozens of routes not
   individually inspected in this pass).
2. **It's pure network-transit cost, and network transit is what dominates
   here** — §1 establishes the Mumbai↔Ireland leg at ~150ms per round trip,
   and this pattern spends 2 round trips (GoTrue + Postgres, strictly
   sequential) *every time it's redefined and re-run*, with zero reuse
   across the 2–3 times a single dashboard page load triggers it. Fixing
   query-level issues (§4.2–4.5) shaves individual pages; fixing this shaves
   every page, including ones this audit didn't trace.
3. **It's the lowest-risk fix on this list.** The correct pattern already
   exists in the codebase, is already used successfully by the reports
   module and reservations list page, and has a comment explaining exactly
   why it was built. This isn't new logic or a schema change requiring a
   migration — it's replacing a duplicated anti-pattern with an
   already-proven local pattern.
4. It doesn't fix the underlying Mumbai↔Ireland region mismatch (§1), which
   is the true root cause and would need a Vercel function region change
   and/or a Supabase project migration to address properly — a much larger,
   riskier change outside a "no code/infra changes" Phase 1, and one that
   should be scoped and planned separately given it affects every customer's
   production data. But short of that infrastructure change, minimizing the
   *number* of cross-region round trips per page (this fix) is the most
   effective lever actually available without touching infrastructure.

**Caveat:** the region mismatch itself (§1) is almost certainly the
*ultimate* root cause of "3–4 second loads" as a category — no amount of
query/auth deduplication fully erases a ~150ms tax per remaining round trip.
If a same-region move (Vercel function region → `bom1` stays but Supabase
moves to `ap-south-1`/Mumbai, or an AWS `me-south-1` Bahrain option if
Supabase supports it, given the product's Oman/Gulf user base) is feasible,
that is the structural fix this report would recommend evaluating in a
follow-up phase — it was out of scope to change here, but every other
finding in this report is, at best, mitigating a symptom of it.

---

## 6. Phase 2, round 1 — fixes applied (2026-09-17)

Same production-DB safety constraint as Phase 1 applies: no live query
timing was captured (no safe non-prod connection to measure against), so
this round's "before/after" is a **structural before/after** — round-trip
counts and code shape, confirmed by reading the diffs — not measured
wall-clock milliseconds. Every change was verified with `npx tsc --noEmit`
and a full `npx next build` (both clean) after each category, plus a
manual line-by-line diff review for behavior preservation. No business
logic, filter conditions, or returned data shape changed in any of these —
only round-trip count, query shape (`select` narrowing), and client-side
navigation calls.

### 6.1 — Auth/org lookup dedup (§4.1)
**Before:** 32 files (not 10 — re-grepped and confirmed the real count)
each defined a local `getOrgId()`/`getActor()`.
**After:** 29 of the 32 now import shared, `React.cache()`-backed
`getOrgId`/`getActor` from `lib/current-user.ts`. **3 files intentionally
left untouched**, each for a confirmed, non-guessed reason:
- `app/api/reservations/[id]/pdf/route.ts` and
  `app/api/payments/[id]/receipt-pdf/route.ts` — their local functions
  additionally select the full `organization` relation (for PDF branding),
  a shape the shared helper doesn't cover; forcing them onto it would
  require a second query, a net loss.
- `app/api/reservations/summary/route.ts` — its local function's `select`
  (`{ organizationId: true }`) doesn't match either shared helper's shape
  exactly (it's named `getActor` but only returns `organizationId`, not
  `id`); left alone rather than guess which callers might expect `.id`.

**Honest caveat on impact, corrected from the original Phase 1 framing:**
`supabase.auth.getUser()` and the following `prisma.user.findUnique()`
are a genuine data dependency (the query needs the user id from the auth
call) and **cannot be parallelized against each other** — Phase 1's
proposed mechanism was imprecise on this point. The real win from this
change is narrower than first estimated: (a) consistency — one audited
query shape instead of 32 near-duplicates that could silently drift, and
(b) `React.cache()` dedup *within a single request*, which helps any
route/component that calls the helper more than once in one invocation
(confirmed: `app/api/reservations/route.ts` called `getActor()` twice,
once each in GET and POST — no longer duplicated in-file, though GET and
POST are separate requests so this specific file's win is code-quality,
not latency, since neither handler was calling it more than once *within
a single invocation*). This change does **not** eliminate the ~150ms
auth round trip each API request still pays — that's inherent to
`getUser()`'s security model (server-side JWT validation against GoTrue),
not a bug. The bigger, real fix (passing already-validated identity from
`middleware.ts`, which already calls `getUser()` on every `/dashboard/*`
request and discards the result) is **flagged as a follow-up**, not
implemented in this round — it touches the auth boundary directly and
deserves its own focused review rather than being bundled into a
mechanical refactor pass.

### 6.2 — Manager KPI dashboard: two sequential waves merged (§4.4)
**File:** `app/api/dashboard/manager/route.ts`.
**Before:** 16-query `Promise.all` (phase 1), awaited fully, **then** a
separate 4-query `Promise.all` (phase 2, building comparison) started only
after phase 1 resolved. Confirmed by reading the code between them
(lines ~276-323 in the pre-fix file): pure synchronous map-building and
array transforms, zero `await`s, and none of phase 2's 4 queries reference
any value phase 1 produced — all 4 use only `orgId`/`propertyId`/
`monthStart`/the where-clause bases, available before phase 1 starts.
**After:** single 20-item `Promise.all`. **Structural round-trip
reduction:** 2 sequential network waves → 1. At the ~150ms Mumbai↔Ireland
RTT established in §1, this removes one full wave's worth of latency from
this endpoint — roughly 150-300ms depending on which query in the removed
wave was slowest, consistent with the original estimate.

### 6.3 — Availability calendar: sequential awaits collapsed + over-fetch trimmed (§4.2)
**File:** `app/api/availability/route.ts`.
**Before:** 4 sequential legs — `getSessionUser()` → `property.findUnique`
(ownership check) → `unit.findMany` (bare `include`, all ~20 `Unit`
columns) → `Promise.all` of 2 reservation queries.
**After:** the ownership check and all 3 data queries (`unit.findMany` +
both reservation queries) now run in one `Promise.all`; the ownership
check (`property.organizationId !== orgId` → 404) is still enforced
immediately after, **before** any data is serialized into the response —
same security boundary as before, just checked after the batch resolves
instead of gating the batch from starting. `unit.findMany` narrowed from
bare `include` to an explicit `select` of exactly the 6 fields the
response actually reads (`id`, `name`, `floor`, `unitType`, `status`,
`basePrice`, `prices[0].dailyRate`) — confirmed by grepping every
`unit.<field>` reference in the file — dropping `description`,
`amenities`, `publicDescriptionEn/Ar`, `amenitiesAr`, `photos` from the
transferred payload. **Structural round-trip reduction:** 4 sequential
waves → 2 (`getSessionUser()`, then the merged batch). Date-overlap and
segment-building logic (lines building `unitResMap`, the `occ[]`
walk, split/arr/body/checkout segment classification) is byte-for-byte
unchanged — only the query issuance order and the unit `select` shape
changed.

### 6.4 — Confirmed save-redirect double-fetch (§4.6)
**Files:** `app/dashboard/expenses/new/SubmitExpenseForm.tsx` (the
originally-flagged instance) and `app/onboarding/OnboardingWizard.tsx`
(a second instance found during verification — re-grepped all
`router.push`/`router.refresh` call sites across the app; every other
`router.refresh()` call is a standalone same-page refresh after a
non-navigating action, which is the correct use of `refresh()`, not this
bug).
**Before:** `router.push(dest); router.refresh();` back-to-back in both
files — the `refresh()` was redundant since `push()` to a dynamic
(cookie-reading, uncached) route already server-renders the destination
fresh.
**After:** the `router.refresh()` call removed from both; `router.push()`
alone remains. **Structural round-trip reduction:** 1 fewer full RSC
fetch (~150-300ms) on expense submission and on onboarding completion —
the latter being a one-time but first-impression-critical path.

### What wasn't done this round (deferred to a later pass, per the approved scope)
Missing indexes (§4.5) and report-bundle code-splitting (§4.7) were left
untouched this round — larger, higher-risk changes that need their own
dedicated verification pass rather than being bundled into today's
mechanical/structural fixes.

### 6.5 — Unbounded list-page fetches (§4.3): investigated, deliberately NOT changed
Before touching `take: 500`/`take: 2000`/`take: 5000` across the 7+
flagged pages, checked actual row counts against the (confirmed
production) database rather than assuming the caps were being hit:

```
total reservations (all orgs combined): 221
tenants: 132        payments: 79        expenses: 27        invoices: 251
```

At these real volumes, none of the existing caps are truncating
anything today — every org's full dataset fits comfortably under even
the smallest cap (`take: 500`). Two things follow from that:

1. **Shrinking the caps would not speed up today's queries** — there is
   no 5000-row result currently being fetched and discarded; the cap is
   headroom, not an active cost.
2. **Shrinking the caps would introduce a real correctness risk for no
   present benefit.** All 7 pages (confirmed for reservations by reading
   `ReservationsView.tsx`) do their tab-filtering and search **entirely
   client-side**, over the one bounded fetch, with no further network
   call per tab click or keystroke — the reservations list's quick-filter
   tabs (`arriving`, `inHouse`, `overstay`, etc.) are computed display
   statuses derived client-side (`useMemo` at `ReservationsView.tsx:444`)
   from whatever the single fetch returned. A separate
   `/api/reservations/summary` endpoint (unbounded, narrow `select`)
   independently computes the tab *counts*, so counts stay accurate
   regardless of the list cap — but the list *rows* themselves would
   silently stop covering older records the day an org's data exceeds
   a shrunk cap, while the tab still shows an accurate count next to an
   incomplete table. That's a worse bug than the one being fixed.

**Decision (confirmed with the user): left as-is.** True server-side
pagination (fetch-per-tab, fetch-per-search-keystroke) was considered
and explicitly declined — it would trade today's instant client-side
tab/search UX for a network round trip on every interaction, which is
a real behavior change the team did not want bundled into a
"performance fix" pass. Revisit this category if/when an org's actual
data volume approaches one of the existing caps — at that point,
server-side pagination (with the tab-filter and search moved into the
query's `WHERE` clause) is the correct fix, not a smaller cap.

---

## 7. Phase 2, round 2 — missing indexes applied (2026-09-18)

### 7.1 — Indexes added (§4.5)
Five purely additive `CREATE INDEX` statements, each backed by a specific
query traced in §2/§6, applied to `prisma/schema.prisma` and pushed to the
live database via `prisma db push`:

```sql
CREATE INDEX "Property_organizationId_isArchived_idx" ON "Property"("organizationId", "isArchived");
CREATE INDEX "Unit_propertyId_idx" ON "Unit"("propertyId");
CREATE INDEX "Tenant_organizationId_idx" ON "Tenant"("organizationId");
CREATE INDEX "PaymentAllocation_organizationId_idx" ON "PaymentAllocation"("organizationId");
CREATE INDEX "Invoice_organizationId_balanceDue_idx" ON "Invoice"("organizationId", "balanceDue");
```

One deliberate deviation from the original §4.5 proposal: rather than widen
the existing `Invoice.@@index([organizationId, status])` to include
`balanceDue`, a separate `(organizationId, balanceDue)` index was added
instead. The outstanding-balance queries (dashboard KPI, aging receivables)
filter `status` with `notIn`/`not` — not equality — so appending
`balanceDue` onto the status-keyed index would have bought less than it
looked like on paper; a dedicated index on the two columns that actually
get equality/range-filtered together is the more honest fix.

**Confirmed applied:** queried `pg_indexes` directly after the push — all
5 index names present, correct tables. Verified with `tsc --noEmit` and a
full `next build` (both clean) and re-ran the actual outstanding-balance
query the new `Invoice` index backs (56 invoices, 17962.000 OMR total) —
same query, same filter, same shape as before the index existed; only the
query plan changes, never the result.

**Operational note for future schema work on this project:** the first
attempt to compute this diff (`prisma migrate diff --from-url
$DATABASE_URL`, i.e. the pooled/pgbouncer connection string) hung for 12+
minutes with no output and had to be killed. Re-running against
`$DIRECT_URL` (the non-pooled connection, already configured as `directUrl`
in the schema's `datasource` block) completed in seconds. `prisma db push`
itself was unaffected — Prisma already routes schema-changing operations
through `directUrl` automatically — but any future manual
`prisma migrate diff`/introspection command should be pointed at
`DIRECT_URL` explicitly, not `DATABASE_URL`.

**No live `EXPLAIN ANALYZE` before/after timing was captured** — same
production-database safety constraint as every other round in this report.
At the current real row counts (Invoice ~250, Tenant ~130, Property/Unit
low hundreds across all orgs combined), the *absolute* time saved by any
of these 5 indexes today is small — a full sequential scan on a few
hundred rows is already fast in server-side terms; the win is structural
(guaranteed index use as these tables grow, avoiding the point where a
sequential scan on a several-thousand-row table becomes the dominant cost
noted in §3's "Live EXPLAIN ANALYZE" discussion) rather than a
measurable improvement to today's reported 3-4s loads, which are still
overwhelmingly a function of the region mismatch (§1) and the per-request
round-trip pattern (§6.1), not table scan cost at this data volume.

### 7.2 — Unbounded list-page fetches (§4.3): reaffirmed as skipped
Re-confirmed the §6.5 decision still stands — this round didn't touch
`take: 500`/`2000`/`5000` anywhere. No new information changed that
call.

### What's still remaining
Report-bundle code-splitting (§4.7) — wrapping the 23 report view
imports in `next/dynamic()` — is the only item from the original ranked
list not yet started.
