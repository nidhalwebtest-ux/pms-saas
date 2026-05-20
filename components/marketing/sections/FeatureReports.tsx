import FeatureBlock from "./FeatureBlock";
import { Manager360Mock } from "../mocks";

export default function FeatureReports() {
  return (
    <FeatureBlock
      id="reports"
      screenLabel="Feature · Reports"
      eyebrow="03 · Dashboards & reports"
      title="Know your business at a glance."
      description="Three dashboards for three perspectives. Your receptionist sees today's tasks. Your accountant sees the books. You see the whole picture — across every building."
      bullets={[
        "Today's operations dashboard",
        "Receptionist daily view",
        "Manager 360° revenue & occupancy",
        "Aging A/R and outstanding balances",
        "Export to PDF or Excel · Khareef analytics",
      ]}
      linkLabel="Browse all 14 reports"
      linkHref="#reports"
      visual={<Manager360Mock />}
    />
  );
}
