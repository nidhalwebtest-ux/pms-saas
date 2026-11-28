import type { JSONContent } from "@tiptap/react";
import type { BlogLang } from "@/lib/blog/config";

/**
 * Blog form state — shared by the server pages (new / [id], which build the
 * initial values) and the client form. Kept out of BlogPostForm.tsx because a
 * "use client" module's functions can't be called from a server component.
 */

export interface TranslationState {
  enabled: boolean;
  title: string;
  slug: string;
  slugTouched: boolean;
  excerpt: string;
  contentJson: JSONContent | null;
  contentHtml: string;
  coverImageAlt: string;
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  tagsText: string;
}

export interface BlogFormValues {
  id?: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  /** ISO or null */
  publishedAt: string | null;
  category: string;
  coverImageUrl: string | null;
  isFeatured: boolean;
  authorName: string;
  authorNameAr: string;
  t: Record<BlogLang, TranslationState>;
}

export const emptyTranslation = (enabled: boolean): TranslationState => ({
  enabled, title: "", slug: "", slugTouched: false, excerpt: "", contentJson: null, contentHtml: "",
  coverImageAlt: "", seoTitle: "", seoDescription: "", focusKeyword: "", tagsText: "",
});
