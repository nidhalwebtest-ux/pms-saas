import { redirect } from "next/navigation";
import { DEFAULT_REPORT_SLUG } from "./reports-config";

export default function ReportsIndexPage() {
  redirect(`/dashboard/reports/${DEFAULT_REPORT_SLUG}`);
}
