import { redirect } from "next/navigation";
import { getSuperAdmin } from "@/lib/super-admin";
import BlogPostForm, { emptyTranslation } from "../BlogPostForm";

export const metadata = { title: "New article · Blog · Admin" };

export default async function NewBlogPostPage() {
  if (!(await getSuperAdmin())) redirect("/dashboard");
  return (
    <BlogPostForm
      initial={{
        status: "DRAFT",
        publishedAt: null,
        category: "guides",
        coverImageUrl: null,
        isFeatured: false,
        authorName: "Binaya Team",
        authorNameAr: "فريق بناية",
        t: { en: emptyTranslation(true), ar: emptyTranslation(true) },
      }}
    />
  );
}
