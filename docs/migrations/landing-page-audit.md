# Marketing landing page migration — Phase 1 audit

Pre-build inventory for the new `Binaya PMS` landing page drop.
Scope: the existing [app/page.tsx](../../app/page.tsx) (1,426 lines, will be
replaced) + the design-system surface area touched by the drop.
Conducted 2026-05-19.

User decisions captured before this audit:
- **Route conflict** → **replace `app/page.tsx`**. No `(marketing)` route group.
- **Truncated files** → **stub with sensible placeholders**. I will scaffold every missing section + mock with the surrounding chrome so the page renders end-to-end; bodies get filled in later.
- **UI primitives** → **hybrid**. `Container` / `SectionHead` / `MarketingNavbar` / etc. live in `components/marketing/`. `Button` goes through `@/components/ui/Button` — but it needs an `xl` size and a `brand` shadow variant first.
- **Workflow** → audit-first.

---

## TL;DR

| Category | Count / Note |
| --- | --- |
| Files in drop (full) | **10** — tailwind.config / globals / layout / page / Navbar / Container / Button / 4 feature blocks + 4 simple sections |
| Files truncated mid-content | **1** — Pricing section ends partway |
| Files missing entirely (need stubs) | **12** — RtlPreview, Faq, FinalCta, Footer, plus 8 mock components |
| Existing landing to delete | `app/page.tsx` (1,426 lines, `LandingPage`) |
| Direct config conflicts | **3** — `rounded-xl` override, `max-w-container` override, new `<html>` in nested layout |
| Mergeable config additions | **4** — `khareef-*` palette, `eyebrow` font-size, `float` keyframes, `brand` / `brand-hover` shadows |
| Required `package.json` change | **1** — install `lucide-react` |
| Existing design-system Button gap | **1** — needs `xl` size (52 px) |

**Headline:** the migration is large but bounded — most of the new chrome merges cleanly into existing tokens. **Three real conflicts** will silently break the dashboard if not handled: a `rounded-xl` override, a `max-w-container` override, and a nested `<html>` tag in the proposed layout. All flagged below.

---

## 1. What the drop contains (10 files in hand + 12 missing)

### Provided in full
1. `tailwind.config.ts` — full replacement, adds `khareef`, `eyebrow`, `container-wide`, `float`, `shadow-brand`. Removes design-token-backed sizes.
2. `app/globals.css` — full replacement, redeclares OKLCH tokens + adds hero/final-cta/oman/steps-dotline gradient ornaments.
3. `app/(marketing)/layout.tsx` — **per decision, NOT created**. We replace `app/page.tsx` instead.
4. `app/(marketing)/page.tsx` — becomes the new `app/page.tsx`.
5. `components/marketing/MarketingNavbar.tsx`
6. `components/marketing/ui/Button.tsx` — **per decision, NOT created.** Adds `xl` size to existing `@/components/ui/Button` instead.
7. `components/marketing/ui/Container.tsx` — local layout primitive (Container + SectionHead).
8. `components/marketing/sections/HeroSection.tsx`
9. `components/marketing/sections/TrustBarSection.tsx`
10. `components/marketing/sections/ProblemSection.tsx`
11. `components/marketing/sections/SolutionSection.tsx`
12. `components/marketing/sections/FeatureBlock.tsx` (+ 4 instances: Reservations / Finance / Reports / Expenses)
13. `components/marketing/sections/BuiltForOmanSection.tsx`
14. `components/marketing/sections/HowItWorksSection.tsx`
15. `components/marketing/sections/TestimonialsSection.tsx`
16. `components/marketing/sections/PricingSection.tsx` — **truncated mid-file**; reconstruct from context

### Truncated / referenced but absent
17. `RtlPreviewSection` — referenced from `page.tsx`, no markup provided
18. `FaqSection` — same
19. `FinalCtaSection` — same; needs `final-cta-bg` class from globals
20. `MarketingFooter` — same
21. `HeroDashboardMock` — imported in `HeroSection`
22. `ReservationMock` — imported in `FeatureReservations`
23. `InvoiceMock` — imported in `FeatureFinance`
24. `Manager360Mock` — imported in `FeatureReports`
25. `MobileApprovalMock` — imported in `FeatureExpenses`
26. `SolutionMocks` — 3 sub-components (Calendar/KhareefPricing/MultiDevice)
27. `OmanMocks` — 3 sub-components (ArabicUI/OMRInvoice/KhareefCalendar)

Per user decision, items 16-27 will be stubbed: each one rendered as a labeled placeholder box matching the surrounding card dimensions so the page renders without errors and looks reasonable in screenshots. Full markup goes in once the user provides the rest.

