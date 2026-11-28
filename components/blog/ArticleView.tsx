import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ArrowRight, ChevronRight, Clock, Eye, Languages } from "lucide-react";
import MarketingNavbar from "@/components/marketing/MarketingNavbar";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import Container from "@/components/marketing/ui/Container";
import { landingFontClass } from "@/components/marketing/v2/fonts";
import {
  SITE_URL, blogIndexPath, blogPostPath, categoryLabel, formatBlogDate, type BlogLang,
} from "@/lib/blog/config";
import type { BlogArticle, BlogCard } from "@/lib/blog/queries";
import { PostCard } from "./PostCard";
import ShareButtons from "./ShareButtons";
import { TocInline, TocSidebar } from "./TableOfContents";
import JsonLd from "./JsonLd";

/** Language-switch targets for the navbar: the other version of this article, or that blog's index. */
export function articleLanguageHrefs(article: Pick<BlogArticle, "alternates">) {
  return {
    en: article.alternates.en ? blogPostPath("en", article.alternates.en) : blogIndexPath("en"),
    ar: article.alternates.ar ? blogPostPath("ar", article.alternates.ar) : blogIndexPath("ar"),
  };
}

export default async function ArticleView({
  article, related, preview = false,
}: {
  article: BlogArticle;
  related: BlogCard[];
  preview?: boolean;
}) {
  const lang: BlogLang = article.lang;
  const t = await getTranslations({ locale: lang, namespace: "blog" });
  const url = `${SITE_URL}${blogPostPath(lang, article.slug)}`;
  const other: BlogLang = lang === "en" ? "ar" : "en";
  const otherSlug = article.alternates[other];
  const category = categoryLabel(article.category, lang);
  const updatedLater = new Date(article.updatedAt).getTime() - new Date(article.publishedAt).getTime() > 24 * 3600 * 1000;
  const Back = lang === "ar" ? ArrowRight : ArrowLeft;
  const shareLabels = { share: t("share"), copyLink: t("copyLink"), copied: t("copied") };

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: article.title.slice(0, 110),
      description: article.seoDescription || article.excerpt,
      image: article.coverImageUrl ? [article.coverImageUrl] : undefined,
      datePublished: article.publishedAt,
      dateModified: article.updatedAt,
      inLanguage: lang,
      wordCount: article.wordCount,
      articleSection: category,
      keywords: [article.focusKeyword, ...article.tags].filter(Boolean).join(", ") || undefined,
      author: { "@type": "Organization", name: article.authorName, url: SITE_URL },
      publisher: {
        "@type": "Organization",
        name: "Binaya",
        url: SITE_URL,
        logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-icon.png`, width: 180, height: 180 },
      },
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      url,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t("home"), item: SITE_URL },
        { "@type": "ListItem", position: 2, name: t("blog"), item: `${SITE_URL}${blogIndexPath(lang)}` },
        { "@type": "ListItem", position: 3, name: article.title, item: url },
      ],
    },
  ];

  return (
    <div className={`overflow-x-clip bg-white ${landingFontClass}`}>
      {!preview && <JsonLd data={jsonLd} />}
      <MarketingNavbar languageHrefs={articleLanguageHrefs(article)} />

      {preview && (
        <div className="sticky top-[60px] z-40 flex items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-[13px] font-semibold text-amber-950">
          <Eye className="h-4 w-4" /> {t("preview")}
        </div>
      )}

      <main id="top">
        <article lang={lang}>
          {/* ── Header ── */}
          <header className="bg-gradient-to-b from-brand-50/70 via-white to-white">
            <Container className="pt-8 sm:pt-12">
              <nav aria-label="Breadcrumb" className="mx-auto max-w-[820px]">
                <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-gray-500">
                  <li><Link href="/" className="hover:text-gray-900">{t("home")}</Link></li>
                  <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" /></li>
                  <li><Link href={blogIndexPath(lang)} className="hover:text-gray-900">{t("blog")}</Link></li>
                  <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" /></li>
                  <li>
                    <Link href={`${blogIndexPath(lang)}?category=${article.category}`} className="font-medium text-brand-600 hover:text-brand-700">
                      {category}
                    </Link>
                  </li>
                </ol>
              </nav>

              <div className="mx-auto mt-6 max-w-[820px] text-center">
                <h1 className="text-[32px] font-bold leading-[1.18] tracking-[-0.025em] text-gray-900 text-balance sm:text-[44px] lg:text-[50px]">
                  {article.title}
                </h1>
                {article.excerpt && (
                  <p className="mx-auto mt-5 max-w-[680px] text-[18px] leading-relaxed text-gray-600 text-pretty sm:text-[20px]">
                    {article.excerpt}
                  </p>
                )}

                <div className="mt-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[14px] text-gray-600">
                  <span className="inline-flex items-center gap-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/brand/binaya-mark.svg" alt="" className="h-9 w-9 rounded-full bg-white p-1 ring-1 ring-gray-200" />
                    <span className="text-start leading-tight">
                      <span className="block text-[12px] text-gray-500">{t("writtenBy")}</span>
                      <span className="font-semibold text-gray-900">{article.authorName}</span>
                    </span>
                  </span>
                  <span aria-hidden="true" className="hidden h-8 w-px bg-gray-200 sm:block" />
                  <span className="text-start leading-tight">
                    <span className="block text-[12px] text-gray-500">{updatedLater ? t("updated") : t("published")}</span>
                    <time dateTime={updatedLater ? article.updatedAt : article.publishedAt} className="font-medium text-gray-900">
                      {formatBlogDate(updatedLater ? article.updatedAt : article.publishedAt, lang)}
                    </time>
                  </span>
                  <span aria-hidden="true" className="hidden h-8 w-px bg-gray-200 sm:block" />
                  <span className="inline-flex items-center gap-1.5 font-medium text-gray-900">
                    <Clock className="h-4 w-4 text-gray-400" /> {t("minRead", { n: article.readingMinutes })}
                  </span>
                </div>

                {otherSlug && (
                  <Link
                    href={blogPostPath(other, otherSlug)}
                    hrefLang={other}
                    lang={other}
                    className={`mt-5 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-gray-700 shadow-sm hover:border-brand-300 hover:text-brand-700 ${other === "ar" ? "font-arabic" : ""}`}
                  >
                    <Languages className="h-4 w-4" /> {t("alsoIn")}
                  </Link>
                )}
              </div>
            </Container>

            {article.coverImageUrl && (
              <Container wide className="mt-10 sm:mt-12">
                <div className="relative mx-auto aspect-[1200/630] max-w-[1120px] overflow-hidden rounded-[20px] bg-gray-100 shadow-[0_24px_60px_-24px_rgb(12_36_61/0.35)] sm:rounded-[28px]">
                  <Image
                    src={article.coverImageUrl}
                    alt={article.coverImageAlt}
                    fill
                    priority
                    fetchPriority="high"
                    sizes="(min-width: 1180px) 1120px, 100vw"
                    className="object-cover"
                  />
                </div>
              </Container>
            )}
          </header>

          {/* ── Body ── */}
          <Container wide className="py-12 sm:py-16">
            <div className="mx-auto grid max-w-[1120px] gap-10 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,720px)_64px] xl:justify-between">
              <aside className="hidden lg:block">
                <TocSidebar items={article.toc} label={t("toc")} />
              </aside>

              <div className="min-w-0">
                <div className="mb-8 lg:hidden">
                  <TocInline items={article.toc} label={t("toc")} />
                </div>

                <div
                  className="blog-prose mx-auto max-w-[720px]"
                  dir={lang === "ar" ? "rtl" : "ltr"}
                  dangerouslySetInnerHTML={{ __html: article.contentHtml }}
                />

                {/* Tags + share */}
                <div className="mx-auto mt-12 max-w-[720px] space-y-6 border-t border-gray-200 pt-8">
                  {article.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="me-1 text-[14px] font-semibold text-gray-900">{t("tags")}</span>
                      {article.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-gray-100 px-3 py-1 text-[13px] text-gray-700">#{tag}</span>
                      ))}
                    </div>
                  )}
                  <ShareButtons url={url} title={article.title} labels={shareLabels} />
                </div>

                {/* CTA */}
                <aside className="relative mx-auto mt-12 max-w-[720px] overflow-hidden rounded-3xl bg-[#0c243d] p-7 text-white sm:p-10">
                  <div aria-hidden="true" className="pointer-events-none absolute -end-16 -top-16 h-56 w-56 rounded-full bg-brand-500/30 blur-3xl" />
                  <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -start-10 h-48 w-48 rounded-full bg-[#C9A45C]/20 blur-3xl" />
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/brand/binaya-mark.svg" alt="" className="h-10 w-10 rounded-xl bg-white p-1.5" />
                    <p className="mt-5 text-[24px] font-bold leading-tight sm:text-[28px]">{t("ctaTitle")}</p>
                    <p className="mt-3 max-w-[520px] text-[15px] leading-relaxed text-[#a9bdd4]">{t("ctaText")}</p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <Link href="/login?mode=signup" data-cta="blog-signup" className="inline-flex items-center rounded-xl bg-white px-5 py-2.5 text-[15px] font-semibold text-[#0c243d] transition-colors hover:bg-brand-50">
                        {t("ctaButton")}
                      </Link>
                      <Link href="/#solution" className="inline-flex items-center rounded-xl border border-white/25 px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-white/10">
                        {t("ctaSecondary")}
                      </Link>
                    </div>
                  </div>
                </aside>
              </div>

              <aside className="hidden xl:block">
                <div className="sticky top-28">
                  <ShareButtons url={url} title={article.title} labels={shareLabels} layout="rail" />
                </div>
              </aside>
            </div>
          </Container>
        </article>

        {/* ── Related ── */}
        {related.length > 0 && (
          <section aria-labelledby="related-title" className="border-t border-gray-100 bg-gray-50/60">
            <Container className="py-14 sm:py-20">
              <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
                <h2 id="related-title" className="text-[28px] font-bold tracking-[-0.02em] text-gray-900 sm:text-[34px]">{t("related")}</h2>
                <Link href={blogIndexPath(lang)} className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-brand-600 hover:text-brand-700">
                  <Back className="h-4 w-4" /> {t("backToBlog")}
                </Link>
              </div>
              <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((p) => <PostCard key={p.postId} post={p} minRead={t("minRead", { n: p.readingMinutes })} />)}
              </div>
            </Container>
          </section>
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}
