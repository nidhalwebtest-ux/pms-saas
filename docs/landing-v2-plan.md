# Landing page v2: the promo video's story, as a website

**Goal:** rebuild the landing page (`app/page.tsx` + `components/marketing/`) so it tells the same story as the approved promo video (v6), in the same order and the same visual language:

**Pain points → the solution → features (real screens, focused) → pricing → contact & call to action.**

Status: **decisions D1–D6 and Q1 recorded 31 Oct 2026** (see §9). Phase 1 started 31 Oct 2026.

---

## 1. Where the page is today

The current page has **13 sections** in this order:

| # | Section | Keep / change / remove |
|---|---|---|
| 1 | Hero: «ودّع الحجز المزدوج وفوضى الدفاتر» + `Binaya_Demo.mp4` player | **Keep** (D3); only the free-plan note is corrected |
| 2 | Problem: 4 pain cards | **Change:** the video's 5 pains, animated |
| 3 | Solution: 3 cards | **Merge** into the bridge «الحل؟ → نظام بناية» |
| 4–6 | Feature blocks: reservations, reports, expenses (hand-drawn mock UIs) | **Replace** with the scrollytelling story using **real screenshots** |
| 7 | Impact: «6 ساعات / 98٪ / 3×» count-ups | **Remove** (see problem 2 below) |
| 8 | How it works: 3 steps | **Shrink**, move next to pricing |
| 9 | Pricing calculator (banded per-unit engine) | **Keep the engine**, redesign the UI |
| 10 | Contact form (opens WhatsApp prefilled) | **Merge** with the final CTA, like the video's end card |
| 11 | RTL preview (two hand-drawn cards) | **Replace** with the «بالعربي ومن جوالك» strip, real mobile screen |
| 12 | FAQ | **Keep**, fix the answers that contradict pricing |
| 13 | Final CTA | **Merge** into the end-card section |

### Problems found while reading the code

1. **Pricing contradicts itself.** `lib/saas-pricing.ts` has no free tier: 1.000 / 0.700 / 0.500 OMR per unit per month, with 20% off yearly. But the hero note, the pricing subtitle, the 3 steps, the final CTA and the FAQ all promise «مبنى واحد مجاني للأبد». The JSON-LD in `app/page.tsx` advertises prices from 10 to 75 OMR, which matches neither. **This must be settled before any design work** (decision D1).
2. **Unverified numbers are on the live page.** The Impact section claims «6 ساعات تُوفَّر أسبوعيًا», «98٪ مدفوعات في وقتها» and «فوترة أسرع 3×». Nothing in the repo backs them. The unused `trust` and `testimonials` copy («+120 مبنى», «4.9/5», named quotes) looks like design-drop placeholder text. The video's rule was "no invented numbers, no fake testimonials". The plan applies the same rule here.
3. **The mock UIs are invented.** `components/marketing/mocks/*` draw fake dashboards with made-up guests and amounts. The video's strength is that every screen is the real app. v2 uses real captures only.
4. **The hero video is heavy and breaks autoplay.** `public/Binaya_Demo.mp4` is 32 MB and the player defaults to sound on. Browsers block autoplay with sound, so visitors see a still frame.
5. **Some UI text is hard-coded.** `PricingClientSection.tsx` writes its strings inline (`isAr ? … : …`) instead of using `messages/ar.json` / `en.json`, which goes against the project rule that all UI labels are translatable.
6. **No animation library.** Motion is hand-rolled (`Reveal` with IntersectionObserver, a count-up). That's fine for fades, but not enough for the video-style camera pushes, pinned scrolling and ✓ flips.

---

## 2. The new page, section by section

The page follows the video's story arc. Each section names the video scene it borrows from.

### 0 · Navbar
- Sticky. It turns into frosted glass on scroll, with the logo mark + "Binaya" wordmark (Poppins 600, as in the video).
- 4 anchors, matching the story: **المشاكل · الحل · الأسعار · تواصل معنا**, plus the language switch, «تسجيل الدخول», and a gold «راسلنا واتساب» button (decision D5).
- **Gold progress bar:** a 3 px bar at the bottom of the navbar fills right-to-left as you scroll, the same device as the video.
- **Active-section highlight:** the current section's anchor is highlighted (scroll-spy).

