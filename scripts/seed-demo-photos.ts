/**
 * Dev-only: assign curated Unsplash photos to the demo org's buildings + units so
 * the image-forward public template renders realistically. Real orgs upload their
 * own via the PMS. Run: PRISMA_USE_DIRECT_URL=1 npx tsx scripts/seed-demo-photos.ts
 */
import { prisma } from "@/lib/prisma";

const u = (id: string, w: number) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

// Exteriors / coastal / hotel — for buildings + the home hero.
const BUILDINGS = [
  "1566073771259-6a8506099945", "1564501049412-61c2a3083791", "1582719478250-c89cae4dc85b",
  "1507525428034-b723cf961d3e", "1512917774080-9991f1c4c750", "1590490360182-c33d57733427",
  "1520250497591-112f2f40a3f4", "1580587771525-78b9dba3b914",
];
// Interiors / rooms — for units.
const UNITS = [
  "1571896349842-33c89424de2d", "1502672260266-1c1ef2d93688", "1493809842364-78817add7ffb",
  "1522708323590-d24dbb6b0267", "1560448204-e02f11c3d0e2", "1560185007-cde436f6a4d0",
  "1522771739844-6a9f6d5f14af", "1505693416388-ac5ce068fe85", "1600585154340-be6161a56a0c",
  "1600607687939-ce8a6c25118c", "1618221195710-dd6b41faaea6", "1616486338812-3dadae4b4ace",
];
const pick = (arr: string[], start: number, n: number, w: number) =>
  Array.from({ length: n }, (_, i) => u(arr[(start + i) % arr.length], w));

async function main() {
  const site = await prisma.orgWebsite.findFirst({ where: { slug: "demo" }, select: { organizationId: true } });
  if (!site) throw new Error("demo site not found");
  const orgId = site.organizationId;

  const props = await prisma.property.findMany({
    where: { organizationId: orgId, isArchived: false }, select: { id: true }, orderBy: { name: "asc" },
  });
  for (let i = 0; i < props.length; i++) {
    await prisma.property.update({ where: { id: props[i].id }, data: { photos: pick(BUILDINGS, i, 4, 1600) } });
  }

  const units = await prisma.unit.findMany({
    where: { property: { organizationId: orgId } }, select: { id: true }, orderBy: { name: "asc" },
  });
  for (let i = 0; i < units.length; i++) {
    await prisma.unit.update({ where: { id: units[i].id }, data: { photos: pick(UNITS, i * 2, 4, 1200) } });
  }

  await prisma.orgWebsite.update({
    where: { organizationId: orgId },
    data: { ogImageUrl: u("1566073771259-6a8506099945", 1200) },
  });

  console.log(`✓ photos assigned: ${props.length} buildings, ${units.length} units`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
