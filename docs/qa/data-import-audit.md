# Data Migration / CSV Import — Audit & Test Report

**Date:** 2026-09-18 (fixes applied 2026-09-19)
**Scope:** `Settings → Data Import` — the CSV/XLSX bulk-import wizard.
**Method:** full code read of the engine, every API route, every wizard
component, and the Prisma schema; live functional testing of the real
pipeline (parser → auto-map → parse → validate → create) against an
isolated demo organization (`عبدالله وجدي — Demo`, safe to write test
data into — never production/customer orgs).

**Status: all findings below are fixed and verified**, except the
`value-parsers.ts` note (§3.5, correctly inert since it's unreferenced —
flagged for whoever builds the next adapter) and §3.6 (a scope note for a
future adapter, not an action item today). See §7 for what changed.

---

## 1. What's actually implemented

The engine (`lib/import/`) is built as a generic, adapter-based pipeline
intended to support five record types — the `ImportRecordType` enum
already defines `BUILDINGS, UNITS, TENANTS, RESERVATIONS, EXPENSES`, and
the wizard UI, translations, and icon set are all pre-built for all five.

**Only Buildings is actually registered and usable today**
(`lib/import/registry.ts`: `IMPORT_ADAPTERS = [buildingsAdapter]`). Step 1
of the wizard correctly reads from the registry, not the full enum, so
Units/Tenants/Reservations/Expenses are **not** offered as broken/dead
options — they simply don't appear. This is a correct, deliberate
scoping, not a bug, but is worth stating plainly since "Data Migration"
as a name suggests broader scope than what's live.

## 2. Architecture — what's good

- **Every entity is created through the same code path the manual UI
  uses** — `buildingsAdapter.createRow()` calls `createPropertyCore()`,
  the identical function `POST /dashboard/properties/new` calls. No
  parallel/raw-insert logic that could drift from business rules.
- **Multi-tenancy is airtight.** Every one of the 11 per-job API routes
  (`upload`, `mapping`, `validate`, `run`, `process-batch`, `rows`,
  `undo`, `reimport`, `cancel`, `errors-file`, the job-detail route)
  calls `getOwnedJob(jobId, organizationId)`, which 404s if the job
  belongs to a different org. Confirmed by reading all 11 routes
  directly, not by trusting the comment.
- **Batch processing is correctly idempotent and fault-isolated.**
  `process-batch` processes 50 rows at a time, is safe to re-poll, and
  one bad row never aborts the batch — it's recorded as an ERROR row and
  the loop continues. Re-validates each row at run time (not just at the
  earlier dry-run step), which correctly catches cases like two rows in
  the same file both trying to create a building with the same name.
- **Validate is a genuine dry run** — confirmed it only calls
  `parseRow`/`validateRow`, never `createRow`. No writes happen before
  the user explicitly clicks "Run."
- **Undo is safe** — requires the stricter `FULL` permission (not just
  `CREATE`), and the adapter's `undoRow()` refuses to delete a building
  that has active reservations, reporting exactly which rows were
  blocked and why rather than failing silently or partially.
- **CSV output is correctly escaped** (commas/quotes/newlines in cell
  values) and prefixed with a UTF-8 BOM so Excel opens Arabic content
  correctly — verified by direct parsing test (see §4).
- **File-content sniffing**, not extension-trusting, decides CSV vs
  XLSX — a renamed file can't bypass format detection.
- **Encoding detection** correctly falls back to Windows-1256 when a
  file isn't valid UTF-8 (the common case for a CSV exported from
  Arabic-locale Excel), and the UI offers a manual override with a
  retry path when detection guesses wrong.
- **Translations are complete** — every `dataImport.*` key (138 of them)
  exists in both `en.json` and `ar.json`, including all 5 record types'
  field labels, even for the four not-yet-implemented adapters. No
  instance of the "Issue"-button-style missing-translation-key bug found
  anywhere in this feature.

## 3. Confirmed bugs and gaps, ranked by impact

### 3.1 — Silent data loss for any field value starting with `=` (confirmed, moderate)

**What:** Any CSV/XLSX cell whose value starts with `=` is silently
blanked to an empty string during parsing — before validation, before
the app's own formula-injection sanitizer ever runs.

**Root cause:** `parse-file.ts` uses `XLSX.read()`/`sheet_to_json()` (the
SheetJS library) for both CSV and XLSX ingestion. SheetJS interprets a
leading `=` as the start of a spreadsheet formula and evaluates/discards
it during parsing, regardless of whether it's valid formula syntax.
Confirmed directly:

