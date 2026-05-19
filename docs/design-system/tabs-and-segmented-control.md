# Tabs + SegmentedControl — Design System

Two switching primitives, one rulebook. **Tabs** sit at the page or section
level — long labels, counts, anatomy. **SegmentedControl** sits in toolbars
and toolstrips — short labels, equal weights, one row. Both ship sliding
indicators, full keyboard support, and RTL-correct layout.

Migration audit: [docs/migrations/tabs-audit.md](../migrations/tabs-audit.md).

---

## Quick reference

| Export | Purpose |
| --- | --- |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | The tab composition. Built on `@radix-ui/react-tabs`. |
| `SegmentedControl` | Custom-built radiogroup with a sliding pill. |
| `useTabParam` | URL sync hook at `@/hooks/useTabParam`. |
| Types | `TabsProps`, `TabsListProps`, `TabsTriggerProps`, `TabsContentProps`, `TabsVariant`, `TabsSize`, `TabsOrientation`, `TabsCountVariant`, `SegmentedControlProps`, `SegmentedControlOption`, `SegmentedControlSize`, `SegmentedControlVariant` |

Standard import:

```tsx
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
  SegmentedControl,
} from "@/components/ui";
import { useTabParam } from "@/hooks/useTabParam";
```

---

## When to use which

The shortest decision is by **label length** and **what the choice changes**.

| Use **Tabs** when… | Use **SegmentedControl** when… |
| --- | --- |
| Labels vary in length, may carry counts or icons | 2–4 short, equal-weight choices |
| The choice changes *what is visible* (page sections, detail panels) | The choice changes *how the same data is shown* (List / Cards / Calendar) |
| The chosen tab maps to a URL fragment users can bookmark | State is a single value, no counts, no dots |
| You need vertical orientation (sidebar nav) | Touch targets need to be visually grouped with one moving pill |

**Edge case — Dashboard "view switcher"** (Today / Receptionist / Manager): the
labels are long-ish but the choice changes *view density* rather than
navigating to a different section, so it is a `SegmentedControl` in the
`size="lg" variant="brand"` configuration.

> **The litmus test:** does the choice change the page, or change how it is shown?

### Tabs vs FilterBarQuickFilters

There is a third tab-shaped surface in the design system —
`FilterBarQuickFilters` — used by every list page for status / period
quick-filter strips. It is **not** a target for `<Tabs>` migration. Use
`<Tabs>` for navigation between distinct sections; use
`FilterBarQuickFilters` (through `<FilterBar quickFilters={…}>`) for
single-axis filtering inside a list view.

---

## Tabs — variants

### `underline` (default — ~90% of cases)

Active tab gets a 2 px brand bar on its baseline. No background. Use first.

| Use for | Where |
| --- | --- |
| Tenant detail (Overview / Ledger) — already migrated | [TenantDetailTabs.tsx](../../app/dashboard/tenants/[id]/TenantDetailTabs.tsx) |
| Future detail-page sub-sections | When they appear |

### `pill`

A self-contained track. Active tab gets a white pill on a gray rail. Use
inside cards / modals / panels where an underline would conflict with the
parent surface.

### `boxed`

Active tab visually connects to the panel below — for multi-document
workspaces. Use sparingly; it's heavier than the other two.

### Vertical orientation

Set `orientation="vertical"` for sidebar navigation. Active indicator moves to
the inline-start edge as a 2 px brand bar. Arrow keys swap to up/down. Spec
calls this out for a future Settings page; not used today.

---

## Tabs — sizes

| Size | Trigger height | Type | Use for |
| --- | --- | --- | --- |
| `sm` | 36 px | `text-[12.5px]` | Dense panels, drawer headers |
| `md` (default) | 44 px | `text-[13px]` | All top-level detail-page tabs |
| `lg` | 52 px | `text-[14.5px]` | Settings sidebar (vertical), full-page tab nav |

---

## Tabs — trigger features

All composable; all keep the underline baseline aligned.

| Feature | Prop | Notes |
| --- | --- | --- |
| Icon | `icon={ReactNode}` | 14 / 16 / 18 px (per size), inherits trigger colour |
| Count badge | `count={number}` | Built into the trigger. Above `countCeiling` renders as `500+`. |
| Count variant | `countVariant="destructive" \| "warning" \| "success" \| "neutral"` | Neutral picks up the brand tint when the tab is active. |
| Notification dot | `notification={true}` | 6 × 6 red dot at top-end of trigger. Independent of count. |
| Disabled | `disabled={true}` | Skipped by arrow-key navigation. |
| Tooltip | `tooltip={string}` | Useful for icon-only triggers. |

Accessible-name suffixes are added automatically: a trigger with
`count={3}` reads as "Reservations, 3 records"; with `notification={true}`,
"Notes, unread".

