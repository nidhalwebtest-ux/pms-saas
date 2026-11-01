import { getTranslations } from "next-intl/server";
import { SolutionStory, type Chapter, type ChapterLabels, type Pain } from "./SolutionStory";

/* Landing v2 · section 4 (the solution story). Copy: messages marketing.chapters + marketing.story. */
export default async function SolutionSection() {
  const t = await getTranslations("marketing");
  const raw = t.raw("chapters") as ChapterLabels & { items: Chapter[] };
  const { items, ...labels } = raw;
  return <SolutionStory chapters={items} pains={t.raw("story.pains") as Pain[]} labels={labels} />;
}
