# Binaya PMS — Roadmap (from 19 Nov 2026)

We build one item at a time, top to bottom. Each item goes through the same steps: plan, build, check (tsc + build + both languages + mobile), push to Preview, then promote to production.

Update the **Status** column when an item starts or finishes.

> **Before item 1:** commit or stash the website theme work that isn't committed yet (`lib/public-site/theme.ts` + 8 public-site files) so it doesn't get lost while we work on other things. We finish it in item 10.

## Overview

| #  | Feature                                   | Phase              | Size | Status  |
|----|-------------------------------------------|--------------------|------|---------|
| 1  | Performance audit & speed-up              | 1 · Foundation     | M    | Done (2 rounds — docs/perf/; live dashboard timing pending a login) |
| 2  | Simplify the landing page                 | 1 · Foundation     | S    | Done (14 → 8 screens; tabs instead of scroll story) |
| 3  | Test WhatsApp with a real number          | 1 · Foundation     | S    | Todo    |
| 4  | Subscriptions, plans & free trial         | 2 · Revenue        | L    | Todo    |
| 5  | Bank gateway: payment links               | 2 · Revenue        | L    | Todo    |
| 6  | Pricing Management module                 | 2 · Revenue        | M    | Todo    |
| 7  | Better transaction PDFs                   | 3 · Core polish    | M    | Todo    |
| 8  | Better data migration (CSV import)        | 3 · Core polish    | M    | Todo    |
| 9  | Merge duplicate tenants                   | 3 · Core polish    | M    | Todo    |
| 10 | Professional website themes               | 4 · Growth         | L    | Todo    |
| 11 | Blog articles for SEO                     | 4 · Growth         | M    | Todo    |
| 12 | Better demo tour                          | 4 · Growth         | S    | Todo    |
| 13 | Task Management module                    | 5 · New modules    | L    | Todo    |
| 14 | Documents & file storage (Google Drive)   | 5 · New modules    | L    | Todo    |
| 15 | AI Assistant                              | 5 · New modules    | L    | Todo    |
| 16 | Google booking integration                | 6 · Big bets       | XL   | Todo    |
| 17 | Mobile app                                | 6 · Big bets       | XL   | Todo    |

S = 1–2 days · M = 3–5 days · L = 1–2 weeks · XL = several weeks plus outside approvals

**Why this order**
- **Phase 1** makes the app fast before we add more to it, gives visitors a clearer landing page, and removes doubt about WhatsApp working in production.
- **Phase 2** lets Binaya earn money. Payment links come right after subscriptions because the same gateway can later collect subscription payments too.
- **Phase 3** improves what receptionists use every day.
- **Phase 4** brings in more customers.
- **Phase 5** adds new modules.
- **Phase 6** depends on outside parties (Google, the app stores). The paperwork for those should start early, in parallel with the other work (see item 16).

---

## Phase 1 — Foundation

### 1. Performance audit & speed-up
- **What already exists:** Next 16 with Turbopack, Prisma using the Supabase pooler, and `scripts/shot.mjs` (puppeteer) for headless page visits.
- **Scope**
  - Measure first: timing for page load, server render, and DB query on the 15 most-used pages and the main actions (create reservation, check-in, record payment, generate invoices).
  - Profile the queries: log slow queries from Prisma, look for N+1 patterns, add missing indexes, use `select` instead of fetching full rows.
  - Shrink what the browser downloads: run a bundle analyzer, and stop sending all app translations (about 220KB) on pages that don't need them, starting with the public sites.
  - Make navigation feel faster: add `loading.tsx` or Suspense where it's missing, and cache data that rarely changes (settings, building lists).
  - Add a repeatable speed script with before/after numbers saved to `docs/perf/`.
- **Finished when:** we have a table of every key page and action before and after, and nothing is slower than its target (to agree, e.g. pages under 1.5s TTFB on Vercel).

### 2. Simplify the landing page
- **What already exists:** `app/page.tsx` with these sections: Hero, Pain, Bridge, Solution, Strip, PricingStory, FAQ, EndCard, plus the floating WhatsApp button. `app/marketing-lab/` also exists.
- **Scope:** go through each section with you and decide to keep, merge, or cut it. Aim for about 5 sections: Hero, Solution, Pricing, FAQ, CTA. Remove unused marketing components and the experimental pages. Keep the Meta Pixel and SEO metadata.
- **Finished when:** the page is shorter, scores 90 or more in Lighthouse on mobile, and no unused marketing code is left.