---

## 2. Config conflicts — three real problems

### 2.1 `rounded-xl` override would break the dashboard

The drop's tailwind config sets:

```ts
borderRadius: { sm: '4px', md: '8px', lg: '12px', xl: '20px' }
```

Our existing config maps `xl` to `var(--radius-xl)` which is **16 px**. The dashboard has hundreds of `rounded-xl` usages — DataTable cards, FilterBar, every modal, every card surface in TodayView, Tenant detail, etc. Bumping every `xl` from 16 → 20 px is a global visual change to the entire app.

**Fix:** keep our `xl: 16 px`. Add a new `2xl: 20 px` token (or use arbitrary `rounded-[20px]` in marketing). Per the drop, only the navbar logo (`rounded-lg` 12 px), feature cards (`rounded-xl`), and hero ornaments use the radius — none actually need 20 px specifically; they look fine with our 16 px.

### 2.2 `max-w-container` width change

Current: `maxWidth: { container: 'var(--container-2xl)' }` → 1440 px.
Drop: `maxWidth: { container: '1200px', 'container-wide': '1280px' }` → 1200 / 1280.

`max-w-container` is used today in [components/dashboard/views/](components/dashboard/views/) and a handful of other places. Changing this would narrow the dashboard.

**Fix:** keep existing `container`. Add new `marketing-container: 1200px` and `marketing-container-wide: 1280px`. The marketing `<Container>` references the new keys; the dashboard untouched.

### 2.3 The proposed marketing layout re-mounts `<html>`

The drop's `app/(marketing)/layout.tsx` renders its own `<html>` + `<body>` + font variables. Next.js only allows one `<html>` per app, in the root layout. Nesting one inside `app/` would either crash at build or silently double-mount.

**Fix already implied by the user decision** — we're not creating the marketing layout. The root [app/layout.tsx](../../app/layout.tsx) already:
- Loads the same fonts (`IBM_Plex_Sans`, `IBM_Plex_Sans_Arabic`, `IBM_Plex_Mono`)
- Sets `dir` from next-intl locale
- Wraps in `NextIntlClientProvider` + `ConfirmDialogProvider` + `Toaster`

So marketing inherits everything automatically. No new layout file needed.

---

## 3. Config additions — all mergeable

These extend (not replace) the existing config:

| Add | Where | Notes |
| --- | --- | --- |
| `khareef-{50,200,500,700}` color palette | `styles/design-tokens.css` + `tailwind.config.ts` | OKLCH values from the drop. Used by BuiltForOmanSection cards + several visual mocks. |
| `eyebrow` font-size | `tailwind.config.ts` (`fontSize.eyebrow = ['12px', { lineHeight: '1', letterSpacing: '0.08em' }]`) | Used in SectionHead. Currently inlined as `font-mono text-[12px] tracking-[0.08em]` — could either ship the token or leave inline. |
| `float` + `float-delayed` keyframes / animations | `tailwind.config.ts` | Used by the floating cards in HeroVisual. |
| `shadow-brand` + `shadow-brand-hover` box-shadows | `tailwind.config.ts` | Used by the `Button` `primary` variant in the drop. Will become new variant tokens on our existing Button. |
| `--khareef-*` CSS vars | `styles/design-tokens.css` | Same as Tailwind palette, source-of-truth. |
| Gradient ornament classes (`hero-bg::before`, `final-cta-bg`, `oman-bg`, `steps-dotline`) | `styles/globals.css` `@layer components` | Bespoke gradients used by Hero, FinalCta, BuiltForOman, HowItWorks. Self-contained, no conflict. |
| `[dir="rtl"] .rtl-mirror` utility | `styles/globals.css` `@layer base` | Used by Testimonials section to flip the decorative open-quote glyph. |

---

## 4. Button gap — add an `xl` size

Existing [components/ui/Button.tsx](../../components/ui/Button.tsx) sizes:

```ts
sm: "h-[28px] text-sm px-2.5"
md: "h-[34px] text-[13px] px-3.5"
lg: "h-10 text-base px-[18px]"   // 40 px
```

Drop's Hero CTA + HowItWorks CTA + PricingSection CTAs use `size="xl"` (52 px). Need to add:

```ts
xl: "h-[52px] text-base px-[26px]"   // 52 / 16 px / 26 px
```

The drop also implies a `brand` boxShadow on the primary variant (`shadow-brand` + `shadow-brand-hover`). These can be added as new design tokens (`--shadow-brand`, `--shadow-brand-hover`) and the Button's `primary` variant can reference them via Tailwind config so the look matches the drop. This is purely additive — no existing call sites change.

