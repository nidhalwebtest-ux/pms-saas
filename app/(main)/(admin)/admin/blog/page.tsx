import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { ExternalLink, FileText, Plus, Search, Star } from "lucide-react";
import { getSuperAdmin } from "@/lib/super-admin";
import { prisma } from "@/lib/prisma";
import { blogPostPath, categoryLabel, type BlogLang } from "@/lib/blog/config";
import { ScorePill } from "./SeoPanel";

export const metadata = { title: "Blog · Admin" };

const TABS = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "scheduled", label: "Scheduled" },
  { key: "draft", label: "Drafts" },
  { key: "archived", label: "Archived" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function whereFor(tab: TabKey, now: Date): Prisma.BlogPostWhereInput {
  switch (tab) {
    case "published": return { status: "PUBLISHED", publishedAt: { lte: now } };
    case "scheduled": return { status: "PUBLISHED", publishedAt: { gt: now } };
    case "draft": return { status: "DRAFT" };
    case "archived": return { status: "ARCHIVED" };
    default: return {};
  }
}

const fmt = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Muscat" }).format(d);

/** Super-admin → Blog: every article of binaya.app/blog. */
export default async function AdminBlogPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  if (!(await getSuperAdmin())) redirect("/dashboard");
  const sp = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : "all";
  const q = (sp.q ?? "").trim();
  const now = new Date();

  const search: Prisma.BlogPostWhereInput = q
    ? { translations: { some: { OR: [{ title: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] } } }
    : {};

  const [posts, ...counts] = await Promise.all([
    prisma.blogPost.findMany({
      where: { ...whereFor(tab, now), ...search },
      include: { translations: { select: { lang: true, title: true, slug: true, seoScore: true, wordCount: true } } },
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
    }),
    ...TABS.map((t) => prisma.blogPost.count({ where: { ...whereFor(t.key, now), ...search } })),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-fg">Blog</h2>
          <p className="text-sm text-fg-tertiary">
            Articles published on <a href="/blog" target="_blank" className="text-brand-600 hover:underline">binaya.app/blog</a> — in English, Arabic or both.
          </p>
        </div>
        <Link href="/admin/blog/new" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> New article
        </Link>
      </div>

      <section className="rounded-2xl border border-border-default bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default px-4">
          <nav className="flex gap-1 overflow-x-auto" aria-label="Filter articles">
            {TABS.map((t, i) => (
              <Link
                key={t.key}
                href={{ pathname: "/admin/blog", query: { ...(t.key !== "all" ? { tab: t.key } : {}), ...(q ? { q } : {}) } }}
                aria-current={tab === t.key ? "page" : undefined}
                className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium ${
                  tab === t.key ? "border-brand-500 text-brand-700" : "border-transparent text-fg-secondary hover:text-fg"
                }`}
              >
                {t.label}
                <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${tab === t.key ? "bg-brand-50 text-brand-700" : "bg-canvas text-fg-tertiary"}`}>{counts[i]}</span>
              </Link>
            ))}
          </nav>
          <form className="relative py-2" action="/admin/blog">
            {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-tertiary" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search title or URL…"
              className="w-60 rounded-lg border border-border-default bg-surface py-1.5 pe-3 ps-8 text-sm focus:border-brand-400 focus:outline-none"
            />
          </form>
        </div>

        {posts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600"><FileText className="h-6 w-6" /></span>
            <p className="text-sm font-semibold text-fg">{q || tab !== "all" ? "No articles match" : "No articles yet"}</p>
            <p className="max-w-sm text-sm text-fg-tertiary">Write guides for hotel and apartment managers in Oman — every article brings search traffic to the landing page.</p>
            {!q && tab === "all" && (
              <Link href="/admin/blog/new" className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-600">
                <Plus className="h-4 w-4" /> Write the first article
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-canvas text-xs text-fg-tertiary">
                <tr>
                  <th className="px-4 py-2.5 text-start font-medium">Article</th>
                  <th className="px-4 py-2.5 text-start font-medium">Category</th>
                  <th className="px-4 py-2.5 text-start font-medium">Status</th>
                  <th className="px-4 py-2.5 text-center font-medium">SEO · EN</th>
                  <th className="px-4 py-2.5 text-center font-medium">SEO · AR</th>
                  <th className="px-4 py-2.5 text-end font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {posts.map((p) => {
                  const en = p.translations.find((t) => t.lang === "en");
                  const ar = p.translations.find((t) => t.lang === "ar");
                  const live = p.status === "PUBLISHED" && p.publishedAt && p.publishedAt <= now;
                  const scheduled = p.status === "PUBLISHED" && p.publishedAt && p.publishedAt > now;
                  const first = (en ?? ar)!;
                  return (
                    <tr key={p.id} className="group hover:bg-canvas/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.coverImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.coverImageUrl} alt="" className="h-11 w-16 flex-shrink-0 rounded-md object-cover" />
                          ) : (
                            <span className="h-11 w-16 flex-shrink-0 rounded-md bg-canvas" />
                          )}
                          <div className="min-w-0">
                            <Link href={`/admin/blog/${p.id}`} className="line-clamp-1 font-semibold text-fg hover:text-brand-600">
                              {p.isFeatured && <Star className="me-1 inline h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                              {en?.title || ar?.title || "Untitled"}
                            </Link>
                            {en && ar && <p className="line-clamp-1 font-arabic text-xs text-fg-tertiary" dir="rtl">{ar.title}</p>}
                            <div className="mt-1 flex items-center gap-1.5">
                              {(["en", "ar"] as BlogLang[]).map((l) => {
                                const has = p.translations.some((t) => t.lang === l);
                                return (
                                  <span key={l} className={`rounded px-1.5 py-px text-[10px] font-bold uppercase ${has ? "bg-brand-50 text-brand-700" : "bg-canvas text-fg-tertiary line-through"}`}>
                                    {l}
                                  </span>
                                );
                              })}
                              {live && (
                                <a href={blogPostPath(first.lang as BlogLang, first.slug)} target="_blank" className="inline-flex items-center gap-0.5 text-[11px] text-fg-tertiary opacity-0 hover:text-brand-600 group-hover:opacity-100">
                                  View <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-fg-secondary">{categoryLabel(p.category, "en")}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            live ? "bg-green-50 text-green-700" : scheduled ? "bg-orange-50 text-orange-700" : p.status === "ARCHIVED" ? "bg-gray-100 text-gray-600" : "bg-brand-50 text-brand-700"
                          }`}
                        >
                          {live ? "Published" : scheduled ? "Scheduled" : p.status === "ARCHIVED" ? "Archived" : "Draft"}
                        </span>
                        {p.publishedAt && (live || scheduled) && <p className="mt-1 text-[11px] text-fg-tertiary">{fmt(p.publishedAt)}</p>}
                      </td>
                      <td className="px-4 py-3 text-center">{en ? <ScorePill score={en.seoScore} /> : <span className="text-fg-tertiary">—</span>}</td>
                      <td className="px-4 py-3 text-center">{ar ? <ScorePill score={ar.seoScore} /> : <span className="text-fg-tertiary">—</span>}</td>
                      <td className="px-4 py-3 text-end text-xs tabular-nums text-fg-tertiary">{fmt(p.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