### 3. Test WhatsApp with a real number
- **What already exists:** `lib/whatsapp/*` (Graph API, webhook, templates, sending messages for documents) and Settings → WhatsApp.
- **Scope:** connect a real Business number, get the starter templates (Arabic and English) approved by Meta, send a reservation confirmation, an invoice, and a receipt, then check that delivered and read updates come back through the webhook in production. Fix whatever breaks. Write a short setup guide for customers.
- **Waiting on you:** a Meta Business account and a phone number that isn't already registered on WhatsApp.

## Phase 2 — Revenue

### 4. Subscriptions, plans & free trial
- **What already exists:** the pricing bands in `lib/saas-pricing.ts` (first 5 units free, then paid bands), the fields `Organization.plan`, `maxProperties` and `subscriptionStatus` (plain strings for now), and the super-admin area `app/(admin)/admin/organizations`.
- **Scope**
  - Database: a `SubscriptionPlan` table (name, limits, price bands, which features it includes), plus new fields on `Organization`: `planId`, `trialEndsAt`, `currentPeriodEnd`, and a status that can only be `TRIALING / ACTIVE / PAST_DUE / CANCELLED`.
  - Trial: a new organization automatically gets a trial of N days (set by the admin). When the trial ends, it drops to the free plan or becomes read-only, depending on an admin setting.
  - Limits enforced on the server in one shared function (`assertWithinPlan()`): number of units and buildings, and which features each plan allows (website, WhatsApp, reports...).
  - Super-admin pages: create and edit plans, assign or change an organization's plan, extend a trial, and see a subscription history for each organization.
  - Inside the app: a banner showing days left in the trial, a "Billing & Plan" page in Settings, and an upgrade screen when a limit is reached.
- **Decide before building:** what happens when the trial expires (free plan or read-only), how long the trial lasts, and whether card payment is in scope now or after item 5.

### 5. Bank gateway: payment links
- **Scope**
  - A provider layer (`lib/payments/gateway/`) so the bank or provider can be swapped later.
  - "Send payment link" on an invoice and on a reservation deposit. The link is shared through the existing Share modal and WhatsApp.
  - When the provider confirms payment (webhook), a `Payment` is created automatically (method ONLINE, linked to the bank account) and allocated to the invoice. Duplicate notifications must never create a second payment.
  - Settings: gateway credentials per organization (encrypted), and a test/live switch.
  - A page listing payment links with their status (sent, paid, expired).
- **Decide before building:** which provider: Thawani, Amwal Pay, Bank Muscat SmartPay, or Paymob Oman. We need its documentation and test (sandbox) access.

### 6. Pricing Management module
- **What already exists:** the `UnitPrice` table (default and seasonal prices), the pricing functions (`getUnitPriceForRange`), and Settings → Units.
- **Scope, as I understood it (please confirm):** one central "Pricing" page for **unit rates**:
  - Rate calendar per unit or unit type.
  - Edit prices for many units at once.
  - Season templates (Khareef, Eid) that can be copied from year to year.
  - Weekend and weekday prices.
  - Minimum stay.
  - Discounts for longer stays.
  - A preview of the price before saving.
