import { notFound } from "next/navigation";
import { findReport } from "../reports-config";
import RevenueByBuilding from "./RevenueByBuilding";
import ComingSoon from "./ComingSoon";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const report = findReport(slug);
  if (!report) notFound();

  if (slug === "revenue-by-building") {
    return <RevenueByBuilding />;
  }

  return <ComingSoon title={report.label} />;
}
