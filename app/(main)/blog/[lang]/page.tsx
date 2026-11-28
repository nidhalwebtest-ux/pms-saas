import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ArrowRight, NotebookPen, Rss } from "lucide-react";
import MarketingNavbar from "@/components/marketing/MarketingNavbar";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import Container from "@/components/marketing/ui/Container";
import { landingFontClass } from "@/components/marketing/v2/fonts";
import { FeaturedPostCard, PostCard } from "@/components/blog/PostCard";
import JsonLd from "@/components/blog/JsonLd";
import {
  BLOG_CATEGORIES, SITE_URL, blogIndexPath, blogPostPath, isBlogCategory, isBlogLang, type BlogLang,
} from "@/lib/blog/config";
import { listBlogPosts } from "@/lib/blog/queries";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<{ category?: string; page?: string }> };

function parse(sp: { category?: string; page?: string }) {
  const category = isBlogCategory(sp.category) ? sp.category : undefined;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  return { category, page };
}

function href(lang: BlogLang, category?: string, page = 1) {
  const q = new URLSearchParams();
  if (category) q.set("category", category);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return `${blogIndexPath(lang)}${s ? `?${s}` : ""}`;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isBlogLang(lang)) return {};
  const { category, page } = parse(await searchParams);
  const t = await getTranslations({ locale: lang, namespace: "blog" });
  const cat = category ? BLOG_CATEGORIES.find((c) => c.key === category)![lang] : null;
  const title = [cat, t("metaTitle")].filter(Boolean).join(" · ") + (page > 1 ? ` (${page})` : "");
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description: t("metaDescription"),
    alternates: {
      canonical: href(lang, category, page),
      languages: { en: href("en", category), ar: href("ar", category), "x-default": href("en", category) },
      types: { "application/rss+xml": [{ url: `${blogIndexPath(lang)}/rss.xml`, title: t("metaTitle") }] },
    },
    openGraph: {
      type: "website",
      url: href(lang, category, page),
      siteName: "Binaya",
      title,
      description: t("metaDescription"),
      locale: lang === "ar" ? "ar_OM" : "en_US",
      images: [{ url: "/apple-icon.png", width: 180, height: 180, alt: "Binaya" }],
    },
    twitter: { card: "summary", title, description: t("metaDescription") },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  };
}

