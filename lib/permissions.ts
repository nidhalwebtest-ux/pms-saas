import type { UserRole } from "@prisma/client";

export type Role = UserRole;

// ── Display labels & badge styles ─────────────────────────────────────────────

export const ROLE_LABELS: Record<Role, string> = {
  OWNER:       "Owner",
  MANAGER:     "Admin",
  STAFF:       "Receptionist",
  ACCOUNTANT:  "Accountant",
};

// ── Navigation access ─────────────────────────────────────────────────────────
// Key must match the `key` field in navigationConfig (Navigation.tsx)

export const NAV_ACCESS: Record<string, Role[]> = {
  dashboard:    ["OWNER", "MANAGER", "STAFF", "ACCOUNTANT"],
  properties:   ["OWNER", "MANAGER", "STAFF"],
  tenants:      ["OWNER", "MANAGER", "STAFF"],
  reservations: ["OWNER", "MANAGER", "STAFF"],
  invoices:     ["OWNER", "MANAGER", "STAFF", "ACCOUNTANT"],
  returns:      ["OWNER", "MANAGER", "STAFF", "ACCOUNTANT"],
  payments:     ["OWNER", "MANAGER", "STAFF", "ACCOUNTANT"],
  expenses:     ["OWNER", "MANAGER", "STAFF", "ACCOUNTANT"],  // All roles — receptionist submits, manager approves, accountant processes
  reports:      ["OWNER", "MANAGER"],
  salesTargets: ["OWNER", "MANAGER"],
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
  submitExpense:      ["OWNER", "STAFF"],              // Receptionist + Owner can submit
  approveExpense:     ["OWNER", "MANAGER"],            // Manager/Owner can approve or reject
  processExpense:     ["OWNER", "ACCOUNTANT"],         // Accountant/Owner can process
  manageExpenseCategories: ["OWNER", "MANAGER"],       // Admin-level
  manageSalesTargets: ["OWNER", "MANAGER"],            // Manager/Owner set sales targets
  manageRoles: ["OWNER", "MANAGER"],                   // Manage roles & permissions
};

// ── Helper ────────────────────────────────────────────────────────────────────

export function can(role: Role, action: keyof typeof ACTION_ACCESS): boolean {
  return (ACTION_ACCESS[action] ?? []).includes(role);
}

export function canNav(role: Role, key: string): boolean {
  return (NAV_ACCESS[key] ?? []).includes(role);
}