---

## SegmentedControl — variants

| Variant | Use for |
| --- | --- |
| `default` | Everywhere by default. Gray track, sliding white-on-gray pill. |
| `brand` | **Dashboard hero only.** Active segment becomes solid brand-500 with white text. |
| `ghost` | No track at all. Brand-tinted active pill with a thin brand border. Use when the SC must sit naked inside another bordered container (rare). |

## SegmentedControl — sizes

| Size | Outer height | Segment height | Use for |
| --- | --- | --- | --- |
| `sm` (default) | 32 px | 26 px | FilterBar, toolbars, table headers, dense inline switching |
| `md` | 38 px | 30 px | Standalone inline — date range, rate type, view density |
| `lg` | 46 px | 38 px | Dashboard hero only |

## SegmentedControl — compositions

| Composition | When to use |
| --- | --- |
| Labels only | Default — time ranges, view modes with verbose names |
| Icons only | Toolbar with universally-recognised icons (list / grid / calendar). Always provide `ariaLabel` on every option. |
| Icon + label | When the icon adds redundant clarity to a verbose label |
| `equalWidth` | When labels have similar weight and visual rhythm matters |
| `collapseToIcons` | Hide labels below a viewport width. Requires every option to carry an `icon`. |

---

## API

### Tabs

```ts
interface TabsProps {
  value:         string;
  onValueChange: (v: string) => void;
  defaultValue?: string;
  orientation?:  "horizontal" | "vertical";   // default "horizontal"
  activationMode?: "manual" | "automatic";    // default "manual"
  dir?:          "ltr" | "rtl";
  className?:    string;
  children:      ReactNode;
}

interface TabsListProps {
  variant?:        "underline" | "pill" | "boxed";  // default "underline"
  size?:           "sm" | "md" | "lg";              // default "md"
  fullWidth?:      boolean;                          // pill only
  scrollOverflow?: boolean;                          // default true
  ariaLabel?:      string;
  className?:      string;
  children:        ReactNode;
}

interface TabsTriggerProps {
  value:         string;
  icon?:         ReactNode;
  count?:        number;
  countVariant?: "neutral" | "destructive" | "warning" | "success";  // default "neutral"
  countCeiling?: number;
  notification?: boolean;
  disabled?:     boolean;
  tooltip?:      string;
  className?:    string;
  children:      ReactNode;
}

interface TabsContentProps {
  value:       string;
  forceMount?: boolean;
  className?:  string;
  children:    ReactNode;
}
```

### SegmentedControl

```ts
interface SegmentedControlProps<V extends string = string> {
  value:           V;
  onValueChange:   (v: V) => void;
  options:         SegmentedControlOption<V>[];

  size?:           "sm" | "md" | "lg";              // default "sm"
  variant?:        "default" | "brand" | "ghost";   // default "default"

  equalWidth?:     boolean;
  collapseToIcons?: boolean | number;

  ariaLabel?:      string;
  ariaLabelledby?: string;

  className?:      string;
  testId?:         string;
}

interface SegmentedControlOption<V extends string = string> {
  value:      V;
  label?:     string;
  icon?:      ReactNode;
  ariaLabel?: string;   // required if label is omitted
  disabled?:  boolean;
  tooltip?:   string;
}
```

### useTabParam

```ts
function useTabParam(
  paramName: string,
  fallback:  string,
): [string, (v: string) => void];
```

Read + write a single query param with a `fallback` default. When the value
equals the fallback, the param is stripped from the URL. Uses
`router.replace` with `scroll: false` so tab clicks neither push history nor
jump the page.

---

## URL sync pattern

```tsx
const [tab, setTab] = useTabParam("tab", "overview");

<Tabs value={tab} onValueChange={setTab}>
  <TabsList variant="underline" size="md">
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="ledger">Ledger</TabsTrigger>
  </TabsList>
  <TabsContent value="overview"><TenantOverview /></TabsContent>
  <TabsContent value="ledger"><TenantLedger /></TabsContent>
</Tabs>
```

Use `useTabParam` for any tab strip where the chosen tab should survive
refresh or be shareable via link.

---

## Server-component pages — the lazy-mount caveat

Radix's `TabsContent` mounts every panel to the DOM (toggling `hidden` on
inactive ones). For a server-rendered page with an expensive panel — e.g.
`TenantLedger`, which fetches its own data client-side — eager mount means
the data fetches as soon as the page loads, regardless of which tab is
active.

Two patterns are supported:

### Pattern 1 — `<Tabs>` strip without `<TabsContent>` (recommended for SSR pages)

