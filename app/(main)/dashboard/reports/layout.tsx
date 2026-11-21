import "@/styles/reports.css";
import AccessDenied from "@/components/dashboard/AccessDenied";
import { getSessionAccess } from "@/lib/access";
import { REPORT_ENTITY_KEYS } from "@/lib/rbac";
import ReportIcons from "./ReportIcons";
import ReportsSidebar from "./ReportsSidebar";

export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getSessionAccess();
  const anyReport = !!access && REPORT_ENTITY_KEYS.some((k) => access.can(k, "VIEW"));
  if (!anyReport) return <AccessDenied />;

  return (
    <div className="reports-root mx-auto max-w-[1400px]">
      <ReportIcons />
      <div className="reports-frame">
        <div className="report-shell">
          <ReportsSidebar />
          {children}
        </div>
      </div>
    </div>
  );
}
