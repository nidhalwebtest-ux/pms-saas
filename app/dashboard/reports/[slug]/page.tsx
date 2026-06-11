import { notFound, redirect } from "next/navigation";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { findReport, resolvePreset } from "../reports-config";
import { getRevenueByBuilding } from "@/lib/reports/revenue-by-building";
import { getRevenueByTenant } from "@/lib/reports/revenue-by-tenant";
import { getRevenueByUnitType } from "@/lib/reports/revenue-by-unit-type";
import { getRevenueBySource } from "@/lib/reports/revenue-by-source";
import { getOccupancyByBuilding } from "@/lib/reports/occupancy-by-building";
import { getOccupancyTrend } from "@/lib/reports/occupancy-trend";
import { getVacancyAnalysis } from "@/lib/reports/vacancy-analysis";
import { getRevenueTrend } from "@/lib/reports/revenue-trend";
import { getAvgLengthOfStay } from "@/lib/reports/avg-length-of-stay";
import { getKhareefPerformance } from "@/lib/reports/khareef-performance";
import { getRevenueComparison } from "@/lib/reports/revenue-comparison";
import { getAgingReceivables } from "@/lib/reports/aging-receivables";
import { getOutstandingBalances } from "@/lib/reports/outstanding-balances";
import RevenueByBuilding, { type ReportVariant } from "./RevenueByBuilding";
import OccupancyByBuilding from "./OccupancyByBuilding";
import OccupancyTrend from "./OccupancyTrend";
import VacancyAnalysis from "./VacancyAnalysis";
import RevenueTrend from "./RevenueTrend";
import AvgLengthOfStay from "./AvgLengthOfStay";
import KhareefPerformance from "./KhareefPerformance";
import RevenueComparison from "./RevenueComparison";
import AgingReceivables from "./AgingReceivables";
import OutstandingBalances from "./OutstandingBalances";
import ComingSoon from "./ComingSoon";

const VARIANTS: Record<string, ReportVariant> = {
  "revenue-by-building": { slug: "revenue-by-building", colNameKey: "colName", countKey: "unitsCount" },
  "revenue-by-tenant": { slug: "revenue-by-tenant", colNameKey: "colNameTenant", countKey: "tenantsCount", midHrefBase: "/dashboard/tenants/" },
  "revenue-by-unit-type": { slug: "revenue-by-unit-type", colNameKey: "colNameUnitType", countKey: "unitsCount", midHrefBase: "/dashboard/units/", groupLabelNs: "reservations.detail.unitTypes" },
  "revenue-by-source": { slug: "revenue-by-source", colNameKey: "colNameSource", countKey: "buildingsCount", groupLabelNs: "tenants.sources" },
};

const AGGREGATORS: Record<string, (a: { orgId: string; from: Date; to: Date; propertyId?: string }) => Promise<import("@/lib/reports/revenue-by-building").RevReport>> = {
  "revenue-by-building": getRevenueByBuilding,
  "revenue-by-tenant": getRevenueByTenant,
  "revenue-by-unit-type": getRevenueByUnitType,
  "revenue-by-source": getRevenueBySource,
};

const IMPLEMENTED = new Set([...Object.keys(VARIANTS), "occupancy-by-building", "occupancy-trend", "vacancy-analysis", "revenue-trend", "avg-length-of-stay", "khareef-performance", "revenue-comparison", "aging-receivables", "outstanding-balances"]);

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
  const defaultPreset = slug === "khareef-performance" ? "khareef" : (slug === "aging-receivables" || slug === "outstanding-balances") ? "today" : "month";
  const range = resolvePreset(sp.preset ?? defaultPreset, new Date(), sp.from, sp.to);
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

  // ── Revenue Trend ──────────────────────────────────────────────────────
  if (slug === "revenue-trend") {
    try {
      const [data, properties] = await Promise.all([
        getRevenueTrend({ orgId: orgUser.organizationId, from, to, propertyId, bucket: sp.bucket }),
        propertiesPromise,
      ]);
      return (
        <RevenueTrend
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

  // ── Outstanding Balances ───────────────────────────────────────────────
  if (slug === "outstanding-balances") {
    try {
      const [data, properties] = await Promise.all([
        getOutstandingBalances({ orgId: orgUser.organizationId, from, to, propertyId }),
        propertiesPromise,
      ]);
      return (
        <OutstandingBalances
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

  // ── Aging Receivables ──────────────────────────────────────────────────
  if (slug === "aging-receivables") {
    try {
      const [data, properties] = await Promise.all([
        getAgingReceivables({ orgId: orgUser.organizationId, from, to, propertyId }),
        propertiesPromise,
      ]);
      return (
        <AgingReceivables
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

  // ── Revenue Comparison ─────────────────────────────────────────────────
  if (slug === "revenue-comparison") {
    try {
      const [data, properties] = await Promise.all([
        getRevenueComparison({ orgId: orgUser.organizationId, from, to, propertyId }),
        propertiesPromise,
      ]);
      return (
        <RevenueComparison
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

  // ── Khareef Performance ────────────────────────────────────────────────
  if (slug === "khareef-performance") {
    try {
      const [data, properties] = await Promise.all([
        getKhareefPerformance({ orgId: orgUser.organizationId, from, to, propertyId }),
        propertiesPromise,
      ]);
      return (
        <KhareefPerformance
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

  // ── Average Length of Stay ─────────────────────────────────────────────
  if (slug === "avg-length-of-stay") {
    try {
      const [data, properties] = await Promise.all([
        getAvgLengthOfStay({ orgId: orgUser.organizationId, from, to, propertyId }),
        propertiesPromise,
      ]);
      return (
        <AvgLengthOfStay
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

  // ── Vacancy Analysis ───────────────────────────────────────────────────
  if (slug === "vacancy-analysis") {
    try {
      const [data, properties] = await Promise.all([
        getVacancyAnalysis({ orgId: orgUser.organizationId, from, to, propertyId }),
        propertiesPromise,
      ]);
      return (
        <VacancyAnalysis
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

  // ── Revenue (by building / tenant / unit type / source) ────────────────
  const variant = VARIANTS[slug];
  const aggregate = AGGREGATORS[slug];

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
