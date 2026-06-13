import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import OrgSettingsForm from "./OrgSettingsForm";

export default async function OrganizationSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { organizationId: true },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");

  const org = await prisma.organization.findUnique({
    where:  { id: dbUser.organizationId },
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      city: true,
      area: true,
      logo: true,
      timezone: true,
      currency: true,
      pdfBrandColor: true,
      pdfFooterText: true,
      pdfFooterTextAr: true,
      pdfPaperSize: true,
      pdfShowLogo: true,
      pdfShowSignature: true,
      pdfShowPaymentHistory: true,
      pdfShowNotes: true,
    },
  });
  if (!org) redirect("/onboarding");

  const t = await getTranslations("settings.organization");

  return (
    <div className="mx-auto max-w-3xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <BuildingOffice2Icon className="h-6 w-6 text-blue-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>
      </div>

      <OrgSettingsForm
        org={{
          name:     org.name,
          phone:    org.phone ?? "",
          address:  org.address ?? "",
          city:     org.city,
          area:     org.area ?? "",
          logo:     org.logo,
          timezone: org.timezone,
          currency: org.currency,
          pdfBrandColor:         org.pdfBrandColor,
          pdfFooterText:         org.pdfFooterText ?? "",
          pdfFooterTextAr:       org.pdfFooterTextAr ?? "",
          pdfPaperSize:          org.pdfPaperSize,
          pdfShowLogo:           org.pdfShowLogo,
          pdfShowSignature:      org.pdfShowSignature,
          pdfShowPaymentHistory: org.pdfShowPaymentHistory,
          pdfShowNotes:          org.pdfShowNotes,
        }}
      />
    </div>
  );
}
