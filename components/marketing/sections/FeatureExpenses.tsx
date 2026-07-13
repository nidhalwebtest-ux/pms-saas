import { getTranslations } from "next-intl/server";
import FeatureBlock from "./FeatureBlock";
import { PhoneExpensesMock } from "../mocks";

type Feature = { eyebrow: string; title: string; sub: string; bullets: string[] };

export default async function FeatureExpenses() {
  const t = await getTranslations("marketing");
  const f = (t.raw("features") as Feature[])[3];
  return (
    <FeatureBlock
      id="expenses"
      screenLabel="Feature · Expenses"
      flip
      tinted
      eyebrow={f.eyebrow}
      title={f.title}
      description={f.sub}
      bullets={f.bullets}
      visual={<PhoneExpensesMock />}
    />
  );
}
