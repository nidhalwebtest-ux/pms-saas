import { getTranslations } from "next-intl/server";
import FeatureBlock from "./FeatureBlock";
import { MobileApprovalMock } from "../mocks";

export default async function FeatureExpenses() {
  const t = await getTranslations("marketing.featureExpenses");
  return (
    <FeatureBlock
      id="expenses"
      screenLabel="Feature · Expenses"
      flip
      tinted
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      bullets={[t("b1"), t("b2"), t("b3"), t("b4"), t("b5")]}
      linkLabel={t("linkLabel")}
      linkHref="#expenses"
      visual={<MobileApprovalMock />}
    />
  );
}
