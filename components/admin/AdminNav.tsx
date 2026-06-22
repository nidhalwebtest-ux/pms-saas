"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartBarSquareIcon,
  UserGroupIcon,
  BellAlertIcon,
} from "@heroicons/react/24/outline";

const TABS = [
  { href: "/admin", label: "Dashboard", icon: ChartBarSquareIcon, exact: true },
  { href: "/admin/prospects", label: "Prospects", icon: UserGroupIcon, exact: false },
  { href: "/admin/followups", label: "Follow-ups", icon: BellAlertIcon, exact: false },
] as const;

export default function AdminNav() {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Admin sections">
      {TABS.map(({ href, label, icon: Icon, exact }) => {
        const active = isActive(href, exact);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
              active
                ? "border-brand-500 text-brand-700"
                : "border-transparent text-fg-secondary hover:border-border-default hover:text-fg"
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
