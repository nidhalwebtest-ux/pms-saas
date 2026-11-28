import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArticleView from "@/components/blog/ArticleView";
import { SITE_URL, blogPostPath, categoryLabel, isBlogLang, type BlogLang } from "@/lib/blog/config";
import { getBlogArticle, getRelatedPosts } from "@/lib/blog/queries";

type Props = { params: Promise<{ lang: string; slug: string }> };

/** Arabic slugs may arrive percent-encoded. */
function decodeSlug(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

async function load(params: Props["params"]) {
  const { lang, slug } = await params;
  if (!isBlogLang(lang)) return null;
  return getBlogArticle(lang, decodeSlug(slug).normalize("NFKC"));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await load(params);
  if (!a) return { title: "Not found", robots: { index: false } };
  const title = a.seoTitle || a.title;
  const description = a.seoDescription || a.excerpt;
  const path = blogPostPath(a.lang, a.slug);
  const languages: Record<string, string> = {};
  for (const l of ["en", "ar"] as BlogLang[]) if (a.alternates[l]) languages[l] = blogPostPath(l, a.alternates[l]!);
  languages["x-default"] = languages.en ?? languages.ar;

  return {
    metadataBase: new URL(SITE_URL),
    title: { absolute: title },
    description,
    keywords: [a.focusKeyword, ...a.tags].filter(Boolean),
    authors: [{ name: a.authorName, url: SITE_URL }],
    alternates: { canonical: path, languages },
    openGraph: {
      type: "article",
      url: path,
      siteName: "Binaya",
      title,
      description,
      locale: a.lang === "ar" ? "ar_OM" : "en_US",
      alternateLocale: a.alternates[a.lang === "ar" ? "en" : "ar"] ? [a.lang === "ar" ? "en_US" : "ar_OM"] : undefined,
      publishedTime: a.publishedAt,
      modifiedTime: a.updatedAt,
      section: categoryLabel(a.category, a.lang),
      tags: a.tags,
      authors: [a.authorName],
      images: a.coverImageUrl ? [{ url: a.coverImageUrl, width: 1200, height: 630, alt: a.coverImageAlt }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: a.coverImageUrl ? [a.coverImageUrl] : undefined,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
    },
  };
}

export default async function BlogArticlePage({ params }: Props) {
  const article = await load(params);
  if (!article) notFound();
  const related = await getRelatedPosts(article.lang, article.postId, article.category, 3);
  return <ArticleView article={article} related={related} />;
}
