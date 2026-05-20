import { getTranslations } from "next-intl/server";
import FeatureBlock from "./FeatureBlock";
import { InvoiceMock } from "../mocks";

export default async function FeatureFinance() {
  const t = await getTranslations("marketing.featureFinance");
  return (
    <FeatureBlock
      id="finance"
      screenLabel="Feature · Finance"
      flip
      tinted
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      bullets={[t("b1"), t("b2"), t("b3"), t("b4"), t("b5")]}
      linkLabel={t("linkLabel")}
      linkHref="#finance"
      visual={<InvoiceMock />}
    />
  );
}
