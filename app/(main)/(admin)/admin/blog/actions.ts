"use server";

import { revalidatePath, updateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSuperAdmin } from "@/lib/super-admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { BLOG_LANGS, BLOG_TAG, isBlogCategory, type BlogLang } from "@/lib/blog/config";
import { processArticleHtml } from "@/lib/blog/content.server";
import { analyzeSeo } from "@/lib/blog/seo";
import { readingMinutes, slugify } from "@/lib/blog/text";

/**
 * Super-admin blog management (binaya.app/blog).
 * The browser sends the editor's HTML; everything stored is recomputed here:
 * sanitized HTML, table of contents, word count, reading time and the SEO score.
 * Publishing is refused unless every language version passes the required SEO
 * checks (lib/blog/seo.ts).
 */

export type BlogResult = { ok: true; id: string } | { ok: false; error: string; field?: string };

export interface BlogTranslationInput {
  slug: string;
  title: string;
  excerpt: string;
  contentJson: unknown;
  contentHtml: string;
  coverImageAlt: string;
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  tags: string[];
}

export interface BlogPostInput {
  id?: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  /** ISO string; null = now (when publishing). A future date schedules the article. */
  publishedAt: string | null;
  category: string;
  coverImageUrl: string | null;
  isFeatured: boolean;
  authorName: string;
  authorNameAr: string;
  translations: Partial<Record<BlogLang, BlogTranslationInput | null>>;
}

const LANG_NAME: Record<BlogLang, string> = { en: "English", ar: "Arabic" };

function refresh(id?: string) {
  updateTag(BLOG_TAG);
  revalidatePath("/blog", "layout");
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/blog");
  if (id) revalidatePath(`/admin/blog/${id}`);
}

export async function saveBlogPost(input: BlogPostInput): Promise<BlogResult> {
  const admin = await getSuperAdmin();
  if (!admin) return { ok: false, error: "Not authorized" };

  if (!["DRAFT", "PUBLISHED", "ARCHIVED"].includes(input.status)) return { ok: false, error: "Invalid status" };
  if (!isBlogCategory(input.category)) return { ok: false, error: "Choose a category", field: "category" };
  if (input.coverImageUrl && !/^https:\/\//.test(input.coverImageUrl)) return { ok: false, error: "Cover image must be an https URL" };

  const langs = BLOG_LANGS.filter((l) => input.translations[l]);
  if (langs.length === 0) return { ok: false, error: "Enable at least one language (English or Arabic)" };

  let publishedAt: Date | null = input.publishedAt ? new Date(input.publishedAt) : null;
  if (publishedAt && Number.isNaN(publishedAt.getTime())) return { ok: false, error: "Invalid publish date", field: "publishedAt" };
  if (input.status === "PUBLISHED" && !publishedAt) publishedAt = new Date();

  // Build each language version server-side.
  const rows: Prisma.BlogPostTranslationCreateWithoutPostInput[] = [];
  for (const lang of langs) {
    const t = input.translations[lang]!;
    const title = t.title.trim();
    const slug = slugify(t.slug || title);
    if (!title) return { ok: false, error: `${LANG_NAME[lang]}: the title is required`, field: `${lang}.title` };
    if (!slug) return { ok: false, error: `${LANG_NAME[lang]}: the URL slug is required`, field: `${lang}.slug` };

    const { html, toc } = processArticleHtml(t.contentHtml ?? "");
    const report = analyzeSeo({
      lang,
      title,
      slug,
      excerpt: t.excerpt ?? "",
      seoTitle: t.seoTitle ?? "",
      seoDescription: t.seoDescription ?? "",
      focusKeyword: t.focusKeyword ?? "",
      coverImageUrl: input.coverImageUrl,
      coverImageAlt: t.coverImageAlt ?? "",
      contentHtml: html,
    });
    if (input.status === "PUBLISHED" && report.blockers.length) {
      return {
        ok: false,
        error: `${LANG_NAME[lang]} version can't be published yet: ${report.blockers.map((b) => b.label.toLowerCase()).join(", ")}.`,
        field: `${lang}.seo`,
      };
    }

    const clash = await prisma.blogPostTranslation.findFirst({
      where: { lang, slug, ...(input.id ? { postId: { not: input.id } } : {}) },
      select: { id: true },
    });
    if (clash) return { ok: false, error: `${LANG_NAME[lang]}: another article already uses the URL "${slug}"`, field: `${lang}.slug` };

    rows.push({
      lang,
      slug,
      title: title.slice(0, 200),
      excerpt: (t.excerpt ?? "").trim().slice(0, 400),
      contentJson: (t.contentJson ?? {}) as Prisma.InputJsonValue,
      contentHtml: html,
      toc: toc as unknown as Prisma.InputJsonValue,
      coverImageAlt: (t.coverImageAlt ?? "").trim().slice(0, 200),
      seoTitle: (t.seoTitle ?? "").trim().slice(0, 120),
      seoDescription: (t.seoDescription ?? "").trim().slice(0, 300),
      focusKeyword: (t.focusKeyword ?? "").trim().slice(0, 100),
      tags: [...new Set((t.tags ?? []).map((x) => x.trim()).filter(Boolean))].slice(0, 12),
      wordCount: report.analysis.words,
      readingMinutes: readingMinutes(report.analysis.words, lang),
      seoScore: report.score,
    });
  }

  const base = {
    status: input.status,
    publishedAt,
    category: input.category,
    coverImageUrl: input.coverImageUrl || null,
    isFeatured: !!input.isFeatured,
    authorName: input.authorName.trim() || "Binaya Team",
    authorNameAr: input.authorNameAr.trim() || "فريق بناية",
    updatedBy: admin.email,
  };

  try {
    const id = await prisma.$transaction(async (tx) => {
      if (input.id) {
        const exists = await tx.blogPost.findUnique({ where: { id: input.id }, select: { id: true } });
        if (!exists) throw new Error("NOT_FOUND");
        await tx.blogPost.update({ where: { id: input.id }, data: base });
        await tx.blogPostTranslation.deleteMany({ where: { postId: input.id, lang: { notIn: langs } } });
        for (const row of rows) {
          await tx.blogPostTranslation.upsert({
            where: { postId_lang: { postId: input.id, lang: row.lang } },
            create: { ...row, postId: input.id },
            update: row,
          });
        }
        return input.id;
      }
      const created = await tx.blogPost.create({
        data: { ...base, createdBy: admin.email, translations: { create: rows } },
        select: { id: true },
      });
      return created.id;
    });
    // Only one featured article at a time (the big card on the blog home).
    if (base.isFeatured) {
      await prisma.blogPost.updateMany({ where: { id: { not: id }, isFeatured: true }, data: { isFeatured: false } });
    }
    refresh(id);
    return { ok: true, id };
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") return { ok: false, error: "Article not found" };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "That URL slug is already used by another article" };
    }
    console.error("[saveBlogPost]", e);
    return { ok: false, error: "Could not save the article" };
  }
}

