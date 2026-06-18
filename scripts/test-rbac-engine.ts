/**
 * Bit 1 — pure permission engine unit tests (no DB).
 * Run: npx tsx scripts/test-rbac-engine.ts
 */
import {
  PERMISSION_LEVELS,
  PERMISSION_GROUPS,
  ALL_ENTITY_KEYS,
  DEFAULT_MATRICES,
  normalizeMatrix,
  levelFor,
  atLeast,
  resolvePermissions,
  navAccessFor,
  NAV_ENTITY,
} from "../lib/rbac";

let pass = 0, fail = 0;
const fails: string[] = [];
function ok(name: string, cond: boolean) {
  if (cond) { pass++; }
  else { fail++; fails.push(name); console.log("  ✗ " + name); }
}

// ── catalog sanity ──────────────────────────────────────────────────────────
ok("levels order NONE<VIEW<CREATE<EDIT<FULL",
  JSON.stringify(PERMISSION_LEVELS) === JSON.stringify(["NONE","VIEW","CREATE","EDIT","FULL"]));
ok("ALL_ENTITY_KEYS = flattened groups",
  ALL_ENTITY_KEYS.length === PERMISSION_GROUPS.flatMap(g=>g.entities).length);
ok("no duplicate entity keys",
  new Set(ALL_ENTITY_KEYS).size === ALL_ENTITY_KEYS.length);
ok("18 entities catalogued", ALL_ENTITY_KEYS.length === 18);

// ── atLeast / levelFor hierarchy ────────────────────────────────────────────
const m = { invoices: "CREATE" as const };
ok("atLeast CREATE>=VIEW", atLeast(m, "invoices", "VIEW"));
ok("atLeast CREATE>=CREATE", atLeast(m, "invoices", "CREATE"));
ok("atLeast CREATE< EDIT (false)", !atLeast(m, "invoices", "EDIT"));
ok("levelFor missing → NONE", levelFor({}, "whatever") === "NONE");
ok("atLeast missing entity VIEW (false)", !atLeast({}, "ghost", "VIEW"));

// ── normalizeMatrix ─────────────────────────────────────────────────────────
const norm = normalizeMatrix({ invoices: "EDIT", junk: "FOO", extra: 5 });
ok("normalize fills all keys", Object.keys(norm).length === ALL_ENTITY_KEYS.length);
ok("normalize keeps valid", norm.invoices === "EDIT");
ok("normalize invalid value → NONE", norm.buildings === "NONE");
ok("normalize ignores unknown keys", !("junk" in norm));
ok("normalize null → all NONE", Object.values(normalizeMatrix(null)).every(v=>v==="NONE"));

// ── DEFAULT_MATRICES integrity ──────────────────────────────────────────────
ok("OWNER all FULL", ALL_ENTITY_KEYS.every(k => DEFAULT_MATRICES.OWNER[k] === "FULL"));
ok("MANAGER all FULL", ALL_ENTITY_KEYS.every(k => DEFAULT_MATRICES.MANAGER[k] === "FULL"));
ok("STAFF reservations FULL", DEFAULT_MATRICES.STAFF.reservations === "FULL");
ok("STAFF invoices CREATE", DEFAULT_MATRICES.STAFF.invoices === "CREATE");
ok("STAFF buildings VIEW", DEFAULT_MATRICES.STAFF.buildings === "VIEW");
ok("STAFF reports NONE", DEFAULT_MATRICES.STAFF.reports === "NONE");
ok("STAFF setup(roles) NONE", DEFAULT_MATRICES.STAFF.roles === "NONE");
ok("ACCOUNTANT payments FULL", DEFAULT_MATRICES.ACCOUNTANT.payments === "FULL");
ok("ACCOUNTANT invoices EDIT", DEFAULT_MATRICES.ACCOUNTANT.invoices === "EDIT");
ok("ACCOUNTANT buildings NONE", DEFAULT_MATRICES.ACCOUNTANT.buildings === "NONE");
ok("ACCOUNTANT tenants VIEW", DEFAULT_MATRICES.ACCOUNTANT.tenants === "VIEW");
ok("ACCOUNTANT reports NONE", DEFAULT_MATRICES.ACCOUNTANT.reports === "NONE");
// every default matrix is complete (no missing entity)
for (const rk of ["OWNER","MANAGER","STAFF","ACCOUNTANT"] as const) {
  ok(`${rk} matrix complete`, ALL_ENTITY_KEYS.every(k => k in DEFAULT_MATRICES[rk]));
}

