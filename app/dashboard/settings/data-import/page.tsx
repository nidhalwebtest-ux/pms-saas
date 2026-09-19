import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { assertView } from "@/lib/access";
import { DataImportWizard } from "@/components/dashboard/data-import/DataImportWizard";
import { JobHistory } from "@/components/dashboard/data-import/JobHistory";

export default async function DataImportPage({
  searchParams,
}: {
  searchParams: Promise<{ resumeJobId?: string }>;
}) {
  await assertView("dataImport");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");

  const { resumeJobId } = await searchParams;

  const [buildingCount, unitCount, tenantCount, reservationCount, expenseCount, resumeJob] = await Promise.all([
    prisma.property.count({ where: { organizationId: dbUser.organizationId } }),
    prisma.unit.count({ where: { property: { organizationId: dbUser.organizationId } } }),
    prisma.tenant.count({ where: { organizationId: dbUser.organizationId } }),
    prisma.reservation.count({ where: { organizationId: dbUser.organizationId } }),
    prisma.expense.count({ where: { organizationId: dbUser.organizationId } }),
    // Re-import (from the history view) lands here with ?resumeJobId= — must
    // belong to this org, same check every /api/import-jobs/[id]/* route uses.
    resumeJobId
      ? prisma.importJob.findFirst({
          where: { id: resumeJobId, organizationId: dbUser.organizationId },
          select: { id: true, recordType: true },
        })
      : null,
  ]);

  return (
    <div className="space-y-8">
      <DataImportWizard
        counts={{
          BUILDINGS: buildingCount,
          UNITS: unitCount,
          TENANTS: tenantCount,
          RESERVATIONS: reservationCount,
          EXPENSES: expenseCount,
        }}
        resumeJob={resumeJob ?? undefined}
      />
      <JobHistory />
    </div>
  );
}
