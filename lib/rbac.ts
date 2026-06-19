/**
 * RBAC catalog + helpers (NetSuite-style permission matrix).
 *
 * A role's `permissions` JSON maps an entity key → a level. Levels are a
 * hierarchy: NONE < VIEW < CREATE < EDIT < FULL. The entity catalog is grouped
 * (Lists / Transactions / Reports / Setup) for the matrix UI. System roles
 * (OWNER/MANAGER/STAFF/ACCOUNTANT) are seeded per org from DEFAULT_MATRICES and
 * are read-only; custom roles are editable copies.
 *
 * Phase 1 = data + settings UI only. Enforcement (button visibility + server
 * guards) consumes `levelFor()` / `can()` in a later phase.
 */

export const PERMISSION_LEVELS = ["NONE", "VIEW", "CREATE", "EDIT", "FULL"] as const;
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

const RANK: Record<PermissionLevel, number> = { NONE: 0, VIEW: 1, CREATE: 2, EDIT: 3, FULL: 4 };

export type PermissionMap = Record<string, PermissionLevel>;

export interface EntityDef { key: string }
export interface PermissionGroup { key: string; entities: EntityDef[] }

/** The full catalog of records/transactions/reports/setup, grouped for the UI. */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: "lists",
    entities: [{ key: "buildings" }, { key: "units" }, { key: "tenants" }],
  },
  {
    key: "transactions",
    entities: [
      { key: "reservations" }, { key: "invoices" }, { key: "payments" },
      { key: "returns" }, { key: "expenses" },
    ],
  },
  {
    key: "reports",
    entities: [{ key: "reports" }, { key: "salesTargets" }],
  },
  {
    key: "setup",
    entities: [
      { key: "organization" }, { key: "team" }, { key: "roles" },
      { key: "settingsReservations" }, { key: "settingsPayments" },
      { key: "settingsReturns" }, { key: "settingsUnits" },
      { key: "banks" }, { key: "expenseCategories" },
    ],
  },
];

export const ALL_ENTITY_KEYS: string[] = PERMISSION_GROUPS.flatMap((g) => g.entities.map((e) => e.key));

export type SystemRoleKey = "OWNER" | "MANAGER" | "STAFF" | "ACCOUNTANT";

export const SYSTEM_ROLES: { key: SystemRoleKey; nameKey: string }[] = [
  { key: "OWNER", nameKey: "OWNER" },
  { key: "MANAGER", nameKey: "MANAGER" },
  { key: "STAFF", nameKey: "STAFF" },
  { key: "ACCOUNTANT", nameKey: "ACCOUNTANT" },
];

const everything = (level: PermissionLevel): PermissionMap =>
  Object.fromEntries(ALL_ENTITY_KEYS.map((k) => [k, level]));

/** Default matrices for the seeded system roles — mirror the legacy access rules. */
export const DEFAULT_MATRICES: Record<SystemRoleKey, PermissionMap> = {
  // Org creator — full access to everything.
  OWNER: everything("FULL"),

  // Admin — full operational + setup access.
  MANAGER: {
    ...everything("FULL"),
  },

  // Receptionist — front-desk: tenants & reservations, raise invoices/payments/
  // returns, submit expenses; read-only buildings/units; no reports/setup.
  STAFF: {
    buildings: "VIEW", units: "VIEW", tenants: "FULL",
    reservations: "FULL", invoices: "CREATE", payments: "CREATE",
    returns: "CREATE", expenses: "CREATE",
    reports: "NONE", salesTargets: "NONE",
    organization: "NONE", team: "NONE", roles: "NONE",
    settingsReservations: "NONE", settingsPayments: "NONE",
    settingsReturns: "NONE", settingsUnits: "NONE",
    banks: "NONE", expenseCategories: "NONE",
  },

  // Accountant — finance: invoices/payments/returns + process expenses; no
  // tenants/reservations/properties management; no reports/setup.
  ACCOUNTANT: {
    buildings: "NONE", units: "NONE", tenants: "VIEW",
    reservations: "VIEW", invoices: "EDIT", payments: "FULL",
    returns: "EDIT", expenses: "EDIT",
    reports: "NONE", salesTargets: "NONE",
    organization: "NONE", team: "NONE", roles: "NONE",
    settingsReservations: "NONE", settingsPayments: "NONE",
    settingsReturns: "NONE", settingsUnits: "NONE",
    banks: "NONE", expenseCategories: "NONE",
  },
};

/** Normalize a stored JSON map to a complete map (missing keys → NONE). */
export function normalizeMatrix(raw: unknown): PermissionMap {
  const map = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: PermissionMap = {};
  for (const key of ALL_ENTITY_KEYS) {
    const v = map[key];
    out[key] = (typeof v === "string" && (PERMISSION_LEVELS as readonly string[]).includes(v))
      ? (v as PermissionLevel)
      : "NONE";
  }
  return out;
}

/** The level a permission map grants for an entity. */
export function levelFor(map: PermissionMap, entity: string): PermissionLevel {
  return map[entity] ?? "NONE";
}

/** True if `map` grants at least `min` on `entity`. */
export function atLeast(map: PermissionMap, entity: string, min: PermissionLevel): boolean {
  return RANK[levelFor(map, entity)] >= RANK[min];
}

// ── Effective-permission resolution (engine) ──────────────────────────────────

export interface ResolvedAccess {
  perms: PermissionMap;
  isOwner: boolean;
  roleKey: string | null;
}

/**
 * Resolve a user's effective permission map: their assigned custom/system role's
 * matrix when set, otherwise the default matrix for their legacy enum role.
 * OWNER (enum or assigned role key) always has full access.
 */
export function resolvePermissions(
  enumRole: string,
  assignedRole?: { key: string | null; permissions: unknown } | null,
): ResolvedAccess {
  const roleKey = assignedRole?.key ?? null;
  const isOwner = enumRole === "OWNER" || roleKey === "OWNER";
  const perms = assignedRole
    ? normalizeMatrix(assignedRole.permissions)
    : normalizeMatrix(DEFAULT_MATRICES[(enumRole as SystemRoleKey)] ?? {});
  return { perms, isOwner, roleKey };
}

/** Map a permission map → nav-tab visibility. `settings` is governed elsewhere. */
export const NAV_ENTITY: Record<string, string[]> = {
  properties:   ["buildings", "units"],
  tenants:      ["tenants"],
  reservations: ["reservations"],
  invoices:     ["invoices"],
  returns:      ["returns"],
  payments:     ["payments"],
  expenses:     ["expenses"],
  reports:      ["reports"],
  salesTargets: ["salesTargets"],
};

/** Setup entities, each surfaced as a Settings sub-page (nav child). */
export const SETUP_ENTITIES: string[] = [
  "organization", "team", "roles",
  "settingsReservations", "settingsPayments", "settingsReturns",
  "settingsUnits", "banks", "expenseCategories",
];

export function navAccessFor(access: ResolvedAccess): Record<string, boolean> {
  const out: Record<string, boolean> = { dashboard: true };
  for (const [navKey, entities] of Object.entries(NAV_ENTITY)) {
    out[navKey] = access.isOwner || entities.some((e) => atLeast(access.perms, e, "VIEW"));
  }
  // Setup entities: one boolean per entity (Settings sub-pages) plus a
  // `settings` aggregate (the Settings parent shows when any setup is visible).
  let anySetup = false;
  for (const e of SETUP_ENTITIES) {
    const v = access.isOwner || atLeast(access.perms, e, "VIEW");
    out[e] = v;
    if (v) anySetup = true;
  }
  out.settings = access.isOwner || anySetup;
  return out;
}
