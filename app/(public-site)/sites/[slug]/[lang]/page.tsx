import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPinIcon, ChatBubbleLeftRightIcon, TagIcon, HeartIcon } from "@heroicons/react/24/outline";
import { getSiteView } from "@/lib/public-site/render";
import { getBuildings, getPublicSeasons } from "@/lib/public-site/data";
import { pageMetadata } from "@/lib/public-site/seo";
import { lodgingBusinessLd } from "@/lib/public-site/schema-org";
import JsonLd from "./_components/JsonLd";
import HomeCoastal from "./_templates/HomeCoastal";
import HomeClassic from "./_templates/HomeClassic";
import HomeModern from "./_templates/HomeModern";
import type { HomeProps } from "./_templates/types";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; lang: string }> }): Promise<Metadata> {
  const { slug, lang: langParam } = await params;
  const v = await getSiteView(slug, langParam);
  if (!v) return {};
  const { site, lang } = v;
  const buildings = await getBuildings(site.organizationId);
  const description = (lang === "ar" ? site.metaDescriptionAr || site.taglineAr : site.metaDescriptionEn || site.taglineEn) || (lang === "ar" ? site.aboutAr : site.aboutEn);
  return pageMetadata(v, { path: "/", description, image: buildings.find((b) => b.photos[0])?.photos[0] });
}

/** Home page: loads the content once, then renders it with the site's template (each has its own layout). */
export default async function Home({ params }: { params: Promise<{ slug: string; lang: string }> }) {
  const { slug, lang: langParam } = await params;
  const v = await getSiteView(slug, langParam);
  if (!v) notFound();
  const { site, lang, dict } = v;
  const ar = lang === "ar";

  const [buildings, seasons] = await Promise.all([getBuildings(site.organizationId), getPublicSeasons(site.organizationId)]);
  const heroPhoto = buildings.find((b) => b.photos[0])?.photos[0] ?? null;

  const props: HomeProps = {
    v,
    buildings,
    seasons,
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

  const Home_ = v.theme.key === "template_2" ? HomeClassic : v.theme.key === "template_3" ? HomeModern : HomeCoastal;
  return (
    <>
      <JsonLd data={lodgingBusinessLd(v, buildings.flatMap((b) => b.photos).slice(0, 4))} />
      <Home_ {...props} />
    </>
  );
}
