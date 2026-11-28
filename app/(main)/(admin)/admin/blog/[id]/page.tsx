import { notFound, redirect } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { getSuperAdmin } from "@/lib/super-admin";
import { prisma } from "@/lib/prisma";
import { BLOG_LANGS } from "@/lib/blog/config";
import BlogPostForm from "../BlogPostForm";
import { emptyTranslation, type BlogFormValues } from "../form-values";

export const metadata = { title: "Edit article · Blog · Admin" };

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getSuperAdmin())) redirect("/dashboard");
  const { id } = await params;
  const post = await prisma.blogPost.findUnique({ where: { id }, include: { translations: true } });
  if (!post) notFound();

  const t = Object.fromEntries(
    BLOG_LANGS.map((l) => {
      const row = post.translations.find((x) => x.lang === l);
      if (!row) return [l, emptyTranslation(false)];
      return [
        l,
        {
          enabled: true,
          title: row.title,
          slug: row.slug,
          slugTouched: true,
          excerpt: row.excerpt,
          contentJson: row.contentJson as JSONContent,
          contentHtml: row.contentHtml,
          coverImageAlt: row.coverImageAlt,
          seoTitle: row.seoTitle,
          seoDescription: row.seoDescription,
          focusKeyword: row.focusKeyword,
          tagsText: row.tags.join(", "),
        },
      ];
    }),
  ) as BlogFormValues["t"];

  return (
    <BlogPostForm
      initial={{
        id: post.id,
        status: post.status,
        publishedAt: post.publishedAt?.toISOString() ?? null,
        category: post.category,
        coverImageUrl: post.coverImageUrl,
        isFeatured: post.isFeatured,
        authorName: post.authorName,
        authorNameAr: post.authorNameAr,
        t,
      }}
    />
  );
}