Optional: the drop's button uses `hover:-translate-y-px`. The existing Button doesn't translate on hover. Discussion point: do we add the lift everywhere or only on marketing? **Recommendation:** add a `lift` prop (default false) so dashboard buttons stay still and marketing CTAs animate.

---

## 5. lucide-react dependency

Drop uses `lucide-react` exclusively for marketing icons (`ArrowRight`, `ChevronDown`, `Menu`, `Play`, `CheckCircle2`, etc.). Existing app uses `@heroicons/react` everywhere.

**Decision needed (not asked yet — recommend defaulting):** keep both — lucide for marketing, heroicons for dashboard. Two icon libs is mildly annoying but unifying mid-migration would require swapping every icon in the drop. Add lucide, scope its use to `components/marketing/`.

---

## 6. Existing landing — what we're deleting

[app/page.tsx](../../app/page.tsx) (1,426 lines):
- `"use client"` client component
- Default export: `LandingPage`
- Internal helpers: `useInView`, `AnimateIn`, a `T` translations object
- Uses `@heroicons/react/24/outline` + `/24/solid`
- Hand-rolled `useEffect`/`IntersectionObserver` for scroll-in animations
- Single-file approach — no extracted sections, no design-system reuse

**Per the user decision: replace.** I'll preserve the file in git history (a one-line `git mv` would also work as a backup branch, but the user opted for full replacement). If you change your mind after seeing the new page, the old file is recoverable from any commit before this migration.

---

## 7. i18n status

The drop hardcodes English copy (`'Start free trial'`, `'See every unit at a glance'`, etc.). Existing app uses `next-intl` with `messages/en.json` + `messages/ar.json` for everything.

**Discussion point:** the drop says "wrap the marketing pages with `<html dir={locale === 'ar' ? 'rtl' : 'ltr'}>`" but doesn't provide Arabic copy. Two paths:

1. **Ship as English-only for now.** Render the marketing page in whichever locale the user is in, but copy stays in English. The `dir` still flips correctly via the root layout's `next-intl` integration, so the visual RTL works — the text is just always English.
2. **Add a `marketing.*` namespace to messages/{en,ar}.json.** Translate every string. Significantly more work; not part of this migration.

**Recommendation:** path 1 for the migration. Note in the FAQ that Arabic marketing copy is a follow-up. The product UI itself remains fully bilingual.

---

## 8. Section inventory + stub plan

| # | File | Section | Status | Stub plan |
| --- | --- | --- | --- | --- |
| 1 | HeroSection | Hero + floating cards + mock | Provided | Wire as-is; stub HeroDashboardMock |
| 2 | TrustBarSection | 5 logo glyphs | Provided | As-is |
| 3 | ProblemSection | 4 problem cards | Provided | As-is |
| 4 | SolutionSection | 3 solution cards | Provided | Stub CalendarMini / KhareefPricingMini / MultiDeviceMini |
| 5 | FeatureReservations | FeatureBlock instance | Provided | Stub ReservationMock |
| 6 | FeatureFinance | FeatureBlock instance | Provided | Stub InvoiceMock |
| 7 | FeatureReports | FeatureBlock instance | Provided | Stub Manager360Mock |
| 8 | FeatureExpenses | FeatureBlock instance | Provided | Stub MobileApprovalMock |
| 9 | BuiltForOmanSection | 3 Oman cards | Provided | Stub ArabicUIMini / OMRInvoiceMini / KhareefCalendarMini |
| 10 | HowItWorksSection | 3 numbered steps | Provided | As-is |
| 11 | TestimonialsSection | 3 quote cards | Provided | As-is |
| 12 | PricingSection | 3 tier cards | **Truncated mid-Tier 3** | Reconstruct the missing close from context — the third tier has all fields visible up to features list |
| 13 | RtlPreviewSection | unknown | Not provided | Full stub — labeled placeholder section with RTL preview placeholder card |
| 14 | FaqSection | unknown | Not provided | Full stub — generic FAQ accordion w/ "Coming soon" placeholder questions |
| 15 | FinalCtaSection | gradient CTA | Not provided | Full stub — gradient bg + h2 + two CTAs, using `final-cta-bg` class |
| 16 | MarketingFooter | unknown | Not provided | Full stub — 3-column footer with links + copyright |

**Mock components — all stubbed as labeled placeholder boxes matching the parent card's dimensions.** Each one renders a simple "ComponentName mock" label inside a gray-tinted box with the correct dimensions; the actual mock markup goes in once the user pastes it.