```
"=1+1"                              → "" (blanked)
"=HYPERLINK(""http://evil.com"")"    → "" (blanked)
"=Not really a formula"             → "" (blanked, not a real formula)
"@SUM(1+1)"                         → "@SUM(1+1)" (preserved — @ is fine)
"-5% discount applied to phase 1"   → preserved (- is fine)
"+968 legacy reference code"        → preserved (+ is fine)
```

Only the `=` prefix triggers this; `@`, `+`, `-` prefixes (the other
three characters `sanitize.ts` was written to guard against) pass
through the parser untouched.

**Why it matters:** `lib/import/sanitize.ts` exists specifically to
neutralize formula-injection payloads (`=HYPERLINK(...)`, etc.) by
prefixing them with `'` so they survive as literal text. But for `=`,
this protection never gets a chance to run — the value is already gone
by the time `sanitizeRow()` receives it (confirmed: `sanitizeRow` was
called on a row where the `=1+1` field had already become `""`). The
intended attack is accidentally neutralized as a side effect of data
loss, not by the sanitizer working as designed — and legitimate data
that happens to start with `=` (rare, but not impossible — e.g. a
building description like "=100% occupancy achieved") would silently
disappear with no error, no warning, and a row that otherwise reports
success.

**Confidence:** Confirmed by direct testing against the real
`parseFile()` function (see reproduction commands in §4).

**Suggested fix (not implemented — audit only):** pre-scan raw cell
values for the four dangerous leading characters and apply the `'`
escape *before* handing the buffer to `XLSX.read()`, or parse CSV with a
plain-text CSV parser (not a spreadsheet-formula-aware one) and reserve
SheetJS only for genuine `.xlsx` binary files where formula evaluation
is unavoidable.

### 3.2 — "Re-import" button creates an orphaned job (confirmed, minor-moderate)

**What:** Clicking "Re-import" after a completed run with errors calls
`POST /api/import-jobs/[id]/reimport`, which correctly creates a new
job pre-seeded with the parent's ERROR rows and the same field mapping.
But `Step5Run.tsx`'s `handleReimport()` never reads the response body —
it only checks `res.ok`, then calls `onStartAnother()`, which resets the
wizard entirely back to "choose record type."

**Consequence:** The new reimport job exists in the database (and would
appear in `GET /api/import-jobs`'s history, if anything rendered that
list — see §3.3) but is unreachable from the UI. The user is dropped
back to step 1 with no way to resume into the job that was just created
for them. Functionally, "Re-import" and "Start Another" currently behave
identically from the user's point of view, except Re-import wastes a
server-side job row.

**Confidence:** Confirmed by reading `Step5Run.tsx` lines 96-103
directly — `fetch(...)` response is checked for `.ok` only, body is
never parsed.

### 3.3 — No job-history view; Undo has no UI entry point anywhere (confirmed, moderate)

**What:** `GET /api/import-jobs` (list up to 100 past jobs per org) is a
fully working endpoint, but nothing in the wizard or the Data Import
settings page renders it. There is no way to browse past imports, see
old error files, or view a prior job's outcome after leaving the wizard.

Separately, `POST /api/import-jobs/[id]/undo` (delete every record a job
created, correctly permission-gated and dependent-safe) has **zero UI
entry points** — no button anywhere in the wizard or settings page calls
it. It's a fully built, tested-safe capability that a user currently has
no way to trigger except by calling the API directly.

**Confidence:** Confirmed by grepping every file under
`components/dashboard/data-import/` and `app/dashboard/settings/data-import/`
for both `/import-jobs` (list) and `/undo` — no references outside the
API route files themselves.

### 3.4 — Step 3's Date Format option is inert for the only real adapter (confirmed, minor — fixed)

**What:** Step 3 (mapping) presented a live "Date format" control
(Auto/DMY/MDY) with no effect on a Buildings import — `BuildingRow` has
no date fields at all.

**Correction to the original finding:** the "Update" duplicate-handling
option, initially flagged alongside this, is **not** actually
undisclosed — `Step3Mapping.tsx` already shows
`duplicateHandlingHint` as helper text under that control:
*"Update existing" isn't available yet for this record type — duplicates
are skipped either way until it ships.* Re-checked directly against the
component before fixing anything; only the Date Format control had no
such disclosure.

**Fix applied:** the Date Format control is now hidden entirely when the
active adapter has no date-typed fields (`adapter.fields.some(f => f.type
=== "date")`), rather than shown with a caveat — so it will reappear
automatically once an adapter (e.g. Reservations) actually has date
fields to configure.

