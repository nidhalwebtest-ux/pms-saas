import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { EMPTY_FORM, type WebsiteForm, type WebsiteStatus, type TemplateKey } from "./types";
import WebsiteWizard from "./WebsiteWizard";

export const dynamic = "force-dynamic";

const ROOT_DOMAIN = "binaya.app";

export default async function WebsiteSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id }, select: { organizationId: true },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");
  const orgId = dbUser.organizationId;

  const [site, org, buildingCount, unitCount] = await Promise.all([
    prisma.orgWebsite.findUnique({ where: { organizationId: orgId } }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, logo: true } }),
    prisma.property.count({ where: { organizationId: orgId, isActive: true, isArchived: false } }),
    prisma.unit.count({ where: { isActive: true, property: { organizationId: orgId, isArchived: false } } }),
  ]);

  // Seed the form: existing config, or sensible defaults from the org.
  const form: WebsiteForm = site
    ? {
        slug: site.slug.startsWith("site-") ? "" : site.slug,
        templateKey: site.templateKey as TemplateKey,
        logoUrl: site.logoUrl ?? org?.logo ?? null,
        primaryColor: site.primaryColor,
        accentColor: site.accentColor,
        siteNameEn: site.siteNameEn ?? "", siteNameAr: site.siteNameAr ?? "",
        taglineEn: site.taglineEn ?? "", taglineAr: site.taglineAr ?? "",
        aboutEn: site.aboutEn ?? "", aboutAr: site.aboutAr ?? "",
        whatsappNumber: site.whatsappNumber ?? "", phone: site.phone ?? "", email: site.email ?? "",
        addressEn: site.addressEn ?? "", addressAr: site.addressAr ?? "",
        googleMapsUrl: site.googleMapsUrl ?? "", instagramUrl: site.instagramUrl ?? "",
        metaDescriptionEn: site.metaDescriptionEn ?? "", metaDescriptionAr: site.metaDescriptionAr ?? "",
        ogImageUrl: site.ogImageUrl ?? null,
        defaultLanguage: site.defaultLanguage === "en" ? "en" : "ar",
        showPrices: site.showPrices, khareefBannerEnabled: site.khareefBannerEnabled,
      }
    : {
        ...EMPTY_FORM,
        siteNameEn: org?.name ?? "",
        siteNameAr: org?.name ?? "",
        logoUrl: org?.logo ?? null,
      };

  return (
    <WebsiteWizard
      initialForm={form}
      status={(site?.status ?? null) as WebsiteStatus | null}
      publishedAt={site?.publishedAt ? site.publishedAt.toISOString() : null}
      rootDomain={ROOT_DOMAIN}
      stats={{ buildings: buildingCount, units: unitCount }}
    />
  );
}
