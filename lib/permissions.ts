import type { UserRole } from "@prisma/client";

export type Role = UserRole;

// ── Display labels & badge styles ─────────────────────────────────────────────

export const ROLE_LABELS: Record<Role, string> = {
  OWNER:       "Owner",
  MANAGER:     "Admin",
  STAFF:       "Receptionist",
  ACCOUNTANT:  "Accountant",
};

export const ROLE_BADGE: Record<Role, string> = {
  OWNER:       "bg-purple-100 text-purple-700 ring-purple-700/20",
  MANAGER:     "bg-blue-100 text-blue-700 ring-blue-700/20",
  STAFF:       "bg-green-100 text-green-700 ring-green-700/20",
  ACCOUNTANT:  "bg-amber-100 text-amber-700 ring-amber-700/20",
};

// ── Navigation access ─────────────────────────────────────────────────────────
// Key must match the `key` field in navigationConfig (Navigation.tsx)

export const NAV_ACCESS: Record<string, Role[]> = {
  dashboard:    ["OWNER", "MANAGER", "STAFF", "ACCOUNTANT"],
  properties:   ["OWNER", "MANAGER", "STAFF"],
  tenants:      ["OWNER", "MANAGER", "STAFF"],
  reservations: ["OWNER", "MANAGER", "STAFF"],
  payments:     ["OWNER", "MANAGER", "STAFF", "ACCOUNTANT"],  // Receptionist can record payments
  expenses:     ["OWNER", "MANAGER", "ACCOUNTANT"],           // Receptionist cannot see expenses
  settings:     ["OWNER", "MANAGER"],
};

// ── Action-level permissions ───────────────────────────────────────────────────

export const ACTION_ACCESS: Record<string, Role[]> = {
  manageProperties:   ["OWNER", "MANAGER"],
  manageTeam:         ["OWNER", "MANAGER"],
  removeTeamMember:   ["OWNER"],
  changeRoles:        ["OWNER"],
  recordPayments:     ["OWNER", "MANAGER", "STAFF", "ACCOUNTANT"],
  manageExpenses:     ["OWNER", "MANAGER", "ACCOUNTANT"],
  manageTenants:      ["OWNER", "MANAGER", "STAFF"],
  manageReservations: ["OWNER", "MANAGER", "STAFF"],
};

// ── Helper ────────────────────────────────────────────────────────────────────

export function can(role: Role, action: keyof typeof ACTION_ACCESS): boolean {
  return (ACTION_ACCESS[action] ?? []).includes(role);
}

export function canNav(role: Role, key: string): boolean {
  return (NAV_ACCESS[key] ?? []).includes(role);
}
