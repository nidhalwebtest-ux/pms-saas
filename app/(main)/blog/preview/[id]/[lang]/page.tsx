import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArticleView from "@/components/blog/ArticleView";
import { getSuperAdmin } from "@/lib/super-admin";
import { isBlogLang } from "@/lib/blog/config";
import { loadArticleForPreview } from "@/lib/blog/queries";
import "@/styles/blog-prose.css";

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

/** Super-admin preview of an article in any status (draft, scheduled, archived). Never indexed. */
export default async function BlogPreviewPage({ params }: { params: Promise<{ id: string; lang: string }> }) {
  if (!(await getSuperAdmin())) notFound();
  const { id, lang } = await params;
  if (!isBlogLang(lang)) notFound();
  const article = await loadArticleForPreview(id, lang);
  if (!article) notFound();
  return <ArticleView article={article} related={[]} preview />;
}
