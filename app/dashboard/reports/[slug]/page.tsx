import { notFound, redirect } from "next/navigation";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { findReport, resolvePreset } from "../reports-config";
import { getRevenueByBuilding } from "@/lib/reports/revenue-by-building";
import { getRevenueByTenant } from "@/lib/reports/revenue-by-tenant";
import { getOccupancyByBuilding } from "@/lib/reports/occupancy-by-building";
import { getOccupancyTrend } from "@/lib/reports/occupancy-trend";
import RevenueByBuilding, { type ReportVariant } from "./RevenueByBuilding";
import OccupancyByBuilding from "./OccupancyByBuilding";
import OccupancyTrend from "./OccupancyTrend";
import ComingSoon from "./ComingSoon";

const VARIANTS: Record<string, ReportVariant> = {
  "revenue-by-building": { slug: "revenue-by-building", colNameKey: "colName", countKey: "unitsCount" },
  "revenue-by-tenant": { slug: "revenue-by-tenant", colNameKey: "colNameTenant", countKey: "tenantsCount", midHrefBase: "/dashboard/tenants/" },
};

const IMPLEMENTED = new Set([...Object.keys(VARIANTS), "occupancy-by-building", "occupancy-trend"]);

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <main className="rpage">
      <div className="rhead"><div className="title-block"><h1>{title}</h1></div></div>
      <div className="state-card is-error">
        <div className="glyph"><svg width="28" height="28"><use href="#i-info" /></svg></div>
        <h3>Could not load this report</h3>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{message}</p>
      </div>
    </main>
  );
}

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

  if (!IMPLEMENTED.has(slug)) {
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
  const from = new Date(range.from);
  const to = new Date(range.to);

  const propertiesPromise = prisma.property.findMany({
    where: { organizationId: orgUser.organizationId, isArchived: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // ── Occupancy ──────────────────────────────────────────────────────────
  if (slug === "occupancy-by-building") {
    try {
      const [data, properties] = await Promise.all([
        getOccupancyByBuilding({ orgId: orgUser.organizationId, from, to, propertyId }),
        propertiesPromise,
      ]);
      return (
        <OccupancyByBuilding
          data={data}
          properties={properties}
          preset={range.preset}
          rangeText={range.rangeText}
          fromDate={range.from}
          toDate={range.to}
          selectedPropertyId={propertyId ?? ""}
        />
      );
    } catch (err) {
      console.error(`[reports/${slug}] aggregation failed:`, err);
      return <ErrorCard title={report.label} message={err instanceof Error ? err.message : "Unknown error"} />;
    }
  }

  // ── Occupancy Trend ────────────────────────────────────────────────────
  if (slug === "occupancy-trend") {
    try {
      const [data, properties] = await Promise.all([
        getOccupancyTrend({ orgId: orgUser.organizationId, from, to, propertyId, bucket: sp.bucket }),
        propertiesPromise,
      ]);
      return (
        <OccupancyTrend
          data={data}
          properties={properties}
          preset={range.preset}
          rangeText={range.rangeText}
          fromDate={range.from}
          toDate={range.to}
          selectedPropertyId={propertyId ?? ""}
        />
      );
    } catch (err) {
      console.error(`[reports/${slug}] aggregation failed:`, err);
      return <ErrorCard title={report.label} message={err instanceof Error ? err.message : "Unknown error"} />;
    }
  }

  // ── Revenue (by building / by tenant) ──────────────────────────────────
  const variant = VARIANTS[slug];
  const aggregate = slug === "revenue-by-tenant" ? getRevenueByTenant : getRevenueByBuilding;

  try {
    const [data, properties] = await Promise.all([
      aggregate({ orgId: orgUser.organizationId, from, to, propertyId }),
      propertiesPromise,
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
  } catch (err) {
    console.error(`[reports/${slug}] aggregation failed:`, err);
    return <ErrorCard title={report.label} message={err instanceof Error ? err.message : "Unknown error"} />;
  }
}
