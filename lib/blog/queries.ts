import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { BLOG_PAGE_SIZE, BLOG_TAG, type BlogLang } from "./config";
import type { TocItem } from "./content.server";

/**
 * Public blog reads. Cached (tag BLOG_TAG, refreshed instantly by the admin save
 * action, otherwise every 5 min so scheduled posts appear on time). Returns plain
 * objects with ISO date strings — unstable_cache JSON-serializes its result.
 */

export interface BlogCard {
  postId: string;
  lang: BlogLang;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  coverImageUrl: string | null;
  coverImageAlt: string;
  publishedAt: string;
  readingMinutes: number;
  isFeatured: boolean;
}

export interface BlogArticle extends BlogCard {
  contentHtml: string;
  toc: TocItem[];
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  tags: string[];
  wordCount: number;
  updatedAt: string;
  authorName: string;
  /** slug of each language version that exists (for hreflang + the language switch). */
  alternates: Partial<Record<BlogLang, string>>;
}

const livePost = () => ({ status: "PUBLISHED" as const, publishedAt: { lte: new Date() } });

const cardSelect = {
  postId: true, lang: true, slug: true, title: true, excerpt: true, coverImageAlt: true, readingMinutes: true,
  post: { select: { category: true, coverImageUrl: true, publishedAt: true, isFeatured: true } },
} as const;

type CardRow = {
  postId: string; lang: string; slug: string; title: string; excerpt: string; coverImageAlt: string; readingMinutes: number;
  post: { category: string; coverImageUrl: string | null; publishedAt: Date | null; isFeatured: boolean };
};

function toCard(r: CardRow): BlogCard {
  return {
    postId: r.postId,
    lang: r.lang as BlogLang,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    category: r.post.category,
    coverImageUrl: r.post.coverImageUrl,
    coverImageAlt: r.coverImageAlt,
    publishedAt: (r.post.publishedAt ?? new Date()).toISOString(),
    readingMinutes: r.readingMinutes,
    isFeatured: r.post.isFeatured,
  };
}

export const listBlogPosts = unstable_cache(
  async (lang: BlogLang, opts: { category?: string; page?: number }) => {
    const page = Math.max(1, opts.page ?? 1);
    const where = { lang, post: { ...livePost(), ...(opts.category ? { category: opts.category } : {}) } };
    const [total, rows, featured] = await Promise.all([
      prisma.blogPostTranslation.count({ where }),
      prisma.blogPostTranslation.findMany({
        where,
        select: cardSelect,
        orderBy: { post: { publishedAt: "desc" } },
        skip: (page - 1) * BLOG_PAGE_SIZE,
        take: BLOG_PAGE_SIZE,
      }),
      prisma.blogPostTranslation.findFirst({
        where: { lang, post: { ...livePost(), isFeatured: true } },
        select: cardSelect,
        orderBy: { post: { publishedAt: "desc" } },
      }),
    ]);
    const categories = await prisma.blogPost.groupBy({
      by: ["category"],
      where: { ...livePost(), translations: { some: { lang } } },
      _count: { _all: true },
    });
    return {
      posts: rows.map(toCard),
      featured: featured ? toCard(featured) : null,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE)),
      categoryCounts: Object.fromEntries(categories.map((c) => [c.category, c._count._all])) as Record<string, number>,
    };
  },
  ["blog-list"],
  { revalidate: 300, tags: [BLOG_TAG] },
);

export const getBlogArticle = unstable_cache(
  async (lang: BlogLang, slug: string): Promise<BlogArticle | null> => {
    const t = await prisma.blogPostTranslation.findUnique({
      where: { lang_slug: { lang, slug } },
      include: {
        post: { include: { translations: { select: { lang: true, slug: true } } } },
      },
    });
    if (!t || t.post.status !== "PUBLISHED" || !t.post.publishedAt || t.post.publishedAt > new Date()) return null;
    return {
      ...toCard({ ...t, post: t.post }),
      contentHtml: t.contentHtml,
      toc: (t.toc as unknown as TocItem[]) ?? [],
      seoTitle: t.seoTitle,
      seoDescription: t.seoDescription,
      focusKeyword: t.focusKeyword,
      tags: t.tags,
      wordCount: t.wordCount,
      updatedAt: (t.updatedAt > t.post.updatedAt ? t.updatedAt : t.post.updatedAt).toISOString(),
      authorName: lang === "ar" ? t.post.authorNameAr : t.post.authorName,
      alternates: Object.fromEntries(t.post.translations.map((x) => [x.lang, x.slug])),
    };
  },
  ["blog-article"],
  { revalidate: 300, tags: [BLOG_TAG] },
);

/** Up to `take` other articles: same category first, then the latest. */
export const getRelatedPosts = unstable_cache(
  async (lang: BlogLang, postId: string, category: string, take = 3) => {
    const same = await prisma.blogPostTranslation.findMany({
      where: { lang, postId: { not: postId }, post: { ...livePost(), category } },
      select: cardSelect,
      orderBy: { post: { publishedAt: "desc" } },
      take,
    });
    if (same.length >= take) return same.map(toCard);
    const rest = await prisma.blogPostTranslation.findMany({
      where: { lang, postId: { notIn: [postId, ...same.map((s) => s.postId)] }, post: livePost() },
      select: cardSelect,
      orderBy: { post: { publishedAt: "desc" } },
      take: take - same.length,
    });
    return [...same, ...rest].map(toCard);
  },
  ["blog-related"],
  { revalidate: 300, tags: [BLOG_TAG] },
);

/** Every live article (sitemap + RSS). */
export const listAllLiveTranslations = unstable_cache(
  async () => {
    const rows = await prisma.blogPostTranslation.findMany({
      where: { post: livePost() },
      select: {
        ...cardSelect,
        updatedAt: true,
        post: { select: { ...cardSelect.post.select, updatedAt: true, translations: { select: { lang: true, slug: true } } } },
      },
      orderBy: { post: { publishedAt: "desc" } },
    });
    return rows.map((r) => ({
      ...toCard(r),
      updatedAt: (r.updatedAt > r.post.updatedAt ? r.updatedAt : r.post.updatedAt).toISOString(),
      alternates: Object.fromEntries(r.post.translations.map((x) => [x.lang, x.slug])) as Partial<Record<BlogLang, string>>,
    }));
  },
  ["blog-all-live"],
  { revalidate: 300, tags: [BLOG_TAG] },
);

/**
 * Any status, uncached — for the super-admin preview (/blog/preview/{id}/{lang}).
 * The caller MUST check getSuperAdmin() first.
 */
export async function loadArticleForPreview(id: string, lang: BlogLang): Promise<BlogArticle | null> {
  const post = await prisma.blogPost.findUnique({ where: { id }, include: { translations: true } });
  const t = post?.translations.find((x) => x.lang === lang);
  if (!post || !t) return null;
  return {
    ...toCard({ ...t, post: { ...post, publishedAt: post.publishedAt ?? new Date() } }),
    contentHtml: t.contentHtml,
    toc: (t.toc as unknown as TocItem[]) ?? [],
    seoTitle: t.seoTitle,
    seoDescription: t.seoDescription,
    focusKeyword: t.focusKeyword,
    tags: t.tags,
    wordCount: t.wordCount,
    updatedAt: t.updatedAt.toISOString(),
    authorName: lang === "ar" ? post.authorNameAr : post.authorName,
    alternates: Object.fromEntries(post.translations.map((x) => [x.lang, x.slug])),
  };
}
