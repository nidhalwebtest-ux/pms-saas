# WhatsApp Business Cloud API integration — plan (for approval)

**Goal:** each Binaya customer (organization) connects **its own WhatsApp Business number** and manages **message templates** from Settings. Staff then send reservation, invoice and receipt messages through the official API instead of `wa.me` links.

## What exists today
- **`utils/whatsapp.ts`:** builds `wa.me` click-to-chat links. It normalizes numbers to Oman (968) by default.
- **`components/dashboard/ShareButton.tsx` + `POST /api/share/mint`:** builds a share link and a bilingual message for invoice, receipt, reservation, return and ledger, then opens `wa.me`.
- **Tenants:** have `phone` and `whatsappNumber`.
- **No server-side WhatsApp sending:** there are no webhooks and no encryption helper for third-party secrets.
- **Settings:** each page has its own RBAC setup key, and the Settings parent shows when any of them is visible (`lib/rbac.ts`).

## How WhatsApp Cloud API works (constraints that shape the design)
- **One WABA per customer:** each customer needs a **WhatsApp Business Account (WABA)** with a phone number registered on the Cloud API. Messages are billed by Meta **to the WABA owner, the customer**, not to Binaya.
- **Templates for business-initiated messages:** these (confirmations, reminders, invoices) must use **pre-approved templates**. Meta reviews each template, usually within minutes but sometimes hours, as UTILITY, MARKETING or AUTHENTICATION.
  - Free-form text is allowed only inside the **24-hour window** after the guest messages the business.
