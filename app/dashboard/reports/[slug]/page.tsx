import { notFound, redirect } from "next/navigation";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { findReport, resolvePreset } from "../reports-config";
import { getRevenueByBuilding } from "@/lib/reports/revenue-by-building";
import { getRevenueByTenant } from "@/lib/reports/revenue-by-tenant";
import RevenueByBuilding, { type ReportVariant } from "./RevenueByBuilding";
import ComingSoon from "./ComingSoon";

const VARIANTS: Record<string, ReportVariant> = {
  "revenue-by-building": { slug: "revenue-by-building", colNameKey: "colName", countKey: "unitsCount" },
  "revenue-by-tenant": { slug: "revenue-by-tenant", colNameKey: "colNameTenant", countKey: "tenantsCount", midHref: (id) => `/dashboard/tenants/${id}` },
};

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

  const variant = VARIANTS[slug];
  if (!variant) {
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
  const aggregate = slug === "revenue-by-tenant" ? getRevenueByTenant : getRevenueByBuilding;

  const [data, properties] = await Promise.all([
    aggregate({
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
      fromDate={range.from}
      toDate={range.to}
      selectedPropertyId={propertyId ?? ""}
      variant={variant}
    />
  );
}
