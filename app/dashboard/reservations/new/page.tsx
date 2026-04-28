import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/FormComponents";
import BookingEngine from "@/components/dashboard/BookingEngine";
import Link from "next/link";

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ unitId?: string; tenantId?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { organizationId: true },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");

  const properties = await prisma.property.findMany({
    where:   { organizationId: dbUser.organizationId, isArchived: false, isActive: true },
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Need at least one property + one tenant
  const tenantCount = await prisma.tenant.count({
    where: { organizationId: dbUser.organizationId },
  });

  // Pre-selection from query params (e.g. coming from a unit detail or tenant
  // detail page). Both are validated against the org so we never leak a tenant
  // or unit from another company through a URL guess.
  const { unitId, tenantId } = await searchParams;

  const [defaultTenant, defaultUnit] = await Promise.all([
    tenantId
      ? prisma.tenant.findFirst({
          where:  { id: tenantId, organizationId: dbUser.organizationId },
          select: {
            id: true, firstName: true, lastName: true,
            phone: true, email: true,
            classification: true, nationality: true,
          },
        })
      : null,
    unitId
      ? prisma.unit.findFirst({
          where:  { id: unitId, property: { organizationId: dbUser.organizationId } },
          select: { id: true, propertyId: true },
        })
      : null,
  ]);

  const t = await getTranslations("reservations.newPage");

  if (properties.length === 0 || tenantCount === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4 px-4">
        <div className="text-4xl">🏗️</div>
        <h3 className="text-lg font-bold text-gray-900">{t("setupRequiredHeading")}</h3>
        <p className="text-gray-500">
          {t.rich("setupRequiredBody", { strong: (chunks) => <strong>{chunks}</strong> })}
        </p>
        <div className="flex justify-center gap-4 pt-2">
          <Link href="/dashboard/properties/new" className="text-sm text-blue-600 hover:underline font-medium">
            {t("addProperty")}
          </Link>
          <Link href="/dashboard/tenants/new" className="text-sm text-blue-600 hover:underline font-medium">
            {t("addTenant")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        listHref="/dashboard/reservations"
      />
      <BookingEngine
        properties={properties}
        defaultTenant={defaultTenant}
        defaultPropertyId={defaultUnit?.propertyId}
        defaultUnitId={defaultUnit?.id}
      />
    </div>
  );
}