// ── resolvePermissions ──────────────────────────────────────────────────────
// enum OWNER, no assigned role → owner + full
const rOwner = resolvePermissions("OWNER", null);
ok("resolve enum OWNER isOwner", rOwner.isOwner === true);
ok("resolve enum OWNER perms FULL", rOwner.perms.invoices === "FULL");

// enum STAFF, no assigned role → default STAFF matrix, not owner
const rStaff = resolvePermissions("STAFF", null);
ok("resolve enum STAFF not owner", rStaff.isOwner === false);
ok("resolve enum STAFF reservations FULL", rStaff.perms.reservations === "FULL");
ok("resolve enum STAFF reports NONE", rStaff.perms.reports === "NONE");

// assigned custom role overrides enum
const rCustom = resolvePermissions("STAFF", { key: null, permissions: { invoices: "VIEW" } });
ok("resolve custom role uses its matrix", rCustom.perms.invoices === "VIEW");
ok("resolve custom role normalizes missing → NONE", rCustom.perms.reservations === "NONE");
ok("resolve custom role not owner", rCustom.isOwner === false);

// assigned role with key OWNER → owner even if enum differs
const rAssignedOwner = resolvePermissions("STAFF", { key: "OWNER", permissions: {} });
ok("resolve assigned OWNER key → isOwner", rAssignedOwner.isOwner === true);

// unknown enum role → empty matrix (all NONE), safe default
const rUnknown = resolvePermissions("BOGUS", null);
ok("resolve unknown enum → all NONE", Object.values(rUnknown.perms).every(v=>v==="NONE"));
ok("resolve unknown enum not owner", rUnknown.isOwner === false);

// ── navAccessFor ────────────────────────────────────────────────────────────
const navOwner = navAccessFor(rOwner);
ok("nav owner sees everything", Object.keys(NAV_ENTITY).every(k => navOwner[k] === true));
ok("nav always has dashboard", navOwner.dashboard === true);

const navStaff = navAccessFor(rStaff);
ok("nav STAFF sees reservations", navStaff.reservations === true);
ok("nav STAFF sees properties (buildings VIEW)", navStaff.properties === true);
ok("nav STAFF hides reports", navStaff.reports === false);
ok("nav STAFF hides salesTargets", navStaff.salesTargets === false);

const navAcct = navAccessFor(rStaff /*placeholder*/);
const rAcct = resolvePermissions("ACCOUNTANT", null);
const navA = navAccessFor(rAcct);
ok("nav ACCOUNTANT hides properties (buildings NONE & units NONE)", navA.properties === false);
ok("nav ACCOUNTANT sees invoices", navA.invoices === true);
ok("nav ACCOUNTANT sees payments", navA.payments === true);
ok("nav ACCOUNTANT hides reports", navA.reports === false);

// custom None-everything role → nav shows only dashboard
const rNone = resolvePermissions("CUSTOM", { key: null, permissions: {} });
const navNone = navAccessFor(rNone);
ok("nav all-NONE custom → dashboard only",
  navNone.dashboard === true && Object.keys(NAV_ENTITY).every(k => navNone[k] === false));

// properties nav = buildings OR units (VIEW on either is enough)
const rUnitsOnly = resolvePermissions("CUSTOM", { key: null, permissions: { units: "VIEW" } });
ok("nav properties via units-only VIEW", navAccessFor(rUnitsOnly).properties === true);

console.log(`\nBit 1 — engine: ${pass} passed, ${fail} failed`);
if (fail) { console.log("FAILED:", fails.join(", ")); process.exit(1); }