- (If you meant **SaaS plan prices** instead, that's covered in item 4.)

## Phase 3 — Core polish

### 7. Better transaction PDFs
- **What already exists:** HTML → headless Chromium PDFs for invoices, receipts, reservations, returns, expenses, bank statements, and the tenant ledger (`lib/pdf/`).
- **Scope**
  - One shared layout for all PDFs: header with logo, Arabic and English text side by side, QR code linking to the shared document, totals block, stamp and signature area, and a VAT-ready format.
  - Settings for the document footer and terms per document type.
  - Download the Chromium package from our own storage instead of the GitHub release.
  - Test the PDFs visually in both languages.

### 8. Better data migration (CSV import)
- **What already exists:** `lib/import/*` (adapters for buildings, units, tenants, reservations and expenses; automatic column matching; encoding detection; a downloadable errors file) and Settings → Data import.
- **Scope**
  - A guided wizard: upload, match columns, preview, check, import.
  - Remember column matchings so they can be reused.
  - Templates for common competitor exports.
  - Detect duplicates during the import.
  - Import payments and opening balances.
  - Undo a whole import batch (rollback).
  - Show progress for large files.

### 9. Merge duplicate tenants
- **What already exists:** duplicate detection when creating a tenant (`app/dashboard/tenants/actions.ts`).
- **Scope**
  - A "Possible duplicates" view that groups tenants by phone, ID number, or similar name.
  - A merge screen to pick the record to keep and choose field by field.
  - All reservations, invoices, payments, notes and documents move to the kept tenant inside one transaction. The other record is soft-deleted, and the merge is logged in the history.
  - Only managers can merge.

## Phase 4 — Growth

### 10. Professional website themes
- **What already exists:** a public website for each organization, the "Coastal" template (redesigned), the setup wizard, and a booking-request inbox. Template 2 "Classic" and Template 3 "Modern" have only started (design settings that aren't committed yet).
- **Scope**
  - Finish Classic and Modern with their own layouts, not just different colors.
  - More sections: reviews, gallery, map, policies, and a page per season.
  - A section editor (show or hide and reorder sections).
  - Font and color presets.
  - Better SEO: structured data (schema.org LodgingBusiness), Open Graph images, and the sitemap.
  - A custom domain per organization.
  - A preview step before publishing.

### 11. Blog articles for SEO
- **Scope**
  - A blog at `/blog` on the landing site in Arabic and English.
  - Articles as MDX files in the repo (simplest) or a database table edited from super-admin (decide).
  - Article list, categories, structured data, sitemap, RSS, and Open Graph images.
  - 5 starter articles on topics like Khareef rentals, Omani VAT, and switching away from Excel.

### 12. Better demo tour
- **What already exists:** `components/dashboard/tour/*` (TourOverlay, AutoStartTour), demo organizations (`isDemo`), the DemoBanner, and the demo WhatsApp button.
- **Scope**
  - Shorter step-by-step tours by task (make a booking, check in, get paid).
  - A checklist of progress.
  - Tour steps match the current design.
  - Track where visitors drop out of the tour.
  - Rewrite the tour text in both languages.

## Phase 5 — New modules

### 13. Task Management module
- **Scope**
  - A `Task` table: title, type (cleaning, maintenance, inspection, other), unit or building, assigned person, due date, priority, and status.
  - Tasks created automatically: cleaning after check-out, and inspection before check-in.
  - A board view, a list view, and "My tasks" for staff on mobile.
  - Link a task to an expense (for maintenance).
  - Permissions (RBAC) for tasks, and a dashboard widget.

### 14. Documents & file storage (Google Drive)
- **Scope**
  - A `Document` table linked to a tenant, reservation, unit or expense: ID copies, contracts, photos, with a type and an expiry date (with alerts).
  - Files stored in Supabase Storage by default.
  - Optional per-organization Google Drive connection (Google sign-in) that mirrors files into a folder tree like `Binaya/<Building>/<Tenant>`.
  - A document list on each related page.
- **Waiting on you:** a Google Cloud project and approval of the consent screen (Drive access needs Google's review).

### 15. AI Assistant
- **Scope**
  - A chat panel in the dashboard using Claude.
  - Answers are limited to the organization's own data, through read-only tools (availability, balances, today's arrivals, report numbers).
  - Can draft messages and invoice notes.
  - Any action (create a reservation, record a payment) needs an explicit confirmation from the user.
  - Arabic and English.
  - Usage limits per plan (ties into item 4).

## Phase 6 — Big bets (start the outside paperwork early)

### 16. Google booking integration
- **What it involves:** Google Hotel Center or Vacation Rentals connectivity. Google requires an approved connectivity partner or a direct partner application.
- **Scope**
  - Do the research and apply first (this can start now, in parallel).
  - Then build the data feeds:
    - property and listing feed
    - availability and prices (ARI) feed
    - a booking link back to the organization's website (item 10)
- **Risk:** Google may not approve, or approval may take months. Bookings going through a channel manager is a possible fallback.

### 17. Mobile app
- **Decide before building:** first make an installable web app (PWA) with push notifications (fast, uses the existing code), then possibly an Expo React Native app for the manager and staff workflows (tasks, approvals, check-in).
- **Scope:** focus on managers and staff: today's view, approving expenses, tasks (item 13), quick check-in and check-out, payment links (item 5).
- **Waiting on you:** Apple Developer and Google Play accounts.

---

## Decisions to make before each item
- **#4:** what happens after the trial (free plan or read-only), trial length, and whether paid subscriptions use the gateway from #5.
- **#5:** which payment provider, plus sandbox access.
- **#6:** confirm it means unit and rate pricing.
- **#11:** MDX files or articles managed from admin.
- **#17:** PWA first, or go straight to a native app.
