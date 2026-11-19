import { getTranslations } from "next-intl/server";
import { SolutionStory, type Chapter, type ChapterLabels, type Pain } from "./SolutionStory";

/* Landing v2 · section 3 (the solution, as tabs). Copy: messages marketing.chapters + marketing.story.
 * The heading reuses the former bridge tagline («بناية — إدارة الفنادق والشقق المخدومة»). */
export default async function SolutionSection() {
  const t = await getTranslations("marketing");
  const raw = t.raw("chapters") as ChapterLabels & { items: Chapter[] };
  const { items, ...labels } = raw;
  return (
    <SolutionStory
      heading={t("story.bridgeTagline")}
      chapters={items}
      pains={t.raw("story.pains") as Pain[]}
      labels={labels}
    />
  );
}
