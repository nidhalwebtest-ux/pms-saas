import { getTranslations } from "next-intl/server";
import { PainStory, type Pain } from "./PainStory";

/* Landing v2 · section 2 (pain points). Copy lives in messages: marketing.story. */
export default async function PainSection() {
  const t = await getTranslations("marketing.story");
  return (
    <PainStory
      intro={t("painsIntro")}
      pains={t.raw("pains") as Pain[]}
      escalationA={t("escalationA")}
      escalationB={t("escalationB")}
    />
  );
}
