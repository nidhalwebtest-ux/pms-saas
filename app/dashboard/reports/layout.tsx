import "@/styles/reports.css";
import AccessDenied from "@/components/dashboard/AccessDenied";
import { getSessionAccess } from "@/lib/access";
import ReportIcons from "./ReportIcons";
import ReportsSidebar from "./ReportsSidebar";

export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getSessionAccess();
  if (!access?.canView("reports")) return <AccessDenied />;

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
