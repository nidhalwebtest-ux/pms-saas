/**
 * Dev helper: publish a public booking site for an existing org so we can test
 * subdomain resolution locally at {slug}.localhost:3000.
 *
 * Run: PRISMA_USE_DIRECT_URL=1 npx tsx scripts/seed-website.ts [slug]
 */
import { prisma } from "@/lib/prisma";

async function main() {
  const slug = (process.argv[2] || "demo").toLowerCase();

  // Prefer an org that actually has an active, non-archived building with units.
  const org =
    (await prisma.organization.findFirst({
      where: { properties: { some: { isActive: true, isArchived: false, units: { some: { isActive: true } } } } },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.organization.findFirst({ select: { id: true, name: true }, orderBy: { createdAt: "asc" } }));

  if (!org) throw new Error("No organization found — create one in the app first.");

  const site = await prisma.orgWebsite.upsert({
    where: { organizationId: org.id },
    update: { slug, status: "PUBLISHED", publishedAt: new Date() },
    create: {
      organizationId: org.id,
      slug,
      status: "PUBLISHED",
      templateKey: "template_1",
      primaryColor: "#0E7490",
      accentColor: "#F59E0B",
      siteNameEn: org.name,
      siteNameAr: org.name,
      taglineEn: "Your stay in Salalah",
      taglineAr: "إقامتك في صلالة",
      whatsappNumber: "96890000000",
      defaultLanguage: "ar",
      showPrices: true,
      khareefBannerEnabled: true,
      publishedAt: new Date(),
    },
  });

  const buildings = await prisma.property.count({
    where: { organizationId: org.id, isActive: true, isArchived: false },
  });

  console.log("✅ Published site:");
  console.log(`   org:        ${org.name} (${org.id})`);
  console.log(`   slug:       ${site.slug}`);
  console.log(`   buildings:  ${buildings}`);
  console.log(`   local URL:  http://${site.slug}.localhost:3000`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
