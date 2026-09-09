import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { assertView } from "@/lib/access";
import { DataImportWizard } from "@/components/dashboard/data-import/DataImportWizard";

export default async function DataImportPage() {
  await assertView("dataImport");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");

  const [buildingCount, unitCount, tenantCount, reservationCount, expenseCount] = await Promise.all([
    prisma.property.count({ where: { organizationId: dbUser.organizationId } }),
    prisma.unit.count({ where: { property: { organizationId: dbUser.organizationId } } }),
    prisma.tenant.count({ where: { organizationId: dbUser.organizationId } }),
    prisma.reservation.count({ where: { organizationId: dbUser.organizationId } }),
    prisma.expense.count({ where: { organizationId: dbUser.organizationId } }),
  ]);

  return (
    <DataImportWizard
      counts={{
        BUILDINGS: buildingCount,
        UNITS: unitCount,
        TENANTS: tenantCount,
        RESERVATIONS: reservationCount,
        EXPENSES: expenseCount,
      }}
    />
  );
}
