import { getTranslations } from "next-intl/server";
import FeatureBlock from "./FeatureBlock";
import { Manager360Mock } from "../mocks";

export default async function FeatureReports() {
  const t = await getTranslations("marketing.featureReports");
  return (
    <FeatureBlock
      id="reports"
      screenLabel="Feature · Reports"
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      bullets={[t("b1"), t("b2"), t("b3"), t("b4"), t("b5")]}
      linkLabel={t("linkLabel")}
      linkHref="#reports"
      visual={<Manager360Mock />}
    />
  );
}
