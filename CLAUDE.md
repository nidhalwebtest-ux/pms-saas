# Salalah PMS — Project Context

## Product
Cloud-based Property Management System (PMS) SaaS targeting property management 
companies in Salalah, Oman. Handles short-term rentals (especially Khareef season 
June-September) and long-term monthly rentals.

## Tech Stack
- Frontend: Next.js 14, Tailwind CSS
- Backend: Next.js API routes
- Database: Supabase PostgreSQL with Prisma ORM
- Auth: Supabase Authentification
- File Supabase Storage
- PDF Generation: React-PDF
- Email: Resend
- Hosting: Vercel

## Architecture Rules
- Multi-tenancy: every table has company_id column. Every query filters by company_id 
  from JWT token. A user from Company A must NEVER see Company B's data.
- Currency: OMR (Omani Rial), always 3 decimal places (1 OMR = 1000 baisa). 
  NEVER use floating point for money — use Decimal library or integer baisa.
- Language: Arabic/English bilingual. Full RTL support. All UI labels translatable.
- API pattern: REST. All endpoints require authentication. Response format:
  { success: true, data: {...} } or { success: false, error: "message" }
- Database: UUID primary keys. created_at/updated_at timestamps on every table.
  Soft delete where appropriate (is_active flag or status = cancelled).

## Key Business Rules

### Reservations
- A reservation can have multiple units (reservation_units table)
- Stored statuses: confirmed, checked_in, checked_out, cancelled, no_show
- Calculated display statuses (never stored): Upcoming, Arriving Today, Overdue Arrival,
  In House, Due Checkout, Overstay, Checked Out, Cancelled, No Show
- Double booking prevention with row-level locking
- Check-in updates unit status to "occupied"
- Check-out updates unit status to "vacant"

### Pricing
- Each unit has a default price (daily_rate, monthly_rate)
- Seasonal prices override default for specific date ranges (e.g., Khareef: Jul 1-Aug 31)
- When a stay spans seasonal boundaries, calculate each segment separately
- Pricing utility functions: getUnitPriceForDate(), getUnitPriceForRange(), calculateUnitTotal()

### Invoicing
- Invoices created ONLY when user clicks "Generate Invoices" on a confirmed reservation
- Short-term stays (daily, ≤30 nights): ONE invoice for entire stay
- Long-term stays (monthly): ONE invoice per billing cycle. Billing cycle follows 
  check-in day (check-in on 15th = billing 15th to 15th each month)
- Invoice statuses: DRAFT, PENDING, PARTIALLY_PAID, PAID, RETURNED, CANCELLED
- DRAFT = monthly cycle pre-created but not yet issued (no revenue posted, waiting for receptionist to click "Issue")
- Issuing a DRAFT sets status=PENDING and stamps issueDate=now() (revenue posts on issueDate)
- For monthly stays: the first cycle (current period) is auto-issued at generation; future cycles are created as DRAFT
- Overdue is calculated (PENDING, PARTIALLY_PAID, or legacy ISSUED with due_date < today), never stored
- Issued invoices are immutable — cancel and recreate to fix mistakes
- Cancelled invoices excluded from ALL financial calculations
- Early checkout: current billing period NOT prorated (full month charged), future invoices cancelled
- Overstay: separate invoice created, existing invoices never modified

### Payments
- Payments linked to invoices through payment_allocations table
- Auto-allocation: oldest invoice first
- Manual allocation: receptionist chooses which invoices to pay
- Payment methods: Cash, Card, Bank Transfer, Cheque
- Reservation cancellation & invoices:
  - Block cancel if ANY invoice has recorded payments (PAID / PARTIALLY_PAID) — those must be
    cancelled/refunded manually first
  - Otherwise auto-cancel all unpaid invoices (DRAFT / PENDING / DUE / ISSUED) as part of the
    cancellation, free the units, and flag refundPending if a payment existed

### Expenses
- Receptionist submits expense with receipt photo
- Manager approves or rejects
- Categories: Cleaning, Maintenance, Supplies, Utilities, Transportation, Food, Other

## UI/UX Conventions
- Primary user is the Receptionist (uses system 8 hours/day)
- Property selector in sidebar filters ALL data by selected building
- List pages have: quick filter tabs with counts, search bar, sortable table, action buttons
- Forms have: collapsible sections, inline validation, loading states
- Status badges use consistent colors across all pages:
  Green = positive (Paid, Vacant, In House)
  Orange = attention needed (Arriving Today, Due Checkout, Partially Paid)
  Red = urgent (Overstay, Overdue)
  Gray = inactive (Cancelled, Checked Out)
- Success/error toast notifications for all actions
- All PDFs are bilingual Arabic/English with company branding
- Responsive: desktop primary, mobile for manager workflows
- Match existing component patterns — check similar pages before building new ones

## Database Tables (current)
- companies, users, buildings, units, unit_prices
- tenants, tenant_notes
- reservations, reservation_units, reservation_activities
- invoices, invoice_line_items
- payments, payment_allocations
- expenses

## What's Built (completed)
- Auth: registration, login, roles (Admin/Receptionist/Accountant), company onboarding
- Buildings: CRUD, list with filters, building summary cards
- Units: CRUD, list with filters, unit details page, pricing with seasonal rates, photos
- Tenants: CRUD with CRM fields, search, duplicate detection, quick-add mode
- Reservations: create with multi-unit, availability checking, seasonal pricing calculation
- Reservation statuses: stored + calculated display statuses
- Reservation list: filter tabs, search, action buttons, status badges
- Reservation details: guest info, stay details, units, financial summary, activity timeline
- Check-in: pre-check-in modal with unit/date changes, payment collection
- Check-out: early/late handling, overstay charges, balance warning
- Extend stay: date extension with availability check, pricing recalculation
- Move unit: unit swap with rate difference handling
- Cancel/No-show: with reason tracking
- Availability calendar: split-day visualization, gap detection, building filters
- Dashboard: Today's view, Receptionist view, Manager view with KPIs
- Invoicing: partially implemented (needs adjustments — see current sprint)
- Property selector: global filter in sidebar

## What's Remaining (current sprint — due April 30)
- Invoice adjustments: "Generate Invoices" button, breakdown in reservation page, 
  simplified statuses (PENDING, PARTIALLY_PAID, PAID, RETURNED, CANCELLED)
- Payment recording linked to invoices with allocation
- Payment receipt PDF generation
- Expense management completion (submission, approval workflow, processing)
- Daily cashier reconciliation
- Reports: revenue, occupancy, expenses, aging receivables
- Arabic language pass (verify all pages)
- Responsive design pass (verify mobile)
- Bug fixes and polish
- Demo data seeder