export default async function BlogIndexPage({ params, searchParams }: Props) {
  const { lang: raw } = await params;
  if (!isBlogLang(raw)) notFound();
  const lang = raw;
  const { category, page } = parse(await searchParams);
  const t = await getTranslations({ locale: lang, namespace: "blog" });
  const data = await listBlogPosts(lang, { category, page });
  if (data.total > 0 && page > data.pages) notFound();

  const showFeatured = page === 1 && !category && data.featured;
  const posts = showFeatured ? data.posts.filter((p) => p.postId !== data.featured!.postId) : data.posts;
  const totalAll = Object.values(data.categoryCounts).reduce((a, b) => a + b, 0);
  const Prev = lang === "ar" ? ArrowRight : ArrowLeft;
  const Next = lang === "ar" ? ArrowLeft : ArrowRight;
  const minRead = (n: number) => t("minRead", { n });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: t("metaTitle"),
    description: t("metaDescription"),
    url: `${SITE_URL}${blogIndexPath(lang)}`,
    inLanguage: lang,
    publisher: { "@type": "Organization", name: "Binaya", url: SITE_URL, logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-icon.png` } },
    blogPost: [...(showFeatured ? [data.featured!] : []), ...posts].map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      url: `${SITE_URL}${blogPostPath(lang, p.slug)}`,
      datePublished: p.publishedAt,
      image: p.coverImageUrl ?? undefined,
    })),
  };

  return (
    <div className={`overflow-x-clip bg-white ${landingFontClass}`}>
      <JsonLd data={jsonLd} />
      <MarketingNavbar languageHrefs={{ en: href("en", category), ar: href("ar", category) }} />
      <main id="top">
        {/* ── Hero ── */}
        <header className="relative border-b border-gray-100 bg-gradient-to-b from-brand-50/80 to-white">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,rgb(24_95_165/0.10),transparent)]" />
          <Container className="relative pb-10 pt-14 text-center sm:pb-12 sm:pt-20">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/15 bg-white/70 px-3 py-1 text-[12px] font-semibold text-brand-700 backdrop-blur">
              <NotebookPen className="h-3.5 w-3.5" /> {t("eyebrow")}
            </span>
            <h1 className="mx-auto mt-5 max-w-[820px] text-[36px] font-bold leading-[1.12] tracking-[-0.03em] text-gray-900 text-balance sm:text-[52px]">
              {t("title")}
            </h1>
            <p className="mx-auto mt-5 max-w-[640px] text-[17px] leading-relaxed text-gray-600 text-pretty sm:text-[19px]">{t("subtitle")}</p>

            {totalAll > 0 && (
              <nav aria-label={t("blog")} className="-mx-5 mt-9 overflow-x-auto px-5 pb-1">
                <ul className="mx-auto flex w-max gap-2">
                  {[{ key: undefined as string | undefined, label: t("all"), n: totalAll }, ...BLOG_CATEGORIES.filter((c) => data.categoryCounts[c.key]).map((c) => ({ key: c.key as string | undefined, label: c[lang], n: data.categoryCounts[c.key] }))].map((c) => {
                    const active = c.key === category;
                    return (
                      <li key={c.key ?? "all"}>
                        <Link
                          href={href(lang, c.key)}
                          aria-current={active ? "page" : undefined}
                          scroll={false}
                          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-[14px] font-medium transition-colors ${
                            active ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          {c.label}
                          <span className={`text-[12px] tabular-nums ${active ? "text-white/70" : "text-gray-400"}`}>{c.n}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            )}
          </Container>
        </header>

        <Container className="py-12 sm:py-16">
          {data.total === 0 ? (
            <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><NotebookPen className="h-7 w-7" /></span>
              <h2 className="mt-5 text-[22px] font-bold text-gray-900">{category ? t("emptyCategory") : t("empty")}</h2>
              {!category && <p className="mt-2 text-gray-600">{t("emptyHint")}</p>}
              {category && (
                <Link href={href(lang)} className="mt-5 font-semibold text-brand-600 hover:text-brand-700">{t("backToBlog")}</Link>
              )}
            </div>
          ) : (
            <>
              {showFeatured && (
                <div className="mb-14 sm:mb-16">
                  <FeaturedPostCard post={data.featured!} minRead={minRead(data.featured!.readingMinutes)} featuredLabel={t("featured")} readMore={t("readMore")} />
                </div>
              )}

              {posts.length > 0 && (
                <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
                  {posts.map((p, i) => (
                    <PostCard key={p.postId} post={p} minRead={minRead(p.readingMinutes)} priority={!showFeatured && i < 3} />
                  ))}
                </div>
              )}

              {data.pages > 1 && (
                <nav aria-label={t("page", { page, pages: data.pages })} className="mt-16 flex items-center justify-between gap-4 border-t border-gray-200 pt-8">
                  {page > 1 ? (
                    <Link href={href(lang, category, page - 1)} rel="prev" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-[14px] font-semibold text-gray-700 hover:bg-gray-50">
                      <Prev className="h-4 w-4" /> {t("prev")}
                    </Link>
                  ) : <span />}
                  <span className="text-[14px] text-gray-500">{t("page", { page, pages: data.pages })}</span>
                  {page < data.pages ? (
                    <Link href={href(lang, category, page + 1)} rel="next" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-[14px] font-semibold text-gray-700 hover:bg-gray-50">
                      {t("next")} <Next className="h-4 w-4" />
                    </Link>
                  ) : <span />}
                </nav>
              )}
            </>
          )}

          <div className="mt-16 flex justify-center">
            <a href={`${blogIndexPath(lang)}/rss.xml`} className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-brand-600">
              <Rss className="h-3.5 w-3.5" /> {t("rss")}
            </a>
          </div>
        </Container>
      </main>
      <MarketingFooter />
    </div>
  );
}