### 1 · Hero: kept as it is (D3)
- The current hero stays: layout, light background, the headline «ودّع الحجز المزدوج وفوضى الدفاتر», the subtitle and the `Binaya_Demo.mp4` player.
- **Only change:** the note «مجاني للأبد لمبنى واحد. دون بطاقة.» becomes the real free plan from D1, e.g. «مجاني للأبد لمبنى واحد وحتى ٥ وحدات. دون بطاقة.»
- The navbar's new progress bar and anchors (§0) sit above it. The story's dark navy starts at section 2, so the transition from the light hero into the dark pain section is a soft gradient, not a hard edge.
- **Optional, not in the plan unless you ask:** the current video is 32 MB and starts with sound on, so browsers block autoplay and most visitors see a still frame. Re-encoding it smaller (about 5 MB, same content) and starting it muted with a sound button would fix that without changing the hero.

### 2 · Pain points (scenes 2–4: bridge, 5 pain cards, escalation): the dark story starts here
- **Opening line:** «أكيد تعرف هذه المشاكل…».
- **The five cards:** the video's **5 pain cards**, with the same text and Phosphor duotone icons, in the same order:
  1. بيانات مبعثرة بين الواتساب والدفاتر
  2. حجوزات مزدوجة لنفس الشقة
  3. لا تعرف الوحدات الشاغرة والمشغولة
  4. أسعار الموسم تتغير يدويًا
  5. صعوبة تتبع مديونيات العملاء المتأخرة
