"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import { NAV_ACCESS, type Role } from "@/lib/permissions";
import { REPORT_GROUPS } from "@/app/dashboard/reports/reports-config";

// ── Nav config ────────────────────────────────────────────────────────────────

/** Translation namespace for a label key. Defaults to "nav". */
type Ns = "nav" | "reports";

type SubItem = { labelKey: string; href: string; ns?: Ns };

type DropdownItem = {
  labelKey: string;
  href: string;
  ns?: Ns;
  children?: SubItem[];
};

type NavItem = {
  key:             string;
  labelKey:        string;
  href:            string;
  /** Extra path prefixes that make this tab active (e.g. child pages not under href). */
  activePatterns?: string[];
  children?:       DropdownItem[];
};

const navigationConfig: NavItem[] = [
  { key: "dashboard",    labelKey: "dashboard",    href: "/dashboard" },
  {
    key:             "properties",
    labelKey:        "properties",
    href:            "/dashboard/properties",
    activePatterns:  ["/dashboard/units"],
    children: [
      { labelKey: "buildings",  href: "/dashboard/properties" },
      { labelKey: "unitsRooms", href: "/dashboard/units"      },
    ],
  },
  {
    key:            "tenants",
    labelKey:       "tenants",
    href:           "/dashboard/tenants",
    activePatterns: ["/dashboard/tenants"],
    children: [
      { labelKey: "tenantList",   href: "/dashboard/tenants" },
      { labelKey: "newTenant",    href: "/dashboard/tenants/new" },
      { labelKey: "tenantLedger", href: "/dashboard/tenants/ledger" },
    ],
  },
  {
    key:      "reservations",
    labelKey: "reservations",
    href:     "/dashboard/reservations",
    children: [
      { labelKey: "reservationList", href: "/dashboard/reservations" },
      { labelKey: "newReservation",  href: "/dashboard/reservations/new" },
    ],
  },
  { key: "invoices",     labelKey: "invoices",     href: "/dashboard/invoices" },
  { key: "returns",      labelKey: "returns",      href: "/dashboard/returns" },
  {
    key:      "payments",
    labelKey: "payments",
    href:     "/dashboard/payments",
    children: [
      { labelKey: "paymentsList",  href: "/dashboard/payments" },
      { labelKey: "recordPayment", href: "/dashboard/payments/new" },
    ],
  },
  {
    key:            "expenses",
    labelKey:       "expenses",
    href:           "/dashboard/expenses",
    activePatterns: ["/dashboard/settings/expense-categories"],
    children: [
      { labelKey: "allExpenses",      href: "/dashboard/expenses" },
      { labelKey: "submitExpense",    href: "/dashboard/expenses/new" },
      { labelKey: "manageCategories", href: "/dashboard/settings/expense-categories" },
    ],
  },
  {
    key:      "reports",
    labelKey: "reports",
    href:     "/dashboard/reports",
    children: REPORT_GROUPS.map((g) => ({
      labelKey: `groups.${g.key}`,
      ns:       "reports" as const,
      href:     `/dashboard/reports/${g.items[0].slug}`,
      children: g.items.map((it) => ({
        labelKey: `items.${it.slug}`,
        ns:       "reports" as const,
        href:     `/dashboard/reports/${it.slug}`,
      })),
    })),
  },
  { key: "salesTargets", labelKey: "salesTargets", href: "/dashboard/sales-targets" },
  {
    key:      "settings",
    labelKey: "settings",
    href:     "/dashboard/settings",
    children: [
      {
        labelKey: "teamManagement",
        href:     "/dashboard/settings/team",
        children: [
          { labelKey: "staffAccounts", href: "/dashboard/settings/team" },
        ],
      },
      { labelKey: "rolesPermissions", href: "/dashboard/settings/roles" },
      { labelKey: "myProfile",   href: "/dashboard/settings/profile" },
      { labelKey: "organization", href: "/dashboard/settings/organization" },
      { labelKey: "reservationSettings", href: "/dashboard/settings/reservations" },
      { labelKey: "paymentSettings", href: "/dashboard/settings/payments" },
      { labelKey: "returnSettings", href: "/dashboard/settings/returns" },
      { labelKey: "unitSettings", href: "/dashboard/settings/units" },
    ],
  },
];

