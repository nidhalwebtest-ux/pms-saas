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

// `kind` controls how the entity renders in the role editor: "crud" → a
// None/View/Create/Edit/Full selector; "toggle" → an on/off checkbox (used by
// per-report and per-action permissions). `sub` groups toggles under a subheader.
export interface EntityDef { key: string; kind?: "crud" | "toggle"; sub?: string }
export interface PermissionGroup { key: string; entities: EntityDef[] }

// ── Per-report permission keys ────────────────────────────────────────────────
// Each report is individually permissionable (a user may see Occupancy but not
// Revenue). Keep these slugs in sync with app/dashboard/reports/reports-config.ts.
export function reportKey(slug: string): string { return `report:${slug}`; }
export function reportSlug(key: string): string | null {
  return key.startsWith("report:") ? key.slice("report:".length) : null;
}

export const REPORT_GROUP_SLUGS: { group: string; slugs: string[] }[] = [
  { group: "revenue",     slugs: ["revenue-by-building", "revenue-by-tenant", "revenue-by-unit-type", "revenue-by-source", "revenue-trend", "revenue-comparison"] },
  { group: "occupancy",   slugs: ["occupancy-by-building", "occupancy-trend", "vacancy-analysis", "avg-length-of-stay", "khareef-performance"] },
  { group: "financial",   slugs: ["aging-receivables", "outstanding-balances", "cash-flow", "pnl-by-building", "expense-breakdown"] },
  { group: "operational", slugs: ["receptionist-performance", "tenant-reports", "maintenance", "booking-sources", "cancellation-analysis", "target-vs-actual"] },
  { group: "tax",         slugs: ["vat-summary", "revenue-by-month", "annual-summary"] },
];
export const REPORT_ENTITY_KEYS: string[] = REPORT_GROUP_SLUGS.flatMap((g) => g.slugs.map(reportKey));

// ── Granular action permission keys (non-CRUD; rendered as on/off toggles) ─────
export const ACTION_GROUPS: { group: string; keys: string[] }[] = [
  { group: "expenses",     keys: ["expenseApprove", "expenseProcess"] },
  { group: "cashier",      keys: ["depositCreate", "depositDelete", "cashUnlock"] },
  { group: "invoices",     keys: ["invoiceIssue", "invoiceCancel"] },
  { group: "payments",     keys: ["paymentRefund"] },
  { group: "reservations", keys: ["resCheckIn", "resCheckOut", "resCancel", "resNoShow"] },
  { group: "returns",      keys: ["returnApprove"] },
];
export const ACTION_ENTITY_KEYS: string[] = ACTION_GROUPS.flatMap((g) => g.keys);

const reportEntities: EntityDef[] = REPORT_GROUP_SLUGS.flatMap((g) =>
  g.slugs.map((s) => ({ key: reportKey(s), kind: "toggle" as const, sub: g.group })),
);
const actionEntities: EntityDef[] = ACTION_GROUPS.flatMap((g) =>
  g.keys.map((k) => ({ key: k, kind: "toggle" as const, sub: g.group })),
);

