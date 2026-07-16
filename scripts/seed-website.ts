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

  // Enrich the site with public content (fields are new/empty → safe to set).
  await prisma.orgWebsite.update({
    where: { organizationId: org.id },
    data: {
      aboutEn: "Boutique short-stay apartments and homes across Salalah — steps from the beach and the Khareef greenery. Warm Omani hospitality, honest prices, and easy WhatsApp booking.",
      aboutAr: "شقق ومنازل مفروشة للإقامة القصيرة في صلالة — على بُعد خطوات من الشاطئ وخضرة الخريف. ضيافة عُمانية أصيلة وأسعار واضحة وحجز سهل عبر واتساب.",
      metaDescriptionEn: "Book short-stay apartments and homes in Salalah. Live availability, seasonal Khareef prices, instant WhatsApp booking.",
      metaDescriptionAr: "احجز شقق ومنازل للإقامة القصيرة في صلالة. توفر مباشر وأسعار موسم الخريف وحجز فوري عبر واتساب.",
      phone: "+968 9000 0000",
      email: "hello@nassayem.example",
      addressEn: "Salalah, Dhofar, Oman",
      addressAr: "صلالة، ظفار، عُمان",
      instagramUrl: "https://instagram.com/",
    },
  });

  // Enrich a few buildings + units with bilingual public content.
  const props = await prisma.property.findMany({
    where: { organizationId: org.id, isActive: true, isArchived: false },
    select: { id: true }, take: 10,
  });
  const BAMEN = ["Free parking", "Wi-Fi", "24/7 reception", "Elevator", "Backup power"];
  for (const p of props) {
    await prisma.property.update({
      where: { id: p.id },
      data: {
        publicDescriptionEn: "A comfortable building in a quiet Salalah neighbourhood, close to the beach, shops and Khareef viewpoints.",
        publicDescriptionAr: "مبنى مريح في حيٍّ هادئ بصلالة، قريب من الشاطئ والمتاجر ومطلات الخريف.",
        amenities: BAMEN,
      },
    });
  }

  const units = await prisma.unit.findMany({
    where: { isActive: true, property: { organizationId: org.id } },
    select: { id: true }, take: 40,
  });
  const UAMEN_EN = ["Air conditioning", "Kitchen", "Washing machine", "Smart TV", "Balcony"];
  const UAMEN_AR = ["تكييف", "مطبخ", "غسالة", "تلفزيون ذكي", "شرفة"];
  for (const u of units) {
    await prisma.unit.update({
      where: { id: u.id },
      data: {
        publicDescriptionEn: "Bright, fully-furnished unit with a comfortable layout — ideal for families visiting during Khareef.",
        publicDescriptionAr: "وحدة مشرقة ومفروشة بالكامل بتصميم مريح — مثالية للعائلات الزائرة خلال الخريف.",
        amenitiesAr: UAMEN_AR,
        maxGuests: 4,
      },
    });
    // Only set English amenities if empty, to avoid clobbering real data.
    const cur = await prisma.unit.findUnique({ where: { id: u.id }, select: { amenities: true } });
    if (!cur?.amenities?.length) {
      await prisma.unit.update({ where: { id: u.id }, data: { amenities: UAMEN_EN } });
    }
  }

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
