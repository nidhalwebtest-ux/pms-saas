import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { getTranslations } from "next-intl/server";
import TenantLedgerSearch from "./TenantLedgerSearch";

export default async function TenantLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ tenantId?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { organizationId: true },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");

  const { tenantId } = await searchParams;

  // If a tenantId is pre-selected, fetch tenant details for the header
  let selectedTenant: { id: string; firstName: string; lastName: string; phone: string } | null = null;
  if (tenantId) {
    const t = await prisma.tenant.findUnique({
      where:  { id: tenantId },
      select: { id: true, firstName: true, lastName: true, phone: true, organizationId: true },
    });
    if (t && t.organizationId === dbUser.organizationId) {
      selectedTenant = t;
    }
  }

  const t = await getTranslations("tenants.ledgerPage");

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page header */}
      <div className="mb-6 flex items-center gap-4">
        <Link href="/dashboard/tenants" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeftIcon className="h-5 w-5 text-gray-500 rtl:rotate-180" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t("description")}</p>
        </div>
      </div>

      <TenantLedgerSearch
        orgId={dbUser.organizationId}
        preselectedTenant={selectedTenant}
      />
    </div>
  );
}