/** The full catalog of records/transactions/actions/reports/setup, grouped for the UI. */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: "lists",
    entities: [{ key: "buildings" }, { key: "units" }, { key: "tenants" }],
  },
  {
    key: "transactions",
    entities: [
      { key: "reservations" }, { key: "invoices" }, { key: "payments" },
      { key: "returns" }, { key: "expenses" }, { key: "reconciliation" },
    ],
  },
  {
    key: "actions",
    entities: actionEntities,
  },
  {
    key: "reports",
    entities: [...reportEntities, { key: "salesTargets" }],
  },
  {
    key: "setup",
    entities: [
      { key: "organization" }, { key: "team" }, { key: "roles" },
      { key: "settingsReservations" }, { key: "settingsPayments" },
      { key: "settingsReturns" }, { key: "settingsUnits" },
      { key: "settingsWebsite" },
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

/**
 * Derive the per-report + per-action grants implied by a base CRUD matrix.
 * Used to (a) seed the system-role defaults and (b) backfill existing roles so
 * they keep their current behavior when these granular permissions are added.
 * A granular permission is "on" (FULL) when the base matrix already authorized
 * the corresponding action under the old coarse rules.
 */
export function deriveExtendedGrants(base: PermissionMap): PermissionMap {
  const ON: PermissionLevel = "FULL", OFF: PermissionLevel = "NONE";
  const out: PermissionMap = {};
  const repOn = atLeast(base, "reports", "VIEW") ? ON : OFF;
  for (const k of REPORT_ENTITY_KEYS) out[k] = repOn;
  out.expenseApprove = atLeast(base, "expenses", "EDIT") ? ON : OFF;
  out.expenseProcess = atLeast(base, "expenses", "EDIT") ? ON : OFF;
  out.depositCreate  = atLeast(base, "reconciliation", "CREATE") ? ON : OFF;
  out.depositDelete  = atLeast(base, "reconciliation", "FULL") ? ON : OFF;
  out.cashUnlock     = atLeast(base, "reconciliation", "FULL") ? ON : OFF;
  out.invoiceIssue   = atLeast(base, "invoices", "CREATE") ? ON : OFF;
  out.invoiceCancel  = atLeast(base, "invoices", "CREATE") ? ON : OFF;
  // Refund pay-out lives in the returns module (legacy gate: returns CREATE).
  out.paymentRefund  = atLeast(base, "returns", "CREATE") ? ON : OFF;
  out.resCheckIn     = atLeast(base, "reservations", "CREATE") ? ON : OFF;
  out.resCheckOut    = atLeast(base, "reservations", "CREATE") ? ON : OFF;
  out.resCancel      = atLeast(base, "reservations", "CREATE") ? ON : OFF;
  out.resNoShow      = atLeast(base, "reservations", "CREATE") ? ON : OFF;
  out.returnApprove  = atLeast(base, "returns", "CREATE") ? ON : OFF;
  return out;
}

const withDerived = (base: PermissionMap): PermissionMap => ({ ...base, ...deriveExtendedGrants(base) });

/** Default matrices for the seeded system roles — mirror the legacy access rules. */
export const DEFAULT_MATRICES: Record<SystemRoleKey, PermissionMap> = {
  // Org creator — full access to everything (incl. all reports + actions).
  OWNER: everything("FULL"),

  // Admin — full operational + setup access.
  MANAGER: everything("FULL"),

  // Receptionist — front-desk: tenants & reservations, raise invoices/payments/
  // returns, submit expenses; read-only buildings/units; no reports/setup.
  STAFF: withDerived({
    buildings: "VIEW", units: "VIEW", tenants: "FULL",
    reservations: "FULL", invoices: "CREATE", payments: "CREATE",
    returns: "CREATE", expenses: "CREATE", reconciliation: "CREATE",
    reports: "NONE", salesTargets: "NONE",
    organization: "NONE", team: "NONE", roles: "NONE",
    settingsReservations: "NONE", settingsPayments: "NONE",
    settingsReturns: "NONE", settingsUnits: "NONE", settingsWebsite: "NONE",
    banks: "NONE", expenseCategories: "NONE",
  }),

  // Accountant — finance: invoices/payments/returns + process expenses; no
  // tenants/reservations/properties management; no reports/setup.
  ACCOUNTANT: withDerived({
    buildings: "NONE", units: "NONE", tenants: "VIEW",
    reservations: "VIEW", invoices: "EDIT", payments: "FULL",
    returns: "EDIT", expenses: "EDIT", reconciliation: "FULL",
    reports: "NONE", salesTargets: "NONE",
    organization: "NONE", team: "NONE", roles: "NONE",
    settingsReservations: "NONE", settingsPayments: "NONE",
    settingsReturns: "NONE", settingsUnits: "NONE", settingsWebsite: "NONE",
    banks: "NONE", expenseCategories: "NONE",
  }),
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

/**
 * Backfill helper: extend a stored matrix with derived report/action grants,
 * preserving any explicitly-stored levels (incl. the legacy single `reports`
 * key, read to seed the per-report toggles). Used by the one-time migration.
 */
export function extendStoredMatrix(raw: unknown): PermissionMap {
  const map = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const base = normalizeMatrix(raw);
  const legacyReports = typeof map.reports === "string" ? (map.reports as PermissionLevel) : "NONE";
  const derived = deriveExtendedGrants({ ...base, reports: legacyReports });
  const out: PermissionMap = { ...base };
  for (const k of [...REPORT_ENTITY_KEYS, ...ACTION_ENTITY_KEYS]) {
    const explicit = map[k];
    out[k] = (typeof explicit === "string" && (PERMISSION_LEVELS as readonly string[]).includes(explicit))
      ? (explicit as PermissionLevel)
      : derived[k];
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
  cashier:      ["reconciliation", "banks"],
  reports:      REPORT_ENTITY_KEYS,
  salesTargets: ["salesTargets"],
};

/** Setup entities, each surfaced as a Settings sub-page (nav child). */
// Entities that map to a Settings sub-page (drives the Settings nav aggregate).
// `banks` is a Setup-group permission but lives under the "Cashier & Bank" nav
// group, so it is intentionally excluded here.
export const SETUP_ENTITIES: string[] = [
  "organization", "team", "roles",
  "settingsReservations", "settingsPayments", "settingsReturns",
  "settingsUnits", "settingsWebsite", "expenseCategories",
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