Use `<Tabs>` + `<TabsList>` + `<TabsTrigger>` for the visual + ARIA, and keep
the conditional render of content in the server page. This is the pattern
used by [TenantDetailTabs.tsx](../../app/dashboard/tenants/[id]/TenantDetailTabs.tsx) —
the client tab strip writes to the URL via `useTabParam`; the server page
reads the URL and conditionally renders Overview or Ledger.

```tsx
// page.tsx (server component)
const { tab = "overview" } = await searchParams;
return (
  <>
    <TenantDetailTabs currentTab={tab} labels={…} />
    {tab === "ledger" ? <TenantLedger /> : <TenantOverview />}
  </>
);
```

### Pattern 2 — Full `<Tabs>` with `<TabsContent>` (recommended for cheap panels)

Use the canonical Radix composition when each panel is cheap to mount
upfront — static markup, KPIs, charts that already have their data passed
in via props.

```tsx
<Tabs value={tab} onValueChange={setTab}>
  <TabsList variant="underline" size="md">
    <TabsTrigger value="general">General</TabsTrigger>
    <TabsTrigger value="branding">Branding</TabsTrigger>
  </TabsList>
  <TabsContent value="general"><GeneralForm /></TabsContent>
  <TabsContent value="branding"><BrandingForm /></TabsContent>
</Tabs>
```

---

## Composition patterns

### Tabs · settings sidebar (vertical · lg) — for when Settings is redesigned

```tsx
<Tabs orientation="vertical" value={section} onValueChange={setSection}>
  <TabsList size="lg" variant="underline">
    <TabsTrigger value="profile" icon={<UserIcon/>}>Profile</TabsTrigger>
    <TabsTrigger value="users"   icon={<UsersIcon/>} count={8}>Users</TabsTrigger>
    <TabsTrigger value="notifications" icon={<BellIcon/>} notification>Notifications</TabsTrigger>
  </TabsList>
  <TabsContent value="profile"><ProfileForm /></TabsContent>
  <TabsContent value="users"><UsersList /></TabsContent>
  <TabsContent value="notifications"><NotificationsForm /></TabsContent>
</Tabs>
```

### SegmentedControl · Dashboard hero (lg · brand)

```tsx
<SegmentedControl<Tab>
  value={activeTab}
  onValueChange={switchTab}
  size="lg"
  variant="brand"
  ariaLabel={t("viewSwitcher")}
  options={tabs.map((tab) => ({ value: tab, label: t(TAB_KEYS[tab]) }))}
/>
```

See [DashboardShell.tsx](../../components/dashboard/DashboardShell.tsx) for
the live implementation.

### SegmentedControl · list view toggle (sm · icons only)

```tsx
<SegmentedControl<"table" | "card" | "summary">
  value={viewMode}
  onValueChange={setViewMode}
  size="sm"
  ariaLabel="View mode"
  options={[
    { value: "table",   icon: <ListBulletIcon />,     ariaLabel: "Table view",   tooltip: "Table view" },
    { value: "card",    icon: <Squares2X2Icon />,     ariaLabel: "Card view",    tooltip: "Card view" },
    { value: "summary", icon: <RectangleGroupIcon />, ariaLabel: "Summary view", tooltip: "Summary view" },
  ]}
/>
```

---

## Animations

| Moment | Behaviour | Timing |
| --- | --- | --- |
| Tab indicator slide | A single absolute element translates + resizes between active triggers | 200 ms cubic-bezier(.4,0,.2,1) |
| Tab content swap | Outgoing panel fades to 0; incoming fades in via Radix Content + Tailwind `animate-in fade-in-0` | 150 ms ease-out |
| SegmentedControl pill | One absolute pill translates + resizes between segments. Hover never moves the pill. | 200 ms cubic-bezier(.4,0,.2,1) |
| Reduced motion | Motion respects `prefers-reduced-motion` — slide collapses to opacity-only fade where applicable | inherited from design tokens |

### Sliding indicator implementation

Each component keeps a single absolute-positioned indicator. On mount and on
every selection change, a `MutationObserver` watches `data-state`
(Tabs) / `aria-checked` (SegmentedControl) on the children, then a
`useLayoutEffect` measures the active trigger's `offsetLeft` + `offsetWidth`
and translates the indicator. A `ResizeObserver` re-measures on container
resize. Continuous slide on selection change, never a cross-fade.

---

## Accessibility

### Tabs

- Container `role="tablist"` with `aria-orientation` per orientation.
- Each trigger `role="tab"` with `aria-selected` and roving `tabIndex`.
- Each content panel `role="tabpanel"` with `aria-labelledby` pointing at the trigger.
- Arrow keys move focus between tabs; `Home` / `End` jump to first / last; `Enter` / `Space` activate. Disabled tabs are skipped. (All wired by Radix.)
- Count badges fold into the trigger's accessible name: "Reservations, 12 records". Pluralisation via the trigger code.
- Notification dot is `aria-hidden`; meaning is duplicated in the accessible name: "Notes, unread".
- Focus rings visible on every trigger via `focus-visible:shadow-focus`.

