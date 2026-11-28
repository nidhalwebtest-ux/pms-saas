import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock } from "lucide-react";
import { blogPostPath, categoryLabel, formatBlogDate } from "@/lib/blog/config";
import type { BlogCard } from "@/lib/blog/queries";

function Meta({ post, minRead }: { post: BlogCard; minRead: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-gray-500">
      <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt, post.lang)}</time>
      <span aria-hidden="true" className="h-1 w-1 rounded-full bg-gray-300" />
      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" strokeWidth={1.8} />{minRead}</span>
    </p>
  );
}

/** Grid card on the blog index and in "Keep reading". */
export function PostCard({ post, minRead, priority = false }: { post: BlogCard; minRead: string; priority?: boolean }) {
  return (
    <article className="group relative flex flex-col">
      <div className="relative aspect-[1200/630] overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-black/5">
        {post.coverImageUrl && (
          <Image
            src={post.coverImageUrl}
            alt={post.coverImageAlt}
            fill
            priority={priority}
            sizes="(min-width: 1200px) 380px, (min-width: 768px) 45vw, 100vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col pt-5">
        <span className="text-[13px] font-semibold text-brand-600">{categoryLabel(post.category, post.lang)}</span>
        <h3 className="mt-2 text-[20px] font-bold leading-snug tracking-[-0.01em] text-gray-900 text-balance">
          <Link href={blogPostPath(post.lang, post.slug)} className="after:absolute after:inset-0 group-hover:text-brand-700">
            {post.title}
          </Link>
        </h3>
        {post.excerpt && <p className="mt-2.5 line-clamp-3 text-[15px] leading-relaxed text-gray-600">{post.excerpt}</p>}
        <div className="mt-auto pt-4">
          <Meta post={post} minRead={minRead} />
        </div>
      </div>
    </article>
  );
}

/** Large horizontal card for the featured article at the top of the blog. */
export function FeaturedPostCard({ post, minRead, featuredLabel, readMore }: { post: BlogCard; minRead: string; featuredLabel: string; readMore: string }) {
  return (
    <article className="group relative grid overflow-hidden rounded-3xl bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_40px_-12px_rgb(12_36_61/0.18)] ring-1 ring-black/5 md:grid-cols-[1.15fr_1fr]">
      <div className="relative aspect-[1200/630] md:aspect-auto md:min-h-[380px]">
        {post.coverImageUrl && (
          <Image
            src={post.coverImageUrl}
            alt={post.coverImageAlt}
            fill
            priority
            sizes="(min-width: 1200px) 640px, (min-width: 768px) 55vw, 100vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
        )}
      </div>
      <div className="flex flex-col justify-center p-6 sm:p-9 lg:p-11">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <span className="rounded-full bg-[#C9A45C]/15 px-2.5 py-1 text-[#8a6a2b]">{featuredLabel}</span>
          <span className="text-brand-600">{categoryLabel(post.category, post.lang)}</span>
        </div>
        <h2 className="mt-4 text-[26px] font-bold leading-[1.2] tracking-[-0.02em] text-gray-900 text-balance sm:text-[32px]">
          <Link href={blogPostPath(post.lang, post.slug)} className="after:absolute after:inset-0 group-hover:text-brand-700">
            {post.title}
          </Link>
        </h2>
        {post.excerpt && <p className="mt-4 line-clamp-4 text-[16px] leading-relaxed text-gray-600">{post.excerpt}</p>}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Meta post={post} minRead={minRead} />
          <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-brand-600">
            {readMore}
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
          </span>
        </div>
      </div>
    </article>
  );
}