- **Motion:** the cards stack in one by one as you scroll, blur-in and rise, with faint WhatsApp bubbles, notebooks and Excel icons drifting behind them (the video's "chaos" layer, very low opacity).
- **Escalation:** the line «ومع زحمة الموسم… الفوضى تتضاعف», where the stack compresses and shakes slightly. The shake is skipped under reduced motion.

### 3 · Bridge (scene 5: «الحل؟» → «نظامُ بناية»)
- A short full-width beat: «الحل؟» fades, the arch mark **draws itself** (SVG stroke, as in the video), then the wordmark and the tagline «نظام بناية لإدارة الفنادق والشقق المفروشة».
- This is the turn from pain to solution: the background shifts from the darker "chaos" tone to the clean navy-blue gradient.

### 4 · The solution story (scenes 6–10): the core of the page
**Pattern: scrollytelling.** On desktop, a **sticky device** (laptop or phone, CSS-built like the video) stays on one side while five "chapters" scroll past on the other. Each chapter does three things:

1. **Flips its pain card to a gold ✓.** The pain card from section 2 returns and turns into the solution headline. This is the video's key mechanic: every pain gets resolved on screen.
2. **Moves the camera.** The device **zooms and pans to the exact UI area** that proves the point, using the measured boxes in `promo-video/screenshots/v6/boxes.json`, with a soft gold glow on the target.
3. **Shows one real number or state** from the capture.

| Chapter | Pain it resolves | Real screen (existing 2×/3× captures) | Focus animation |
|---|---|---|---|
| «كل بياناتك في مكان واحد» | 1 | Desktop dashboard | glow hops across the 4 KPI cards: الوصول ٢ · المغادرة ٠ · التجاوزات ٣ · النزلاء ٣ |
| «لا حجز مزدوج بعد اليوم» | 2 + 3 | Availability calendar (4 real states) | booked unit pulses red, then the «حجز جديد» dialog, then «إنشاء الحجز» ✓. The caption is honest: the server blocks the overlap. |
| «سعر الموسم يُطبَّق تلقائيًا» | 4 | Unit pricing (mobile) | the season card glows, the counter rolls 20.000 → 40.000 |
| «كل ريال تحت عينك» | (new) | Payments, then the cash box | counter 1435.000, then the chip «الصندوق مطابق» (variance 0.000) |
| «فواتير منظّمة، والمتأخرات تعرفها فورًا» | 5 | Invoice, then the overdue list | «المتبقي» glows, the counter rolls to 402.000 |

- **Interaction:**
  - Each chapter's device can also be **clicked or tapped to replay** its focus animation.
  - A small **chapter rail** (5 dots with labels) lets visitors jump between chapters.
- **Mobile:** no pinning, because pinned scroll on phones feels broken. Each chapter becomes a card with its own device that plays the zoom and glow once when it scrolls into view. The text goes above the device and stays short.
- **Accuracy rules (carried over from the video):**
  - Real captures only; nothing redrawn or AI-generated.
  - The 20/40 seasonal price swap stays on the pricing screen only.
  - Overlays (red pulse, chips) are explanatory, not app UI.
  - The 26-reports fact may be used; no other counts.

### 5 · «بالعربي، ومن جوالك» strip (replaces the RTL preview)
Four compact, true facts, each with a duotone icon and a real mobile crop:
- the Arabic interface, right to left, with a switch to English;
- the Omani rial with 3 decimal places, accurate to the baisa;
- a full mobile experience, so the manager can approve from a phone;
- local WhatsApp support in Oman.

### 6 · Pricing (keeps the real calculator)
- **The calculator:** `lib/saas-pricing.ts` stays the single source of truth.
  - The units slider and the monthly/yearly toggle stay.
  - The headline price and the breakdown **roll like the video's counters** as the slider moves, using the same 3-decimal OMR formatting.
  - The three bands animate in as a staircase that makes "the more units, the lower the rate" obvious.
- **"Start in 3 steps":** a compact row (سجّل · أضف وحداتك · ابدأ الحجز) under the calculator, replacing the separate How-it-works section.
- **Free plan (D1):** a clear first band, «مجاني للأبد · مبنى واحد وحتى ٥ وحدات», shown before the paid bands. The calculator shows 0.000 OMR for 1–5 units. How it prices 6+ units depends on **Q1** (§9).
- **No New Year banner on the page** (D6). The offer stays on social media only.
- **Translations:** all pricing strings move into `messages/*.json`.

### 7 · FAQ
- Keep the accordion.
- Rewrite every answer that mentions "free forever" to say exactly: one building and up to 5 units, free forever (D1). The same wording goes in the hero note, the 3 steps and the end card.
- Add 2 questions the video raises:
  - «هل يمنع النظام الحجز المزدوج فعلًا؟» → yes; the server rejects overlapping bookings.
  - «هل يعمل على الجوال؟»

### 8 · End card + contact (scene 11)
The video's end card, as a section:
- the logo;
- one gold CTA «راسلنا واتساب» (D5), with «ابدأ مجانًا» (signup) as the secondary button;
- two equal contact chips: `binaya.app` and «تواصل معنا عبر واتساب +968 7780 4803», with the digits left-to-right isolated;
- the existing 3-field contact form, which still opens WhatsApp prefilled, beside it as a glass card;
- background: the laptop + phone mockups on the bedroom photo (`v6-bedroom.jpg`), darkened, as in the video.

### 9 · Footer
Keep it, restyled to navy, with the same links plus the WhatsApp number. The floating WhatsApp button stays, but hides while the end card is on screen so it doesn't double up.

---

## 3. Design system (taken from the video)

| Token | Value / rule |
|---|---|
| Colours | navy #0B1F3A, brand #185FA5, light #85B7EB, white text, white at 60–78% for secondary |
| **Gold #C9A45C** | **only** on numbers, glows, ✓ flips, the main CTA and the progress bar (the video's audited rule) |
| Type | Cairo 400/600/700 for Arabic; Poppins 600 for the wordmark only. Body text at least 16 px on mobile. |
| Surfaces | frosted glass cards (blur 24 px, 12–16% white, 1 px white/25% border), 16–20 px radius |
| Icons | Phosphor duotone (light-blue lines, brand-blue duotone layer); replaces `lucide-react` on the marketing page only |
| Devices | the CSS laptop and phone from the video (bezel, base, reflection), so screens stay crisp real images |
| Section rhythm | the hero stays light (D3); dark navy for the story (pain points → solution), light for pricing and FAQ (easier to read numbers), dark again for the end card |

**What stays light:** the dashboard app is unchanged. All new tokens are scoped to `components/marketing/`. The tailwind `rounded-xl` / `max-w-container` conflicts flagged in `docs/migrations/landing-page-audit.md` must not happen again.

---

## 4. Motion system

- **Library:** **GSAP 3 + ScrollTrigger** (free, including plugins). It's the same engine and easing language as the video, so the site and the video feel like one product. It's loaded client-side only for the animated sections, about 45 KB gzipped. Plain fades keep using the existing lightweight `Reveal`.
- **One easing family**, as in v6:
  - entrances `power3.out` (0.45–0.6 s);
  - exits `power2.in` (0.2–0.35 s);
  - camera and device moves `power2.inOut` (0.8–1.0 s);
  - floats `sine.inOut`;
  - no bounce or elastic.
- **Section transitions:**
  - An **RTL mask wipe** reveals each dark section, mirroring to LTR in English.
  - The background gradient cross-fades between sections, so there are no hard colour edges.
  - Headlines blur-in.
- **Signature micro-interactions:**
  - pain card → gold ✓ flip;
  - the gold glow moving to the focused UI;
  - counters rolling to real values;
  - the red pulse on the booked unit;
  - the arch mark drawing itself;
  - a CTA light sweep, once.
- **Rules:**
  - Every animation has a **reduced-motion** path (`prefers-reduced-motion`): final states shown statically, no pinning, no shake.
  - Animate only transform/opacity/filter, with no layout properties, so there's no jank.
  - No scroll-jacking; native scrolling stays.
  - Never animate text that's needed to understand the page before it's readable: the headline is visible at first paint.

---

## 5. Assets

| Asset | Source | Web export |
|---|---|---|
| Hero video | unchanged: `public/Binaya_Demo.mp4` (D3) | optional only: a smaller re-encode of the same video (see §2 · 1) |
| App screens | `promo-video/screenshots/v4/*.png` (2× desktop, 3× mobile, real demo data) | AVIF/WebP via `next/image`, sized per breakpoint; the focus rects come from `screenshots/v6/boxes.json` |
| Photos | `images/v6-bedroom.jpg`, `v6-muttrah.jpg` (Unsplash, licence logged) | AVIF, 1600–2400 px |
| Icons | `promo-video/vendor/phosphor/*-duotone.svg` | inline SVG components |
| OG image | the video's end-card frame, 1200×630 | replaces the SVG mark used now |

The captures show the demo organisation's data: invented guests such as "Fatima Al Rawas", and a dashboard dated 14 Oct. That's acceptable for marketing, because it's a demo org, but no real customer data may appear. Before shipping, check each crop against this rule.

---

## 6. Performance, accessibility, SEO

- **Budgets (mobile, 4G):** LCP < 2.5 s (the headline is text, so it should be fast); CLS < 0.05; added JS ≤ 60 KB gzipped; total page weight before the video under 1.5 MB.
- **Video:** no autoplay with sound; muted inline autoplay only once the hero is in view; paused when off-screen.
- **Accessibility:**
  - every animated number has its final value in the DOM text, so screen readers don't read the animation;
  - focus states on all CTAs;
  - colour contrast passes AA (the video check passed 13/13);
  - the video has a text alternative.
- **i18n:** every string in `messages/ar.json` and `messages/en.json`; English mirrors the wipes and the chapter direction. RTL stays the primary design; English is checked separately.
- **SEO:**
  - keep the metadata;
  - **fix the JSON-LD price** to match `saas-pricing.ts`;
  - add `FAQPage` structured data from the FAQ;
  - use the real OG image.

---

## 7. What gets removed

- `ImpactSection` (the unverified 6h / 98% / 3× claims).
- The unused `trust` and `testimonials` copy (invented numbers and quotes). Delete it, or keep it out of the page until real, permission-backed data exists.
- `mocks/*` hand-drawn UIs, replaced by real captures.
- The separate `SolutionSection`, `RtlPreviewSection`, `HowItWorksSection` and `FinalCtaSection`, merged as described above.
- `LegacyFlatTierPricingSection.tsx` (hidden, superseded). Remove it unless you want to keep it for reference.

---

## 8. Delivery phases

| Phase | Work | Estimate |
|---|---|---|
| 0 · Decisions & copy | settle D1–D6; final Arabic + English copy for every section in `messages/*.json` | 0.5 day |
| 1 · Foundation | GSAP setup + motion helpers (reduced-motion aware), marketing design tokens, CSS device frames, image pipeline (AVIF crops + focus rects), section shell with wipes, navbar + progress bar | 1.5 days |
| 2 · Pain points, bridge | hero note fix + light-to-navy transition, pain stack, chaos layer, escalation, mark-draw bridge | 1 day |
| 3 · Solution story | sticky scrollytelling (desktop), 5 chapters with camera pushes, glows, counters and ✓ flips; mobile card variant; chapter rail | 2.5–3 days |
| 4 · Pricing, FAQ, end card | calculator redesign with the free band + animated numbers, steps row, FAQ fixes + JSON-LD, end card + contact, footer, removal of Impact/trust/testimonials | 1.5 days |
| 5 · QA | Arabic & English, mobile (iPhone/Android widths), reduced motion, Lighthouse, Safari/Chrome/Firefox, accuracy audit (no invented numbers, gold usage) | 1 day |
| **Total** | | **about 7.5–8.5 working days** |

Each phase ends with screenshots of the affected sections, Arabic and English, desktop and mobile, for your review before the next phase starts.

---

## 9. Decisions (recorded 31 Oct 2026)

| # | Question | Decision |
|---|---|---|
| D1 | Free plan? | **One building and up to 5 units, free forever.** All page copy, the FAQ and the JSON-LD use this wording. |
| D2 | Unverified stats and testimonials? | **Remove.** `ImpactSection` and the unused `trust` / `testimonials` copy go. |
| D3 | Hero? | **Keep the current hero section.** Only the free-plan note changes. |
| D4 | Dark story sections, light pricing and FAQ? | **Yes.** |
| D5 | Primary CTA? | **WhatsApp** (gold), with signup as the secondary. |
| D6 | New Year offer on the page? | **No.** |

### Still open

**Q1 · decided 31 Oct 2026: (a) the first 5 units are free for everyone.** `lib/saas-pricing.ts` and its tests change in phase 4 so the app and the page agree.

Original question: **How is a 6+ unit customer priced?** `lib/saas-pricing.ts` charges from the first unit (units 1–20 at 1.000 OMR) and has no free allowance. Two options:
- **(a) The first 5 units stay free for everyone:** a customer with 12 units pays for 7. This needs a change to `saas-pricing.ts` and its tests, so the app and the page agree.
- **(b) Free only while you stay within 1 building and 5 units:** from the 6th unit you pay the normal bands for all units. The calculator jumps from 0.000 to 6.000 OMR at 6 units.

Also noted: the app creates every organisation with `plan = "FREE"`, but nothing limits a free account to 1 building and 5 units. That's outside this landing-page work, but the page will promise a limit the app doesn't enforce yet.

---

## Phase 1: as built (31 Oct 2026)

**Added**
- **Dependencies:** `gsap` 3.15.0 and `@gsap/react` 2.1.2.
- **`components/marketing/v2/`:**
  - `fonts.ts`: Cairo 400/600/700 and Poppins 600, scoped to the landing page root.
  - `motion.ts`: GSAP + ScrollTrigger registration, the video's ease family, and `prefersReducedMotion()` / `isRtl()`.
  - `landing.module.css`: story background, hexagon corners, glass, the RTL/LTR wipe, CSS laptop and phone, the camera layer, the gold glow, the red pulse and the gold CTA. Everything is scoped, so nothing reaches the dashboard.
  - `Device.tsx` (`Laptop`, `Phone`).
  - `FocusScreen.tsx`: a real screenshot on a camera layer; `cameraTo()` zooms and pans to a rect in percentages, so it works at any device size; also `Glow` and `Pulse`.
  - `FocusTour.tsx`: plays a camera tour when it scrolls into view; click to replay; with a reduced-motion fallback.
  - `GoldCheck.tsx`, `RollingNumber.tsx` (integer baisa with 3 decimals; screen readers get the final value) and `StorySection.tsx` (dark section with the wipe on first view; server-rendered visible).
  - `icons.tsx`: 18 Phosphor duotone icons with a brand-blue duotone layer.
- **Screens:** `scripts/marketing/build-screens.mjs` turns the real 2×/3× captures into 10 WebP screens (716 KB total) in `public/marketing/screens/`, plus the generated `lib/marketing/screens.ts` with every focus rect. These are real captures, cropped only; phone shots get a phone-shaped window around their focus.
- **`lib/marketing/whatsapp.ts`:** the number and the link builder.
- **`app/marketing-lab`:** a dev-only preview of the building blocks (404 in production, noindex).

**Changed**
- **Navbar:**
  - the 4 story anchors (المشاكل · الحل · الأسعار · تواصل معنا) with scroll-spy;
  - the gold WhatsApp CTA with sign-up as secondary (D5);
  - the "Binaya" wordmark in Poppins;
  - the video's gold reading-progress bar;
  - the mobile drawer reordered (WhatsApp first) and made `invisible` when closed.
- **Messages:** new `marketing.nav` keys `problems`, `solution`, `whatsapp`, `signup` and `whatsappText` (ar + en).
- **Landing page:** Cairo on the root. `ProblemSection` and `SolutionSection` get the `#problems` and `#solution` ids for the anchors.
- **Bug fix (also live today):** the page wrapper used `overflow-x-hidden`, which turns it into a scroll container and stops the "sticky" navbar from sticking once you scroll. It's now `overflow-x-clip` on the landing page and in `MarketingPageShell` (contact and terms pages).

**Checked**
- `tsc` passes. Screenshots taken in Arabic and English, desktop 1440 and mobile 390: the sticky navbar and active anchor, mid-wipe and settled, the camera tour (sharp at about 2.5×), the pricing and overdue phones, and counters landing on 40.000 and 402.000.
- Problems found and fixed during review:
  - headings inherited the app's dark colour;
  - `will-change` blurred the zoom;
  - nav labels wrapped;
  - the gold CTA lost its colour outside the scoped root.

## Phase 2: as built (31 Oct 2026)

**New sections (replace `ProblemSection` and `SolutionSection`, both deleted)**
- **`v2/sections/PainSection` → `PainStory` (`#problems`):**
  - «أكيد تعرف هذه المشاكل…», the video's 5 pain cards with duotone icons, a faint chaos layer (chat bubbles, notebooks, spreadsheets), then «ومع زحمة الموسم… الفوضى تتضاعف».
  - **Desktop ≥1024 px:** the section pins for about 1500 px of scroll, scrubbed. The cards arrive one by one, the chaos drifts and thickens, then the stack compresses and the escalation line lands.
  - **Tablet and mobile:** no pinning; each card blurs in as it enters the viewport.
  - **Reduced motion:** everything static.
- **`v2/sections/BridgeSection` → `BridgeBeat` (`#solution`):** «الحل؟», then the arch mark draws itself, then the "Binaya" wordmark (Poppins), then the tagline. A soft central light grows behind it. Plays once when the section is 45% into view.
- **The hand-off from the light hero (kept as it is, D3) into the dark story:** a white veil over the section's own background, so there's no seam.

**Copy:** a new `marketing.story` namespace (ar + en), with the video's wording. `marketing.hero.note` now says "one building and up to 5 units" (D1); it's shown by the final CTA. The old `marketing.problem` and `marketing.solution` keys are now unused and get removed in the phase 4 clean-up.

**Checked:** `tsc` passes. Screenshots taken in Arabic and English, desktop and mobile: the hand-off, 5 pinned steps, the escalation, the bridge start and end, and reduced motion. No console errors.
