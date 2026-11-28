import { notFound } from "next/navigation";
import { isBlogLang } from "@/lib/blog/config";
import "@/styles/blog-prose.css";

/** /blog/{en|ar}/… — anything else is a 404. (<html lang/dir> follow the URL via middleware.ts.) */
export default async function BlogLangLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isBlogLang(lang)) notFound();
  return children;
}
