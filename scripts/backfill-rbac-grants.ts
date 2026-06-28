/**
 * One-time backfill: extend every Role.permissions JSON with the newly-added
 * catalog keys (reconciliation/banks if missing, the 25 per-report toggles, and
 * the granular action toggles), preserving current behavior.
 *
 *  - System roles  → reset to normalizeMatrix(DEFAULT_MATRICES[key]) (authoritative
 *    template; also fixes the missing reconciliation/banks keys).
 *  - Custom roles  → extendStoredMatrix(raw): keep all explicit levels, derive the
 *    new report/action grants from the role's existing coarse permissions.
 *
 * Run dry first:   PRISMA_USE_DIRECT_URL=1 npx tsx scripts/backfill-rbac-grants.ts --dry
 * Then for real:   PRISMA_USE_DIRECT_URL=1 npx tsx scripts/backfill-rbac-grants.ts
 */
import { prisma } from "../lib/prisma";
import {
  DEFAULT_MATRICES, normalizeMatrix, extendStoredMatrix,
  REPORT_ENTITY_KEYS, ACTION_ENTITY_KEYS, type SystemRoleKey, type PermissionMap,
} from "../lib/rbac";

const DRY = process.argv.includes("--dry");

function diffKeys(before: Record<string, unknown>, after: PermissionMap): string[] {
  const changed: string[] = [];
  for (const k of [...REPORT_ENTITY_KEYS, ...ACTION_ENTITY_KEYS, "reconciliation", "banks"]) {
    const b = typeof before[k] === "string" ? before[k] : "(absent)";
    if (b !== after[k]) changed.push(`${k}:${b}->${after[k]}`);
  }
  return changed;
}

async function main() {
  const roles = await prisma.role.findMany({
    select: { id: true, name: true, key: true, isSystem: true, permissions: true, _count: { select: { users: true } } },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });

  let updated = 0;
  for (const r of roles) {
    const raw = (r.permissions ?? {}) as Record<string, unknown>;
    const next = r.isSystem
      ? normalizeMatrix(DEFAULT_MATRICES[(r.key as SystemRoleKey)] ?? {})
      : extendStoredMatrix(raw);

    const changes = diffKeys(raw, next);
    const reportsOn = REPORT_ENTITY_KEYS.filter((k) => next[k] !== "NONE").length;
    const actionsOn = ACTION_ENTITY_KEYS.filter((k) => next[k] !== "NONE").length;
    console.log(
      `\n${r.isSystem ? "[sys]" : "[cst]"} ${r.name} (key=${r.key ?? "—"}, users=${r._count.users}) ` +
      `→ reports ${reportsOn}/${REPORT_ENTITY_KEYS.length} on, actions ${actionsOn}/${ACTION_ENTITY_KEYS.length} on`,
    );
    if (changes.length) console.log("   changes:", changes.join(", "));

    if (!DRY) {
      await prisma.role.update({ where: { id: r.id }, data: { permissions: next } });
      updated++;
    }
  }

  console.log(`\n${DRY ? "[DRY RUN] would update" : "Updated"} ${DRY ? roles.length : updated} role(s).`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
