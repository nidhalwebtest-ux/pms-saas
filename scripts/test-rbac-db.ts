/**
 * Bit 2 — live DB inspection (read-only): system roles, users, assignments.
 * Run: PRISMA_USE_DIRECT_URL=1 npx tsx --env-file=.env scripts/test-rbac-db.ts
 */
import { prisma } from "../lib/prisma";
import { DEFAULT_MATRICES, normalizeMatrix, ALL_ENTITY_KEYS } from "../lib/rbac";

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  console.log(`Organizations: ${orgs.length}\n`);

  for (const org of orgs) {
    console.log(`━━ ${org.name} (${org.id})`);
    const roles = await prisma.role.findMany({
      where: { organizationId: org.id },
      select: { id: true, name: true, key: true, isSystem: true, permissions: true,
                _count: { select: { users: true } } },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
    const systemRoles = roles.filter(r => r.isSystem);
    const customRoles = roles.filter(r => !r.isSystem);

    if (systemRoles.length === 0) {
      console.log("  (no system roles seeded yet — lazy-seeds on Roles page visit)");
    }
    // Verify each seeded system role matches DEFAULT_MATRICES exactly
    for (const r of systemRoles) {
      const expected = normalizeMatrix(DEFAULT_MATRICES[(r.key as keyof typeof DEFAULT_MATRICES)] ?? {});
      const actual = normalizeMatrix(r.permissions);
      const drift = ALL_ENTITY_KEYS.filter(k => expected[k] !== actual[k]);
      const status = drift.length === 0 ? "✓ matches default" : `✗ DRIFT: ${drift.map(k=>`${k}(${actual[k]}≠${expected[k]})`).join(", ")}`;
      console.log(`  [system] ${r.name} key=${r.key} members=${r._count.users} ${status}`);
    }
    for (const r of customRoles) {
      const lvls = normalizeMatrix(r.permissions);
      const summary = ALL_ENTITY_KEYS.filter(k => lvls[k] !== "NONE").map(k => `${k}:${lvls[k]}`).join(", ") || "(all NONE)";
      console.log(`  [custom] ${r.name} members=${r._count.users} → ${summary}`);
    }

    // Users + their effective role
    const users = await prisma.user.findMany({
      where: { organizationId: org.id },
      select: { id: true, email: true, role: true,
                assignedRole: { select: { name: true, key: true } } },
    });
    console.log(`  Users: ${users.length}`);
    for (const u of users) {
      const assigned = u.assignedRole ? `${u.assignedRole.name}${u.assignedRole.key?` (${u.assignedRole.key})`:" [custom]"}` : "— none (enum fallback)";
      console.log(`    • ${u.email}  enum=${u.role}  assignedRole=${assigned}`);
    }

    // Property assignments (building scope)
    const assignments = await prisma.propertyAssignment.findMany({
      where: { property: { organizationId: org.id } },
      select: { userId: true, property: { select: { name: true } } },
    });
    const byUser = new Map<string, string[]>();
    for (const a of assignments) {
      const arr = byUser.get(a.userId) ?? [];
      arr.push(a.property.name);
      byUser.set(a.userId, arr);
    }
    const totalProps = await prisma.property.count({ where: { organizationId: org.id } });
    console.log(`  Building scope (${totalProps} buildings total):`);
    if (byUser.size === 0) {
      console.log("    (no assignments — all users unrestricted)");
    } else {
      for (const [uid, names] of byUser) {
        const email = users.find(u => u.id === uid)?.email ?? uid;
        console.log(`    • ${email} → ${names.length}/${totalProps}: ${names.join(", ")}`);
      }
    }
    console.log("");
  }
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
