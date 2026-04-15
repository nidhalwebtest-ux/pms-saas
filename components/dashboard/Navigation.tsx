"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import { NAV_ACCESS, type Role } from "@/lib/permissions";

// ── Nav config ────────────────────────────────────────────────────────────────

type SubItem = { name: string; href: string };

type DropdownItem = {
  name: string;
  href: string;
  children?: SubItem[];
};

type NavItem = {
  key:             string;
  name:            string;
  href:            string;
  /** Extra path prefixes that make this tab active (e.g. child pages not under href). */
  activePatterns?: string[];
  children?:       DropdownItem[];
};

const navigationConfig: NavItem[] = [
  { key: "dashboard",    name: "Dashboard",    href: "/dashboard" },
  {
    key:             "properties",
    name:            "Properties",
    href:            "/dashboard/properties",
    activePatterns:  ["/dashboard/units"],
    children: [
      { name: "Buildings",     href: "/dashboard/properties" },
      { name: "Units & Rooms", href: "/dashboard/units"      },
    ],
  },
  {
    key:            "tenants",
    name:           "Tenants",
    href:           "/dashboard/tenants",
    activePatterns: ["/dashboard/tenants"],
    children: [
      { name: "Tenant List",   href: "/dashboard/tenants" },
      { name: "New Tenant",    href: "/dashboard/tenants/new" },
      { name: "Tenant Ledger", href: "/dashboard/tenants/ledger" },
    ],
  },
  { key: "reservations", name: "Reservations", href: "/dashboard/reservations" },
  { key: "invoices",     name: "Invoices",     href: "/dashboard/invoices" },
  { key: "payments",     name: "Payments",     href: "/dashboard/payments" },
  { key: "expenses",     name: "Expenses",     href: "/dashboard/expenses" },
  {
    key:  "settings",
    name: "Settings",
    href: "/dashboard/settings",
    children: [
      {
        name: "Team Management",
        href: "/dashboard/settings/team",
        children: [
          { name: "Staff Accounts", href: "/dashboard/settings/team" },
        ],
      },
      { name: "My Profile",    href: "/dashboard/settings/profile" },
      { name: "Organization",  href: "/dashboard/settings/organization" },
    ],
  },
];

function cn(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Navigation({ role }: { role: Role }) {
  const pathname = usePathname();
  const navRef   = useRef<HTMLElement>(null);

  // Track which top-level dropdown and which sub-dropdown is open
  const [openKey, setOpenKey]   = useState<string | null>(null);
  const [openSub, setOpenSub]   = useState<string | null>(null);
  // Left offset (px) of the active dropdown panel, relative to nav
  const [panelLeft, setPanelLeft] = useState(0);

  const visible = navigationConfig.filter(
    (item) => (NAV_ACCESS[item.key] ?? []).includes(role),
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

  function handleTriggerEnter(key: string, btn: HTMLElement) {
    const navEl = navRef.current;
    if (navEl) {
      const btnRect = btn.getBoundingClientRect();
      const navRect = navEl.getBoundingClientRect();
      setPanelLeft(btnRect.left - navRect.left);
    }
    setOpenKey(key);
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
                  {item.name}
                </Link>
              );
            }

            return (
              <button
                key={item.key}
                type="button"
                onMouseEnter={(e) => handleTriggerEnter(item.key, e.currentTarget)}
                className={baseTabCls}
              >
                {item.name}
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
          className="absolute top-full z-50 mt-px min-w-[200px] overflow-hidden rounded-b-xl bg-white shadow-xl ring-1 ring-black/10"
          style={{ left: `${panelLeft}px` }}
        >
          {activeItem.children.map((child) => {
            const childActive =
              pathname === child.href ||
              pathname.startsWith(child.href + "/");

            return (
              <div
                key={child.href}
                className="relative"
                onMouseEnter={() => setOpenSub(child.children ? child.name : null)}
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
                  {child.name}
                  {child.children && (
                    <ChevronRightIcon className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                  )}
                </Link>

                {/* ── Sub-dropdown panel (3rd level) ───────────────────── */}
                {child.children && openSub === child.name && (
                  <div className="absolute left-full top-0 z-50 ml-px min-w-[180px] overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-black/10">
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
                        {sub.name}
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