- **Template format:** names are lowercase with underscores. There is one template per language (we'd create `ar` + `en`). Variables are `{{1}}`, `{{2}}`, … and **sample values are required** at submission.
- **Delivery and approval updates arrive by webhook:** one endpoint for the whole Binaya app. It is routed to the right organization by `phone_number_id` / WABA id, and verified with the app secret (`X-Hub-Signature-256`).

## Decision 1: how customers connect their number

| | **A. Embedded Signup (recommended for the product)** | **B. Manual credentials (fastest to ship)** |
|---|---|---|
| Customer experience | Click «ربط واتساب» → Meta popup → pick or create the business, WABA and number → done | Paste WABA ID, Phone-number ID and a permanent System-User token from Meta Business Manager |
| What Binaya must do first | Create a Meta developer app, complete **Business Verification**, pass **App Review** (`whatsapp_business_management`, `whatsapp_business_messaging`) and become a **Tech Provider**. That takes days to weeks and needs Binaya's company documents. | Nothing from Meta. Only one Meta app is needed for the webhook. |
| Fit for receptionists and owners | Good: no technical steps | Poor: needs a technical person per customer |

**Recommendation:** build with a connection layer that supports **both**.
1. Ship **B** first, so you can test with your own number and early customers right away.
2. Switch the default to **A** once Binaya's Meta Tech Provider approval lands. The rest of the feature (templates, sending, webhooks) is identical either way.

## Decision 2: MVP scope
**Phase 1 (proposed MVP)**
1. **Settings → WhatsApp («واتساب للأعمال»)**, with a new RBAC key `settingsWhatsapp` (OWNER and MANAGER by default):
   - **Connection card:** status, display number, verified name, quality rating, «اختبار الإرسال» (send test), «فصل» (disconnect).
   - **Templates:** list with status badges (approved = green, pending = orange, rejected = red with Meta's reason), «مزامنة» (sync from Meta), create, duplicate and delete.
   - **Template editor:** name, category, language (Arabic or English, or both), header, body, footer and buttons (URL or quick reply), with a live WhatsApp-style preview in RTL.
     - **Variables are picked from PMS fields** instead of typing `{{1}}`: guest name, reservation number, unit, check-in, check-out, nights, amount due, invoice number, document link, organization name.
     - Sample values are filled automatically for Meta review.
   - **Starter templates:** one-click Arabic + English versions of «تأكيد الحجز», «الفاتورة», «إيصال الدفع» and «تذكير بالوصول», all UTILITY.
2. **Sending:**
   - When the org is connected, the existing **Share → WhatsApp** action on reservation, invoice and receipt sends through the API using the matching approved template. Otherwise it falls back to `wa.me`, as today.
   - Staff see a confirmation toast, and the message status (sent → delivered → read, or failed with a reason) appears in the record's activity timeline.
3. **Webhook `/api/whatsapp/webhook`:**
   - verification handshake,
   - signature check,
   - message status updates,
   - template status updates (approved or rejected),
   - phone-quality and account updates.

   Inbound guest messages are stored but there is **no inbox UI** in Phase 1.

**Phase 2 (later)**
- **Embedded Signup** (option A).
- **Automatic sends** from a scheduled job:
  - confirmation on booking,
  - check-in reminder the day before,
  - overdue-invoice reminders,

  each with per-org on/off toggles and quiet hours.
- **Inbox:** reply to guests inside the 24-hour window.
- **Usage report:** messages sent per category and estimated Meta cost.

## Data model (new tables; every row carries `organizationId` per the multi-tenancy rule)
- **`WhatsAppAccount`** (one per org): `wabaId`, `phoneNumberId`, `displayPhone`, `verifiedName`, `accessTokenEnc` (**AES-256-GCM encrypted**, key in env `WHATSAPP_TOKEN_KEY`), `connectionType` (MANUAL | EMBEDDED), `status`, `qualityRating`, `webhookSubscribedAt`, `connectedById`, timestamps.
- **`WhatsAppTemplate`:** `metaTemplateId`, `name`, `language`, `category`, `status`, `rejectedReason`, `components` (JSON), `variableMap` (JSON: `{{1}}` → PMS field), `purpose` (RESERVATION_CONFIRMATION | INVOICE | RECEIPT | ARRIVAL_REMINDER | CUSTOM), timestamps.
- **`WhatsAppMessage`:** `templateId?`, `toPhone`, `waMessageId`, `direction` (OUT | IN), `status`, `errorCode` / `errorMessage`, `entityType` / `entityId` (reservation, invoice, payment…), `sentById`, timestamps.

**Security:**
- Tokens are never sent to the browser.
- Every server action checks the org from the session.
- The webhook verifies Meta's signature, and its handler only ever touches the org that owns the `phone_number_id`.

## Environment and Meta setup (one-time, Binaya side)
- **Meta app:** a Meta developer app (Business type) with the WhatsApp product, giving `META_APP_ID` and `META_APP_SECRET`.
- **Webhook:** pointed at `https://binaya.app/api/whatsapp/webhook`, with `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
- **Encryption key:** `WHATSAPP_TOKEN_KEY`, 32 random bytes, kept in Vercel env and never in the repo.
- **Graph API version:** pinned in one constant (`WHATSAPP_GRAPH_VERSION`).
- **Local testing:** the webhook needs a public URL, so use a tunnel or a Vercel preview.

## Database changes: needs your OK
This repo has **no dev database and no migrations**. Schema changes are applied with `prisma db push` to the **production** Supabase database. The three new tables are **additive only**: no existing table or column changes. Please confirm how you want them applied:
- me running `prisma db push` when we get there, or
- you applying them, or
- us setting up a separate dev or branch database first (recommended).

## Build order (Phase 1)
1. Encryption helper + Graph API client (`lib/whatsapp/`), with typed calls for templates, messages and phone number info, plus unit tests with mocked HTTP.
2. Prisma models (after your OK on the database question).
3. Settings page: connection card (manual connect, test send, disconnect).
4. Template list, sync and editor with PMS-field variables, plus starter templates.
5. Webhook route: statuses, template updates, signature verification.
6. Share → WhatsApp via the API with `wa.me` fallback, plus activity-timeline entries.
7. Arabic and English translations, RTL pass, mobile check; RBAC key `settingsWhatsapp`.

## Questions for you
1. **Connection method:** start with **B (manual credentials)** and add Embedded Signup later? Has Binaya already created a Meta developer app or started Business Verification?
2. **Database:** how should the new tables reach the database (see above)?
3. **MVP scope:** is Phase 1 as listed right, or do you want automatic reminders in the first release?
4. **Test number:** do you have a WhatsApp Business number I can use for testing? It must not be in use on the WhatsApp Business *app*, because a number registered on the Cloud API can't stay on the phone app.

---

## Status: Phase 1 built (manual credentials)

**Decisions:**
- **Connection:** manual credentials.
- **Database:** tables applied to the production database with `prisma db push`. The SQL diff was checked first: 3 new tables plus indexes only.
- **Automatic sends:** deferred.

**What's in the code:**

| Area | Files |
|---|---|
| Core | `lib/whatsapp/` — `crypto.ts` (AES-256-GCM), `graph.ts` (Graph API client), `template-model.ts` (PMS-field variables ↔ Meta positional variables, validation, starter templates), `service.ts` (connect / sync / create / delete / send / log), `webhook.ts` (signature check, statuses, template updates, inbound) |
| Settings | `app/dashboard/settings/whatsapp/` — connection card, templates list, editor with live preview, starter templates, test send. RBAC key `settingsWhatsapp` (OWNER/MANAGER full; STAFF/ACCOUNTANT none by default) |
| API | `app/api/whatsapp/webhook` (Meta → Binaya) and `app/api/whatsapp/send` (Share dialog: options + send) |
| Share | `components/dashboard/ShareButton.tsx` shows «إرسال عبر واتساب للأعمال» when the org is connected (reservation, invoice, receipt). `components/dashboard/WhatsAppSendDialog.tsx` |
| Tests | `npm run test:whatsapp` |

## Setup checklist (one time, Binaya platform)
1. **Vercel env:**
   - `WHATSAPP_TOKEN_KEY` = 32 random bytes, base64. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. **Never change it after customers connect**, or their stored tokens become unreadable.
   - `META_APP_SECRET` (Meta app → Settings → Basic).
   - `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (any random string).
   - Optional: `WHATSAPP_GRAPH_VERSION` (default `v23.0`).
2. **Meta app** (developers.facebook.com → My apps → Create → Business): add the **WhatsApp** product.
3. **Webhook** (WhatsApp → Configuration): callback `https://binaya.app/api/whatsapp/webhook`, verify token = `WHATSAPP_WEBHOOK_VERIFY_TOKEN`. Subscribe to `messages`, `message_template_status_update` and `phone_number_quality_update`.
4. **Customer connection:** each customer connects in Settings → «واتساب للأعمال» with their WABA ID, Phone number ID and a System-User token. Binaya then subscribes the app to their WABA automatically.

## Testing once a number is available
- **Connect:** connect in Settings, then add the ready-made templates (Arabic + English) and wait for «معتمد».
- **Test send:** use «إرسال تجريبي» on an approved template.
- **Real send:** from an invoice, reservation or receipt, use Share → «إرسال عبر واتساب للأعمال», and watch the status move from sent to delivered to read.
- **Test numbers:** Meta's free test numbers can only message recipients added to the app's allowed list (error `recipientNotAllowed`).
