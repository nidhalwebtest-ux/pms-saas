# 🏢 Salalah PMS — Complete Feature List

*Multi-tenant Property Management System built for Oman (OMR currency, Khareef season, Arabic/English bilingual, VAT-ready)*

> **Purpose of this document:** A plain-language inventory of every feature in the product, organized by module, with the business problem each one solves. Use it as the foundation for building a sales strategy, demo script, pitch deck, or website copy.

---

## 1. Properties & Units

**Problem it solves:** Property managers track buildings and units across spreadsheets and memory — no single source of truth.

- **Buildings management** — Add/edit all your properties with photos and details
- **Units/Rooms management** — Every unit with its own status (Vacant, Occupied, Reserved, Maintenance) shown at a glance
- **Bulk add units** — Set up a whole building of rooms in one go (great for onboarding new clients fast)
- **Seasonal pricing** — Each unit has a default rate, plus override rates for specific date ranges (e.g. Khareef Jul–Aug pricing) — automatically applied when a stay crosses seasons
- **Unit availability view** — See when each unit is free or booked

## 2. Tenants / Guests (CRM)

**Problem it solves:** No record of who stayed, who pays late, or who to avoid.

- **Tenant directory** — Full guest/tenant profiles with national ID and Oman-specific fields
- **Duplicate detection** — Warns before creating the same tenant twice
- **Blacklist / internal notes** — Flag problem tenants with warning banners
- **Tenant ledger** — Complete financial history per tenant (what they owe, what they paid), exportable to **PDF and Excel**
- **Cross-tenant ledger view** — See all balances across all tenants in one place

## 3. Reservations (the core)

**Problem it solves:** Double-bookings, manual availability checks, lost booking details.

- **Booking engine with availability calendar** — Visual calendar prevents double-booking automatically
- **Multi-unit reservations** — One booking can include several units
- **Smart pricing calculation** — Auto-calculates totals including seasonal rate changes mid-stay
- **Full reservation lifecycle:**
  - **Check-In** (with unit/date changes + payment collection)
  - **Check-Out** (handles early and late checkout, overstay charges)
  - **Extend Stay** (with live cost preview + availability re-check)
  - **Move Unit** (swap rooms with rate-difference handling)
  - **Cancel / No-Show** (with reason tracking)
- **Smart status display** — Auto-shows "Arriving Today," "In House," "Due Checkout," "Overstay," "Overdue," etc. — receptionist always knows what needs action
- **Activity timeline** — Every action logged per reservation
- **Printable reservation document** (bilingual PDF)

## 4. Invoicing

**Problem it solves:** Manual invoicing errors, no clear record of what's been billed.

- **Generate invoices on demand** — One click from a confirmed reservation
- **Short-term stays** → one invoice for the whole stay
- **Long-term/monthly stays** → one invoice per billing cycle, automatically following the check-in day
- **Draft vs. Issued flow** — Future months pre-created as drafts; receptionist "Issues" them when due (revenue only posts when issued)
- **Clear statuses** — Draft, Pending, Partially Paid, Paid, Returned, Cancelled
- **Editable line items** before issuing
- **Bilingual invoice PDF** with company branding

## 5. Payments

**Problem it solves:** Untracked cash, unclear which invoice a payment covers.

- **Record payments** — Cash, Card, Bank Transfer, Cheque
- **Allocation across invoices** — Auto (oldest first) or manual (choose which invoices to pay)
- **Partial payments** supported
- **Payment receipt PDF** — Professional bilingual receipts
- **Overpayment policy control** — Block, warn, or allow payments above the balance

## 6. Returns / Refunds

**Problem it solves:** Refunds that corrupt your financial records.

- **Credit-note model** — Returns never alter the original invoice (clean audit trail)
- **Refund processing** with downloadable PDF
- **Configurable return policies** (draft handling, net/gross balance, rate basis)

## 7. Expenses

**Problem it solves:** Petty cash chaos, no approval control.