---

## 9. Risks & decisions still open

- **Animations.** The drop ships `animate-float` (6 s loop) on two hero cards. Real-time movement on a marketing landing is fine — but verify with `prefers-reduced-motion` in QA. Tailwind's `motion-safe:` prefix should be used.
- **The 1,426-line existing landing has content we'd lose.** The user has accepted replacement, but I'd recommend a quick scan to see if any *copy* (testimonial quotes, statistics, etc.) is worth porting over before deletion. Skipping unless the user wants this.
- **`brand-shadow` blob.** The new Button primary uses `inset 0 1px 0 oklch(1 0 0 / 0.18)` for a subtle inner highlight. Pretty. But it's not in our existing shadow tokens. Adding it shouldn't conflict — just a net-new variable.
- **`scrolled` state in MarketingNavbar.** Listens to window scroll on mount, no cleanup issues. Fine. Will need `"use client"`.
- **Sticky navbar + dashboard navbar.** The dashboard has its own `Navigation`. The marketing nav lives only at `/` — but make sure the dashboard navbar isn't ever rendered alongside it. Routes are separate, so no conflict, but worth verifying after the build.
- **The `dir={locale === 'ar' ? 'rtl' : 'ltr'}` instruction is a red herring.** Root layout already does this via `next-intl`. The marketing page just inherits.
- **Existing `T` translations object in current `app/page.tsx`.** Hand-rolled, not next-intl. Goes away with the deletion.

---

## 10. Recommended phase order

1. **Phase 2 — Foundations** (one commit each):
   - Install `lucide-react`
   - Merge config: add `khareef-*` palette, `eyebrow` font-size, `float` keyframes, `marketing-container` max-width, `shadow-brand` tokens. **Do not** override `xl` radius or `container`. Add gradient ornament classes to globals.
   - Extend `@/components/ui/Button` with `xl` size + optional `lift` prop + `shadow-brand` on primary.

2. **Phase 3 — Marketing chrome**:
   - Create `components/marketing/ui/Container.tsx` (Container + SectionHead).
   - Create `components/marketing/MarketingNavbar.tsx`.
   - Create stubs for the 4 missing sections (RtlPreview, Faq, FinalCta, Footer).
   - Create stubs for the 8 missing mock components.

3. **Phase 4 — Sections**:
   - Drop in the 12 provided section files (reconstructing PricingSection's truncated tail).
   - All sections use the new `@/components/ui/Button` (`xl` variant where the drop calls for it) via a thin marketing-side adapter that keeps the API identical to the drop.

4. **Phase 5 — Replace `app/page.tsx`**:
   - Delete the old `LandingPage` body.
   - Replace with the new composition (`MarketingNavbar` + `<main>` of sections + `MarketingFooter`).

5. **Phase 6 — QA pass**:
   - Build + typecheck.
   - Visual sanity check (browser, both locales for `dir` flip — copy stays English).
   - `prefers-reduced-motion` sweep.
   - Grep for any `rounded-xl` change that bled into the dashboard (should be none if §2.1 is followed).

6. **Phase 7 — Follow-ups**:
   - Fill in the truncated PricingSection tail
   - Fill in the 4 stub sections and 8 stub mocks as the user provides them
   - Decide on Arabic marketing copy

---

## 11. Estimated effort

| Phase | Effort |
| --- | --- |
| 2 — Foundations | 25 min |
| 3 — Marketing chrome + stubs | 40 min |
| 4 — Sections | 60 min |
| 5 — Replace page.tsx | 5 min |
| 6 — QA pass | 30 min |

Total: **~2.5 hours of focused work** for a clean migration that lands the new landing page, preserves the dashboard untouched, and leaves clearly-labeled stubs where the user still has content to paste.

---

## 12. Open questions for the user

1. **Existing landing copy** — anything in `app/page.tsx` (1,426 lines) worth porting before deletion? Testimonials, statistics, specific feature descriptions? Recommend a quick visual scan in browser before merging.
2. **lucide-react vs heroicons** — accept dual-icon-lib? (default: yes, marketing-only lucide)
3. **i18n for marketing copy** — ship English-only initially with `dir` still flipping for visual RTL? (default: yes)
4. **Button `lift` on hover** — add the new lift animation to all primary buttons (incl. dashboard), or marketing-only via prop? (recommend: prop, default false, dashboard unchanged)
5. **`eyebrow` font-size token** — promote to a Tailwind utility, or leave inline as `font-mono text-[12px] tracking-[0.08em]`? (recommend: leave inline — single class drift isn't worth a token)