export async function deleteBlogPost(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await getSuperAdmin())) return { ok: false, error: "Not authorized" };
  await prisma.blogPost.delete({ where: { id } }).catch(() => null);
  refresh();
  return { ok: true };
}

// ── Media ───────────────────────────────────────────────────────────────────

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;

export type UploadTicket =
  | { ok: true; path: string; token: string; publicUrl: string }
  | { ok: false; error: string };

/**
 * Signed upload URL into the public `pms-media` bucket under blog/. The browser
 * uploads the file DIRECTLY to Supabase (no server-action body limit — videos
 * can be up to 50 MB) after the super-admin check here.
 */
export async function createBlogUploadTicket(file: { name: string; type: string; size: number }): Promise<UploadTicket> {
  if (!(await getSuperAdmin())) return { ok: false, error: "Not authorized" };
  const isImage = IMAGE_TYPES.includes(file.type);
  const isVideo = VIDEO_TYPES.includes(file.type);
  if (!isImage && !isVideo) return { ok: false, error: "Use a JPG, PNG, WebP, GIF, AVIF or SVG image, or an MP4/WebM video" };
  if (isImage && file.size > MAX_IMAGE) return { ok: false, error: "Images must be under 8 MB" };
  if (isVideo && file.size > MAX_VIDEO) return { ok: false, error: "Videos must be under 50 MB — or embed it from YouTube" };

  const ext = (file.name.split(".").pop() || (isImage ? "jpg" : "mp4")).toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const base = slugify(file.name.replace(/\.[^.]+$/, "")).replace(/[^a-z0-9-]/g, "").slice(0, 40) || "media";
  const now = new Date();
  const path = `blog/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${base}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`;

  const supa = createAdminClient();
  const { data, error } = await supa.storage.from("pms-media").createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[createBlogUploadTicket]", error);
    return { ok: false, error: "Could not start the upload" };
  }
  const { data: pub } = supa.storage.from("pms-media").getPublicUrl(path);
  return { ok: true, path, token: data.token, publicUrl: pub.publicUrl };
}