function cn(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// Settings (and expense-category) sub-pages map to a setup permission entity.
// A child with no mapping (e.g. My Profile) is always shown when its parent is.
const CHILD_ENTITY: Record<string, string> = {
  "/dashboard/settings/team":              "team",
  "/dashboard/settings/roles":             "roles",
  "/dashboard/settings/organization":      "organization",
  "/dashboard/settings/reservations":      "settingsReservations",
  "/dashboard/settings/payments":          "settingsPayments",
  "/dashboard/settings/returns":           "settingsReturns",
  "/dashboard/settings/units":             "settingsUnits",
  "/dashboard/settings/expense-categories":"expenseCategories",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function Navigation({ role, navAccess }: { role: Role; navAccess?: Record<string, boolean> }) {
  const pathname = usePathname();
  const navRef   = useRef<HTMLElement>(null);
  const t        = useTranslations("nav");
  const tReports = useTranslations("reports");
  // Resolve a label from the right namespace (report groups/items live in "reports").
  const label = (key: string, ns?: Ns) => (ns === "reports" ? tReports(key) : t(key));

  // Track which top-level dropdown and which sub-dropdown is open
  const [openKey, setOpenKey]   = useState<string | null>(null);
  const [openSub, setOpenSub]   = useState<string | null>(null);
  // Inline-start offset (px) of the active dropdown panel, relative to nav.
  // Stored in logical (start) units; rendered as `left` in LTR and `right` in RTL.
  const [panelStart, setPanelStart] = useState(0);
  const [isRTL, setIsRTL] = useState(false);
  // True once the user interacts via touch — lets us skip the synthetic
  // mouseenter a tap fires (which would otherwise fight the click toggle).
  const touchRef = useRef(false);

  useEffect(() => {
    const update = () => setIsRTL(document.documentElement.dir === "rtl");
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["dir"] });
    return () => obs.disconnect();
  }, []);

  // Prefer the permission-matrix-derived visibility map; fall back to the
  // legacy role-based NAV_ACCESS for any key it doesn't cover. Children that map
  // to a setup entity (Settings sub-pages, Manage categories) are filtered by
  // that entity's matrix access too.
  const childVisible = (href: string) => {
    const entity = CHILD_ENTITY[href];
    if (!entity) return true;
    return navAccess ? !!navAccess[entity] : (NAV_ACCESS["settings"] ?? []).includes(role);
  };
  const visible = navigationConfig
    .filter((item) =>
      navAccess && item.key in navAccess
        ? navAccess[item.key]
        : (NAV_ACCESS[item.key] ?? []).includes(role),
    )
    .map((item) =>
      item.children
        ? { ...item, children: item.children.filter((c) => childVisible(c.href)) }
        : item,
    );

  // Close everything when clicking outside the nav
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenKey(null);
        setOpenSub(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function computePanelStart(btn: HTMLElement) {
    const navEl = navRef.current;
    if (!navEl) return;
    const btnRect = btn.getBoundingClientRect();
    const navRect = navEl.getBoundingClientRect();
    // In RTL the inline-start edge of the panel is the right edge of the trigger.
    setPanelStart(isRTL ? navRect.right - btnRect.right : btnRect.left - navRect.left);
  }

  // Desktop hover-open (skipped on touch — a tap fires a synthetic mouseenter
  // that would otherwise reopen what the click just toggled closed).
  function handleTriggerEnter(key: string, btn: HTMLElement) {
    if (touchRef.current) return;
    computePanelStart(btn);
    setOpenKey(key);
    setOpenSub(null);
  }

  // Tap / click toggle — the primary way to open a menu on touch devices.
  function handleTriggerClick(key: string, btn: HTMLElement) {
    computePanelStart(btn);
    setOpenKey((cur) => (cur === key ? null : key));
    setOpenSub(null);
  }

  function handleClose() {
    setOpenKey(null);
    setOpenSub(null);
  }

  const activeItem = visible.find((i) => i.key === openKey);

  return (
    <nav
      ref={navRef}
      className="relative border-b border-gray-200 bg-gray-50"
      onMouseLeave={handleClose}
    >
      {/* ── Scrollable tab row ───────────────────────────────────────────────
          overflow-x-auto is on THIS inner div only — NOT on the nav element.
          This means absolutely-positioned dropdown panels are NOT clipped.   */}
      <div className="overflow-x-auto scrollbar-hide px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-max">
          {visible.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href + "/")) ||
              item.activePatterns?.some(
                (p) => pathname === p || pathname.startsWith(p + "/"),
              );

            const baseTabCls = cn(
              "inline-flex items-center gap-1 border-b-2 px-3 py-4 text-sm font-medium whitespace-nowrap transition-colors",
              isActive
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
            );

            if (!item.children) {
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onMouseEnter={() => { setOpenKey(null); setOpenSub(null); }}
                  className={baseTabCls}
                >
                  {t(item.labelKey)}
                </Link>
              );
            }

            return (
              <button
                key={item.key}
                type="button"
                onTouchStart={() => { touchRef.current = true; }}
                onMouseEnter={(e) => handleTriggerEnter(item.key, e.currentTarget)}
                onClick={(e) => handleTriggerClick(item.key, e.currentTarget)}
                aria-expanded={openKey === item.key}
                className={baseTabCls}
              >
                {t(item.labelKey)}
                <ChevronDownIcon
                  className={cn(
                    "h-4 w-4 flex-shrink-0 transition-transform duration-200",
                    openKey === item.key ? "rotate-180" : "",
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Dropdown panel ───────────────────────────────────────────────────
          Rendered OUTSIDE the overflow container → never clipped.
          Positioned absolutely relative to <nav> using panelLeft.           */}
      {openKey && activeItem?.children && (
        <div
          className="absolute top-full z-50 mt-px min-w-[200px] rounded-b-xl bg-white shadow-xl ring-1 ring-black/10"
          style={isRTL ? { right: `${panelStart}px` } : { left: `${panelStart}px` }}
        >
          {activeItem.children.map((child) => {
            const childActive =
              pathname === child.href ||
              pathname.startsWith(child.href + "/");

            return (
              <div
                key={child.href}
                className="relative last:[&>a]:rounded-b-xl"
                onMouseEnter={() => setOpenSub(child.children ? child.labelKey : null)}
              >
                <Link
                  href={child.href}
                  onClick={handleClose}
                  className={cn(
                    "flex items-center justify-between px-4 py-2.5 text-sm transition-colors",
                    childActive
                      ? "bg-blue-50 text-blue-600 font-medium"
                      : "text-gray-700 hover:bg-gray-50 hover:text-blue-600",
                  )}
                >
                  {label(child.labelKey, child.ns)}
                  {child.children && (
                    <ChevronRightIcon className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                  )}
                </Link>

                {/* ── Sub-dropdown panel (3rd level) ───────────────────── */}
                {child.children && openSub === child.labelKey && (
                  <div className="absolute start-full top-0 z-50 ms-px min-w-[180px] overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-black/10">
                    {child.children.map((sub) => (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={handleClose}
                        className={cn(
                          "block px-4 py-2.5 text-sm transition-colors",
                          pathname === sub.href
                            ? "bg-blue-50 text-blue-600 font-medium"
                            : "text-gray-700 hover:bg-gray-50 hover:text-blue-600",
                        )}
                      >
                        {label(sub.labelKey, sub.ns)}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </nav>
  );
}