### 3.5 — `lib/import/value-parsers.ts` is entirely unused; the DMY/MDY ambiguity logic is unvalidated (confirmed, latent)

**What:** This module (date parsing with DMY/MDY disambiguation, OMR
decimal parsing per CLAUDE.md's no-float rule) is never imported
anywhere. `buildings.ts`'s only numeric field (`totalFloors`) is parsed
inline with a bare `Number()` call, not through this module.

**Why it matters — not today, but for whoever builds the next
adapter:** the module's "auto" date-format branch silently defaults to
DMY when both date parts are ≤12 (e.g. "01/02/2026") with no signal to
the caller that it guessed rather than parsed confidently. The module's
own comment acknowledges this risk. Since Reservations (a natural future
adapter) will need check-in/check-out date parsing, this ambiguity
should be resolved — either by always requiring an explicit format
choice rather than defaulting, or by surfacing ambiguous rows for manual
confirmation — before that adapter ships. The OMR/decimal parsing
(`parseOmrAmount`) itself looks well-built (rejects >3 decimal places
rather than rounding, matching the project's Decimal-only money rule)
but has never been exercised by a real code path.

**Confidence:** Confirmed unused via full-repo grep; the ambiguity logic
was read directly (not re-verified by execution, since it's unreachable
today).

### 3.6 — `rows/route.ts` exposes full raw row PII to any `dataImport:VIEW` user (minor, forward-looking)

For Buildings (name/address/floor count) this is low-risk. Once
Tenants/Reservations adapters exist (phone numbers, ID numbers), the
same route will serve that PII to anyone with `dataImport:VIEW` — worth
revisiting the permission granularity at that point, not before.

## 4. Live functional test — results

Ran the real pipeline functions (`parseFile`, `autoMapHeaders`,
`buildingsAdapter.parseRow/validateRow/createRow`) directly against the
isolated demo org `عبدالله وجدي — Demo` (id `a6aa98dc-...`), which had 2
pre-existing buildings before the test and correctly still has exactly
those 2 plus every row this test intentionally created afterward —
nothing outside the test's own writes was touched.

| Test case | Result |
|---|---|
| Valid English-header rows (name, type, city, governorate, address, floors, description) | ✅ Created correctly, all fields match input exactly |
| Missing required field (`name` blank) | ✅ Correctly rejected — `{field: "name", message: "required"}` |
| Invalid enum (`type: "SPACESHIP"`) | ✅ Correctly rejected — `invalid_enum:SPACESHIP` |
| Non-integer numeric field (`totalFloors: "2.5"`) | ✅ Correctly rejected — `not_a_whole_number` |
| Arabic headers (اسم المبنى، النوع، المدينة...) | ✅ Auto-mapped every column correctly, zero unmatched |
| Arabic cell values (برج الوصل، سكني، صلالة...) | ✅ Stored correctly, no mojibake, Arabic type alias "سكني" correctly resolved to `RESIDENTIAL` |
| Case-insensitive duplicate name detection | ✅ `"al-wasl tower"` correctly matched existing `"Al-Wasl Tower"`, skipped under `duplicateHandling: "skip"` |
| `duplicateHandling: "create"` override | ✅ Correctly bypassed the duplicate check and created a second row with the same name — confirms this option really does produce literal duplicates today (matches the "no update path yet" design, but worth the team knowing this is what "Create" actually does) |
| Empty file | ✅ Rejected — `EMPTY_FILE` |
| Header-only file (no data rows) | ✅ Parses cleanly to 0 rows, no error |
| CSV with embedded commas/quotes (`"Tower, Phase 2"`, `"Has ""premium"" units"`) | ✅ Correctly parsed/unescaped |
| Formula-injection payload, `=HYPERLINK(...)` | ⚠️ See §3.1 — silently blanked at parse time rather than sanitized as designed (accidentally safe, not correctly safe) |
| Benign values starting with `-`, `+`, `@` | ✅ Preserved correctly (only `=` triggers data loss) |

All writes were made through `buildingsAdapter.createRow()` (the same
path the real UI/API uses), so this test also re-confirms `createRow`'s
integration with `createPropertyCore` works end-to-end against a live
database, not just in isolation.

## 5. What I could not test

- **The wizard UI itself was not click-tested in a browser** — no
  browser automation tool was available in this environment. All UI
  findings (§3.2, §3.3, §3.4) come from direct code reading of the
  React components, not from observing rendered behavior. The
  functional pipeline test in §4 exercised the same engine functions the
  API routes call, but not the HTTP layer, the upload `<input>`, or any
  client-side interaction.
- **The `cancel` endpoint** and **large-file/near-5000-row behavior**
  were read but not executed.

## 6. Priority recommendation (original)

If picking one thing to fix first: **§3.1 (silent `=`-prefix data
loss)**. It's the only finding that can silently corrupt legitimate
data with no error shown to the user — everything else is a UX/UI gap
or a forward-looking concern for unbuilt adapters. §3.2 and §3.3 are the
next-most-user-visible (a receptionist who hits an import with errors
and tries to fix-and-retry currently can't do it the way the button
implies they can).

---

## 7. Fixes applied (2026-09-19)

All confirmed findings were fixed the following day. Summary — full
detail in the commit history (`fix(import): stop silent data loss on
"=" values, fix orphaned re-import`, then `feat(import): add job
history + Undo UI`).

### §3.1 — data loss on `=`-prefixed values
Fixed at the root: `lib/import/parse-file.ts` now reads CSV text with
`XLSX.read(text, { type: "string", raw: true })` — `raw: true` at the
**read** step (not the `sheet_to_json` extraction step, which still
uses `raw: false` for correct number/date display formatting; the two
are independent knobs) keeps every CSV cell as a literal string, so
`"=1+1"` and a full `HYPERLINK` payload both now survive parsing intact
and correctly reach `sanitizeRow()`, which does what it was always
supposed to do. Verified directly: the previously-blanked values now
round-trip correctly, and benign `-`/`+`/`@`-prefixed values (already
fine before) are unaffected.

**One thing the original report got wrong**, corrected during the fix:
I initially assumed a genuine `.xlsx` binary would hit this same bug,
"probably worse." Testing it directly showed otherwise — a formula cell
in a real `.xlsx` file only comes back blank if it has **no cached
value**, and Excel always writes a cached value alongside any formula
when it saves a file. A hand-constructed test `.xlsx` with an explicit
formula-with-cached-value cell parsed its value correctly; the only way
to produce a genuinely uncached formula cell was found to not survive
`XLSX.write()`'s own binary serialization in the first place. So the
XLSX path was not actually at risk in practice — added `hasFormulaCells`
detection and a Step 3 warning banner as defensive infrastructure
regardless, since it's cheap and correct for the edge case, but it is
expected to rarely if ever fire for real-world Excel-produced files.

### §3.2 — orphaned Re-import job
Fixed: `Step5Run.tsx` now reads the reimport endpoint's response body
and calls a new `onReimport(newJobId)` callback; `DataImportWizard.tsx`
jumps straight into that job's upload step instead of resetting to
"choose". Confirmed the server always re-derives `fieldMapping` from
whatever file gets uploaded next regardless of what was pre-seeded, so
no wizard-level state was being skipped by taking this shortcut.

### §3.3 — no job-history view, Undo unreachable
Built: `components/dashboard/data-import/JobHistory.tsx`, rendered
below the wizard on the Data Import settings page. Lists past jobs with
status, counts, download-errors, re-import, and Undo (full confirm +
partial-undo-blocked messaging) — using translation strings that had
already been written for this exact feature (`dataImport.history.*`,
`dataImport.undo.*` in both `en.json`/`ar.json`) but were never wired to
any component. Re-import from this view is a full-page navigation
(`?resumeJobId=`), resolved org-scoped server-side in
`page.tsx`, since the history table lives outside the wizard's
in-memory state.

**Verified end-to-end** against the isolated demo org: ran a full job
lifecycle (create → upload → validate → run) through the real engine
functions, producing 1 created building + 1 rejected row; confirmed the
history-list query returns exactly what the UI renders; confirmed
Undo's preview endpoint reported the correct eligible count, the delete
endpoint removed the created building, and re-querying the database
confirmed it was actually gone. Deleted the test job afterward and
confirmed the demo org returned to its exact original state (0 import
jobs, its original 2 buildings).

### §3.4 — Date Format control shown for an adapter with no date fields
Fixed: hidden via `adapter.fields.some(f => f.type === "date")` rather
than given more disclaimer text — Buildings has no date fields, so the
control now simply doesn't render for it, and will reappear
automatically for a future adapter that has real date fields to
configure. (Also corrected the original finding: the "Update"
duplicate-handling option, initially grouped with this issue, already
had disclosure text and did not need a fix — see §3.4 above.)

### Not changed
§3.5 (`value-parsers.ts` unused) and §3.6 (row PII exposure scoped to
`dataImport:VIEW`) remain as documented, forward-looking notes for
whoever builds the next adapter (most likely Reservations, which will
need real date parsing) — neither is an active bug against the
Buildings adapter that exists today.
