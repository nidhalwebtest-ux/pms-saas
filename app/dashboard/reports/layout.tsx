import "@/styles/reports.css";
import AccessDenied from "@/components/dashboard/AccessDenied";
import { hasRole } from "@/lib/route-guard";
import ReportIcons from "./ReportIcons";
import ReportsSidebar from "./ReportsSidebar";

export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const allowed = await hasRole(["OWNER", "MANAGER"]);
  if (!allowed) return <AccessDenied />;

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