### SegmentedControl

- Container `role="radiogroup"` with a required `ariaLabel` (or `ariaLabelledby`).
- Each segment `role="radio"` with `aria-checked` and roving `tabIndex`. Only the active segment is in the tab order.
- Arrow keys **move and select** (radio-group convention — selection follows focus). `Home` / `End` jump to ends. Disabled segments are skipped, and `Tab` moves out of the group entirely.
- Icon-only segments must provide `ariaLabel`; pair with `tooltip` for sighted users.
- Touch target ≥ 40 px tall at `sm` size (the segment is 26 px but the full 32 px container is the hit area).

---

## RTL

Both components inherit `dir` from the document. All side-specific styling
uses logical CSS properties (`inset-inline-start`, `inset-inline-end`,
`me-`, `ms-`, `ps-`, `pe-`).

- **Tab strip scrolls right-to-left** in RTL containers per the browser default.
- **Arrow keys** in SegmentedControl swap their meaning in RTL: `→` selects previous, `←` selects next. Detected via `document.documentElement.dir` at keypress time.
- **Sliding indicators** measure with `offsetLeft` / `offsetTop` which already reflect post-RTL flow — no inversion math.
- **Count badges** stay LTR via `ltr-numbers`, so "500+" never reads as "+500".
- **Notification dot** uses `inset-ie-*` so it stays at the trailing edge.

---

## Things to avoid

- **Don't pick a variant by colour.** Pick by surface and intent — `underline` on page chrome, `pill` in panels, `boxed` for documents; `default` SegmentedControl in toolbars, `brand` only for the Dashboard hero.
- **Don't put 15 tabs in a strip and rely on scroll to save you.** Cap horizontal tabs at ~8. If you need more, the IA is wrong.
- **Don't paint every count red.** The `destructive` count variant is for genuinely urgent counts (overstays, blacklists, failed payments). Reserve it.
- **Don't use SegmentedControl for page-level navigation that needs URL sync.** Use Tabs + `useTabParam` instead. SegmentedControl deliberately has no URL hook.
- **Don't use Tabs as a settings toggle.** Two-state on/off is a switch (toggle), not Tabs and not SegmentedControl.
- **Don't ship icon-only SegmentedControl segments without `ariaLabel`.** A screen reader will announce "radio button" with no context.
- **Don't wrap `<Tabs>` content in additional `role="tab"` or `aria-selected` markup.** Radix already owns those attributes; duplicating them confuses AT.
- **Don't migrate `FilterBarQuickFilters` to `<Tabs>`.** It is a separate, intentional pattern for list-page filtering. Tabs are for navigation between sections.

---

## Migration history

Phase 1 audit (`39240a9`) →
Phase 2 install (`cf0d1ca`) →
Phase 3 Tabs build (`d767ada`) →
Phase 4 SegmentedControl build (`a91fb0a`) →
Phase 5 four per-surface migrations:

| Commit | Surface |
| --- | --- |
| `a1b6c4e` | Dashboard view-switcher → `SegmentedControl size="lg" variant="brand"` |
| `de5e450` | Tenant detail tabs → `Tabs variant="underline" size="md"` (server-component-friendly pattern) |
| `f5aa8c4` | Tenants list view-switcher → `SegmentedControl size="sm"` |
| `4844128` | Properties list view-switcher → `SegmentedControl size="sm"` |

Phase 6 — this document.

**Visible deltas worth flagging during QA**
- Dashboard view-switcher: visual swaps from white-pill on gray track to brand-tinted active segment with sliding pill animation. localStorage persistence preserved.
- Tenant detail tabs: blue-600 underline → brand-500 underline, plus sliding indicator. Arrow-key navigation now works. URL still `?tab=overview` / `?tab=ledger`.
- Tenants + Properties view-switchers: active state changes from `bg-gray-900` (dark) to white pill on gray track (lighter). Keyboard arrow nav now works.

**Not migrated (audit recommendation):** `FilterBarQuickFilters` stays as the existing WAI-ARIA-compliant tab strip for FilterBar consumers (Reservations, Payments, Tenants, Properties, Units, Expenses, Invoices). Refactoring to use `<Tabs>` internals would touch every list page with no user-facing benefit.

**Not migrated (don't exist yet):** Building / Reservation / Unit / Invoice / Payment / Expense detail tabs, Settings sidebar, Reports tabs. These surfaces are not in the codebase; pick up when they appear.
