import { getTranslations } from "next-intl/server";
import FeatureBlock from "./FeatureBlock";
import { ReportsChartMock } from "../mocks";

type Feature = { eyebrow: string; title: string; sub: string; bullets: string[] };

export default async function FeatureReports() {
  const t = await getTranslations("marketing");
  const f = (t.raw("features") as Feature[])[2];
  return (
    <FeatureBlock
      id="reports"
      screenLabel="Feature · Reports"
      eyebrow={f.eyebrow}
      title={f.title}
      description={f.sub}
      bullets={f.bullets}
      visual={<ReportsChartMock />}
    />
  );
}
