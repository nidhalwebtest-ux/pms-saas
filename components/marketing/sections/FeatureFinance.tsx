import { getTranslations } from "next-intl/server";
import FeatureBlock from "./FeatureBlock";
import { InvoiceMock } from "../mocks";

type Feature = { eyebrow: string; title: string; sub: string; bullets: string[] };

export default async function FeatureFinance() {
  const t = await getTranslations("marketing");
  const f = (t.raw("features") as Feature[])[1];
  return (
    <FeatureBlock
      id="finance"
      screenLabel="Feature · Finance"
      flip
      tinted
      eyebrow={f.eyebrow}
      title={f.title}
      description={f.sub}
      bullets={f.bullets}
      visual={<InvoiceMock />}
    />
  );
}