- **Submit expenses with receipt photos** (receptionist)
- **Approval workflow** — Manager approves/rejects/processes; bulk-approve supported
- **Categories** — Cleaning, Maintenance, Supplies, Utilities, Transportation, Food, Other (customizable)
- **Expense PDF** export

## 8. Cashier & Banking 💰

**Problem it solves:** End-of-day cash reconciliation done by hand; no bank tracking.

- **Daily cashier daybook** — Opening balance, cash in, cash out, closing balance, non-cash collected — per building
- **Reconcile & lock** the day's drawer
- **Multi-bank accounts** — Track multiple bank accounts
- **Bank deposits** — Record cash deposits to the bank
- **Bank statement view + PDF export**
- **Bank reconciliation/matching board** — Match your records against the actual bank statement
- **Adjustments** page for corrections

## 9. Reports & Analytics 📊

**Problem it solves:** No visibility into business performance; owners fly blind.

**23 reports** across 5 categories, all with date presets (incl. a dedicated **Khareef season** preset) and **Excel export**:

- **Revenue (6):** by Building, by Tenant, by Unit Type, by Source, Trend over time, Period Comparison
- **Occupancy (5):** by Building, Trend, Vacancy Analysis, Avg. Length of Stay, **Khareef Performance**
- **Financial (5):** Aging Receivables, Outstanding Balances, Cash Flow, **P&L by Building**, Expense Breakdown
- **Operational (6):** Receptionist Performance, Tenant Reports, Maintenance, Booking Sources, Cancellation Analysis, **Target vs Actual**
- **Tax & Compliance (3):** VAT Summary, Revenue by Month, Annual Summary

## 10. Sales Targets & Performance 🎯

**Problem it solves:** No way to set and track team goals.

- Set targets per **receptionist, building, or unit** — **weekly or monthly**
- **Target vs Actual report** compares goals against real net revenue automatically

## 11. Dashboards

**Problem it solves:** Different roles need different information.

- **Role-aware home screen** — separate **Today**, **Receptionist**, and **Manager** views
- KPIs: revenue, occupancy, today's arrivals/departures, pending actions

## 12. Team, Roles & Security 🔐

**Problem it solves:** Everyone shares one login; no control over who sees/does what.

- **Staff accounts** — Invite team by email, assign roles
- **Building-level scoping** — Restrict a staff member to specific properties only
- **Enterprise-grade permissions (RBAC)** — NetSuite-style matrix with 5 levels (None → View → Create → Edit → Full) across every list, transaction, action, report, and setting
- **4 ready-made roles** — Owner, Manager, Receptionist, Accountant — plus custom roles
- **Auto-logout** on inactivity (security)

## 13. Localization & Branding 🌍

**Problem it solves:** Generic English-only software doesn't fit the Omani market.

- **Full Arabic/English bilingual** with RTL support
- **Branded documents** — Your logo, brand color, bilingual footer on every PDF
- **Multi-currency** (OMR default; USD, AED, SAR, etc.)
- **OMR-correct money handling** (3 decimal places / baisa — no rounding errors)

## 14. Property Selector (global)

- A building filter in the sidebar that instantly filters **all** data to one property — essential for multi-building managers

---

## 🎁 Bonus — Internal Sales CRM (founder-only)

A separate admin module to manage *your own* sales process while selling this product:

- Prospect pipeline (Not Contacted → Visited → Demo Done → Interested → Signed → Active / Lost)
- Map-based prospect tracking, lead scoring, visit logging, follow-up queue with WhatsApp links

*(This is for the founder/sales team, not a customer-facing feature — but it's purpose-built for organizing the lead visits you're starting now.)*

---

## 📌 Suggested next inputs for the sales strategy

To turn this feature list into a strong strategy, add:

1. **Target customer segments** — e.g. boutique hotels vs. apartment landlords vs. property management firms
2. **Pricing model** — per unit / per building / flat monthly / tiers
3. **Top 3 competitors in Oman** — and how you differ
4. **Top 3 pain points** you hear from leads during visits (so the pitch leads with those)
