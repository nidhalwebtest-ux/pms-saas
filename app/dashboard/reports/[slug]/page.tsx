import { notFound, redirect } from "next/navigation";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { findReport, resolvePreset } from "../reports-config";
import { getRevenueByBuilding } from "@/lib/reports/revenue-by-building";
import RevenueByBuilding from "./RevenueByBuilding";
import ComingSoon from "./ComingSoon";

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const { slug } = await params;
  const report = findReport(slug);
  if (!report) notFound();

  if (slug !== "revenue-by-building") {
    return <ComingSoon slug={slug} />;
  }

  let orgUser: Awaited<ReturnType<typeof requireOrgUser>>;
  try {
    orgUser = await requireOrgUser();
  } catch {
    redirect("/login");
  }

  const sp = await searchParams;
  const range = resolvePreset(sp.preset ?? "month", new Date(), sp.from, sp.to);
  const propertyId = sp.propertyId || undefined;

  const [data, properties] = await Promise.all([
    getRevenueByBuilding({
      orgId: orgUser.organizationId,
      from: new Date(range.from),
      to: new Date(range.to),
      propertyId,
    }),
    prisma.property.findMany({
      where: { organizationId: orgUser.organizationId, isArchived: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <RevenueByBuilding
      data={data}
      properties={properties}
      preset={range.preset}
      rangeText={range.rangeText}
      selectedPropertyId={propertyId ?? ""}
    />
  );
}
