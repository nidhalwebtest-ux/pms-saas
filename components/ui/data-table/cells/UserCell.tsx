"use client";

import type { ReactNode } from "react";

export interface UserCellProps {
  /** Full name. Required (avatar falls back to first letter). */
  name: string;
  /** Optional secondary line — email, phone, role, etc. */
  subtitle?: ReactNode;
  /** Optional avatar image URL. When omitted, renders initials on a colored disc. */
  avatarUrl?: string;
  /**
   * Background color class for the initials disc. Default brand. Pass an
   * explicit Tailwind class (e.g. `"bg-warning-100 text-warning-700"`) to
   * key on classification (VIP, blacklisted, etc.).
   */
  avatarClass?: string;
  /** Disc size in px. Default 28. */
  size?: number;
  /** Inline leading marker (e.g. a country flag, a VIP star). */
  leading?: ReactNode;
}

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

/**
 * User cell — avatar (image or initials) + name + optional secondary line.
 * Used for tenants, submitted-by, received-by, etc.
 */
export function UserCell({
  name,
  subtitle,
  avatarUrl,
  avatarClass = "bg-brand-100 text-brand-700",
  size = 28,
  leading,
}: UserCellProps) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="rounded-full flex-shrink-0 object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <span
          aria-hidden="true"
          className={`flex items-center justify-center rounded-full flex-shrink-0 text-[11px] font-semibold ${avatarClass}`}
          style={{ width: size, height: size }}
        >
          {initials(name)}
        </span>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 truncate text-sm font-medium text-fg">
          {leading && <span className="flex-shrink-0">{leading}</span>}
          <span className="truncate">{name}</span>
        </div>
        {subtitle && (
          <div className="truncate text-xs text-fg-tertiary">{subtitle}</div>
        )}
      </div>
    </div>
  );
}
