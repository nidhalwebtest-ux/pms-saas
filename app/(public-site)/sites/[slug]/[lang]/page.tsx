import { notFound } from "next/navigation";
import { MapPinIcon, ChatBubbleLeftRightIcon, TagIcon, HeartIcon } from "@heroicons/react/24/outline";
import { getSiteView } from "@/lib/public-site/render";
import { getBuildings } from "@/lib/public-site/data";
import HomeCoastal from "./_templates/HomeCoastal";
import HomeClassic from "./_templates/HomeClassic";
import HomeModern from "./_templates/HomeModern";
import type { HomeProps } from "./_templates/types";

/** Home page: loads the content once, then renders it with the site's template (each has its own layout). */
export default async function Home({ params }: { params: Promise<{ slug: string; lang: string }> }) {
  const { slug, lang: langParam } = await params;
  const v = await getSiteView(slug, langParam);
  if (!v) notFound();
  const { site, lang, dict } = v;
  const ar = lang === "ar";

  const buildings = await getBuildings(site.organizationId);
  const heroPhoto = buildings.find((b) => b.photos[0])?.photos[0] ?? null;

  const props: HomeProps = {
    v,
    buildings,
    name: (ar ? site.siteNameAr : site.siteNameEn) || site.orgName,
    tagline: ar ? site.taglineAr : site.taglineEn,
    about: ar ? site.aboutAr : site.aboutEn,
    location: (ar ? site.addressAr : site.addressEn) || (ar ? "صلالة، عُمان" : "Salalah, Oman"),
    heroPhoto,
    aboutPhoto: buildings.find((b) => b.photos[1])?.photos[1] ?? heroPhoto,
    highlights: [
      { icon: MapPinIcon, ...dict.highlights.location },
      { icon: ChatBubbleLeftRightIcon, ...dict.highlights.booking },
      { icon: TagIcon, ...dict.highlights.price },
      { icon: HeartIcon, ...dict.highlights.care },
    ],
  };

  if (v.theme.key === "template_2") return <HomeClassic {...props} />;
  if (v.theme.key === "template_3") return <HomeModern {...props} />;
  return <HomeCoastal {...props} />;
}
