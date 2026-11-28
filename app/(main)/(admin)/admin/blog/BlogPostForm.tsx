"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import type { JSONContent } from "@tiptap/react";
import { ArrowLeft, CalendarClock, ExternalLink, Eye, ImagePlus, Loader2, RefreshCw, Star, Trash2, X } from "lucide-react";
import RichTextEditor from "@/components/blog/editor/RichTextEditor";
import { uploadBlogMedia } from "@/components/blog/editor/upload";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/form/Toggle";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { BLOG_CATEGORIES, BLOG_LANGS, SITE_URL, blogPostPath, type BlogLang } from "@/lib/blog/config";
import { analyzeSeo, DESCRIPTION_RANGE, TITLE_RANGE, type SeoReport } from "@/lib/blog/seo";
import { slugify } from "@/lib/blog/text";
import { deleteBlogPost, saveBlogPost, type BlogPostInput } from "./actions";
import SeoPanel, { ScorePill } from "./SeoPanel";

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

const LANG_LABEL: Record<BlogLang, string> = { en: "English", ar: "العربية" };
const STATUS_LABEL = { DRAFT: "Draft", PUBLISHED: "Published", ARCHIVED: "Archived" } as const;

function toLocalInput(iso: string | null) {
  return iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : "";
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border-default bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

const inputCls =
  "w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-tertiary focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";

function Field({ label, hint, counter, children }: { label: string; hint?: React.ReactNode; counter?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-fg-secondary">
        {label}
        {counter}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-fg-tertiary">{hint}</span>}
    </label>
  );
}

function LenCounter({ n, range }: { n: number; range: readonly [number, number] }) {
  const ok = n >= range[0] && n <= range[1];
  return <span className={`tabular-nums ${ok ? "text-green-700" : n > range[1] ? "text-red-600" : "text-fg-tertiary"}`}>{n} / {range[0]}–{range[1]}</span>;
}

export default function BlogPostForm({ initial }: { initial: BlogFormValues }) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [v, setV] = useState<BlogFormValues>(initial);
  const [saved, setSaved] = useState<BlogFormValues>(initial);
  const [tab, setTab] = useState<BlogLang>(initial.t.en.enabled || !initial.t.ar.enabled ? "en" : "ar");
  const [pending, start] = useTransition();
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);
  const isNew = !v.id;
  const dirty = useMemo(() => JSON.stringify(v) !== JSON.stringify(saved), [v, saved]);

  const set = <K extends keyof BlogFormValues>(k: K, val: BlogFormValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const setT = useCallback(
    (lang: BlogLang, patch: Partial<TranslationState>) =>
      setV((s) => {
        const cur = { ...s.t[lang], ...patch };
        // The slug follows the title until it is edited by hand.
        if (patch.title !== undefined && !cur.slugTouched) cur.slug = slugify(patch.title);
        return { ...s, t: { ...s.t, [lang]: cur } };
      }),
    [],
  );

  // Live SEO (deferred so typing in the editor stays smooth).
  const deferred = useDeferredValue(v);
  const reports = useMemo(() => {
    const out = {} as Record<BlogLang, SeoReport>;
    for (const l of BLOG_LANGS) {
      const t = deferred.t[l];
      out[l] = analyzeSeo({
        lang: l, title: t.title, slug: t.slug, excerpt: t.excerpt, seoTitle: t.seoTitle, seoDescription: t.seoDescription,
        focusKeyword: t.focusKeyword, coverImageUrl: deferred.coverImageUrl, coverImageAlt: t.coverImageAlt, contentHtml: t.contentHtml,
      });
    }
    return out;
  }, [deferred]);

  const enabledLangs = BLOG_LANGS.filter((l) => v.t[l].enabled);
  const scheduled = v.publishedAt && new Date(v.publishedAt) > new Date();

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  function toInput(status: BlogFormValues["status"]): BlogPostInput {
    return {
      id: v.id,
      status,
      publishedAt: v.publishedAt,
      category: v.category,
      coverImageUrl: v.coverImageUrl,
      isFeatured: v.isFeatured,
      authorName: v.authorName,
      authorNameAr: v.authorNameAr,
      translations: Object.fromEntries(
        BLOG_LANGS.map((l) => {
          const t = v.t[l];
          return [
            l,
            t.enabled
              ? {
                  slug: t.slug, title: t.title, excerpt: t.excerpt, contentJson: t.contentJson ?? { type: "doc", content: [] },
                  contentHtml: t.contentHtml, coverImageAlt: t.coverImageAlt, seoTitle: t.seoTitle,
                  seoDescription: t.seoDescription, focusKeyword: t.focusKeyword,
                  tags: t.tagsText.split(/[,،\n]/).map((x) => x.trim()).filter(Boolean),
                }
              : null,
          ];
        }),
      ),
    };
  }

  async function persist(status: BlogFormValues["status"], okMsg: string): Promise<string | null> {
    if (enabledLangs.length === 0) {
      toast.error("Enable at least one language");
      return null;
    }
    if (status === "PUBLISHED") {
      const blocked = enabledLangs.find((l) => reports[l].blockers.length);
      if (blocked) {
        setTab(blocked);
        toast.error(`${LANG_LABEL[blocked]} can't be published yet`, {
          description: reports[blocked].blockers.map((b) => b.label).join(" · "),
        });
        return null;
      }
    }
    const res = await saveBlogPost(toInput(status));
    if (!res.ok) {
      const lang = res.field?.split(".")[0];
      if (lang === "en" || lang === "ar") setTab(lang);
      toast.error(res.error);
      return null;
    }
    const next: BlogFormValues = {
      ...v,
      id: res.id,
      status,
      publishedAt: status === "PUBLISHED" && !v.publishedAt ? new Date().toISOString() : v.publishedAt,
    };
    setV(next);
    setSaved(next);
    toast.success(okMsg);
    if (isNew) router.replace(`/admin/blog/${res.id}`);
    else router.refresh();
    return res.id;
  }

  const save = (status: BlogFormValues["status"], msg: string) => start(async () => { await persist(status, msg); });

  const primary = () => {
    if (v.status === "PUBLISHED") return save("PUBLISHED", "Article updated");
    return save("PUBLISHED", scheduled ? "Article scheduled" : "Article published");
  };

  // Ctrl/Cmd+S saves (keeps the current status).
  const saveRef = useRef<() => void>(() => {});
  saveRef.current = () => save(v.status, v.status === "PUBLISHED" ? "Article updated" : "Draft saved");
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  function preview() {
    const w = window.open("about:blank", "_blank");
    start(async () => {
      let id = v.id ?? null;
      if (!id || dirty) id = await persist(v.status === "PUBLISHED" ? "PUBLISHED" : v.status, "Saved");
      if (!id) return void w?.close();
      if (w) w.location.href = `/blog/preview/${id}/${tab}`;
    });
  }

  async function remove() {
    if (!v.id) return;
    const { confirmed } = await confirm({
      title: "Delete this article?",
      description: "Both language versions are removed permanently and the public URL stops working.",
      tone: "destructive",
      confirmLabel: "Delete",
      cancelLabel: "Keep",
    });
    if (!confirmed) return;
    start(async () => {
      await deleteBlogPost(v.id!);
      setSaved(v); // no unsaved-changes prompt
      toast.success("Article deleted");
      router.push("/admin/blog");
    });
  }

  async function onCover(file: File | undefined) {
    if (!file) return;
    setCoverUploading(true);
    try {
      set("coverImageUrl", await uploadBlogMedia(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setCoverUploading(false);
    }
  }

  function toggleLang(l: BlogLang, on: boolean) {
    if (!on && enabledLangs.length === 1) return void toast.error("An article needs at least one language");
    setT(l, { enabled: on });
    if (on) setTab(l);
    else if (tab === l) setTab(l === "en" ? "ar" : "en");
  }

  const t = v.t[tab];
  const dir = tab === "ar" ? "rtl" : "ltr";
  const liveUrl = saved.status === "PUBLISHED" && saved.t[tab].enabled && saved.t[tab].slug ? blogPostPath(tab, saved.t[tab].slug) : null;

  return (
    <div className="space-y-5">
      {/* ── Sticky action bar ── */}
      <div className="sticky top-[104px] z-10 -mx-3 flex flex-wrap items-center gap-3 border-b border-border-default bg-canvas/95 px-3 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Link href="/admin/blog" className="inline-flex items-center gap-1.5 text-sm text-fg-secondary hover:text-fg">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> Articles
        </Link>
        <span className="text-fg-tertiary">/</span>
        <h2 className="min-w-0 max-w-[40ch] truncate text-sm font-semibold text-fg">
          {v.t.en.title || v.t.ar.title || (isNew ? "New article" : "Untitled")}
        </h2>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            saved.status === "PUBLISHED"
              ? scheduled ? "bg-orange-50 text-orange-700" : "bg-green-50 text-green-700"
              : saved.status === "ARCHIVED" ? "bg-gray-100 text-gray-600" : "bg-brand-50 text-brand-700"
          }`}
        >
          {saved.status === "PUBLISHED" && scheduled ? "Scheduled" : STATUS_LABEL[saved.status]}
        </span>
        {dirty && <span className="text-xs text-orange-600">● Unsaved changes</span>}

        <div className="ms-auto flex items-center gap-2">
          {liveUrl && (
            <a href={liveUrl} target="_blank" rel="noreferrer" className="hidden items-center gap-1 text-xs text-fg-secondary hover:text-brand-600 md:inline-flex">
              View live <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <Button variant="ghost" size="sm" onClick={preview} disabled={pending}>
            <Eye className="h-4 w-4" /> Preview
          </Button>
          {v.status === "PUBLISHED" ? (
            <Button variant="secondary" size="sm" onClick={() => save("DRAFT", "Article unpublished")} disabled={pending}>
              Unpublish
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => save("DRAFT", "Draft saved")} disabled={pending}>
              Save draft
            </Button>
          )}
          <Button size="sm" onClick={primary} loading={pending} disabled={pending}>
            {v.status === "PUBLISHED" ? "Update" : scheduled ? <><CalendarClock className="h-4 w-4" /> Schedule</> : "Publish"}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── Main column ── */}
        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-border-default bg-surface">
            {/* Language tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default px-4 pt-3">
              <div role="tablist" className="flex gap-1">
                {BLOG_LANGS.map((l) => (
                  <button
                    key={l}
                    role="tab"
                    type="button"
                    aria-selected={tab === l}
                    disabled={!v.t[l].enabled}
                    onClick={() => setTab(l)}
                    className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 pb-2.5 pt-1 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      tab === l ? "border-brand-500 text-brand-700" : "border-transparent text-fg-secondary hover:text-fg"
                    } ${l === "ar" ? "font-arabic" : ""}`}
                  >
                    {LANG_LABEL[l]}
                    {v.t[l].enabled && <ScorePill score={reports[l].score} />}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-4 pb-2.5">
                <span className="text-xs text-fg-tertiary">Publish in:</span>
                {BLOG_LANGS.map((l) => (
                  <Toggle key={l} size="sm" label={l === "en" ? "EN" : "AR"} checked={v.t[l].enabled} onCheckedChange={(c) => toggleLang(l, c)} />
                ))}
              </div>
            </div>

            {t.enabled ? (
              <div className="space-y-4 p-4 sm:p-5" dir={dir} lang={tab}>
                <textarea
                  value={t.title}
                  onChange={(e) => setT(tab, { title: e.target.value.replace(/\n/g, " ") })}
                  placeholder={tab === "ar" ? "عنوان المقال" : "Article title"}
                  rows={1}
                  className="w-full resize-none border-0 bg-transparent p-0 text-[28px] font-bold leading-tight tracking-tight text-fg placeholder:text-fg-tertiary/60 focus:outline-none focus:ring-0 sm:text-[32px] [field-sizing:content]"
                />
                <div className="flex flex-wrap items-center gap-1 rounded-lg bg-canvas px-3 py-2 text-xs" dir="ltr">
                  <span className="text-fg-tertiary">{SITE_URL.replace(/^https?:\/\//, "")}/blog/{tab}/</span>
                  <input
                    value={t.slug}
                    dir={tab === "ar" ? "rtl" : "ltr"}
                    onChange={(e) => setT(tab, { slug: e.target.value.toLowerCase().replace(/\s+/g, "-"), slugTouched: true })}
                    onBlur={() => setT(tab, { slug: slugify(t.slug) })}
                    placeholder="url-slug"
                    className="min-w-[160px] flex-1 border-0 bg-transparent p-0 font-medium text-fg focus:outline-none focus:ring-0"
                  />
                  {t.slugTouched && (
                    <button
                      type="button"
                      title="Regenerate from title"
                      onClick={() => setT(tab, { slug: slugify(t.title), slugTouched: false })}
                      className="text-fg-tertiary hover:text-brand-600"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <Field
                  label={tab === "ar" ? "المقتطف — يظهر في بطاقات المدونة" : "Excerpt — shown on blog cards and under the title"}
                  counter={<span className="tabular-nums text-fg-tertiary">{t.excerpt.length}/300</span>}
                >
                  <textarea
                    value={t.excerpt}
                    onChange={(e) => setT(tab, { excerpt: e.target.value.slice(0, 300) })}
                    rows={2}
                    className={inputCls}
                    placeholder={tab === "ar" ? "ملخص قصير وجذاب للمقال…" : "A short, compelling summary of the article…"}
                  />
                </Field>

                <RichTextEditor
                  key={tab}
                  dir={dir}
                  initialContent={t.contentJson}
                  placeholder={tab === "ar" ? "ابدأ الكتابة هنا… استخدم العناوين H2 لتقسيم المقال" : "Start writing… use H2 headings to split the article into sections"}
                  onChange={({ json, html }) => setT(tab, { contentJson: json, contentHtml: html })}
                />
              </div>
            ) : (
              <div className="p-10 text-center text-sm text-fg-tertiary">This language is turned off for this article.</div>
            )}
          </section>

          {t.enabled && (
            <section className="rounded-2xl border border-border-default bg-surface p-4 sm:p-5" dir={dir}>
              <h3 className="text-sm font-semibold text-fg" dir="ltr">Search engine & sharing · {LANG_LABEL[tab]}</h3>
              <p className="mt-0.5 text-xs text-fg-tertiary" dir="ltr">How the article appears on Google, WhatsApp, LinkedIn and X. Empty fields fall back to the title and excerpt.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Focus keyword" hint="The main phrase people search for, e.g. “furnished apartment management Salalah”.">
                  <input value={t.focusKeyword} onChange={(e) => setT(tab, { focusKeyword: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Tags" hint="Comma-separated. Shown at the end of the article.">
                  <input value={t.tagsText} onChange={(e) => setT(tab, { tagsText: e.target.value })} className={inputCls} placeholder="khareef, pricing, hotels" />
                </Field>
                <Field label="SEO title" counter={<LenCounter n={(t.seoTitle || t.title).length} range={TITLE_RANGE} />}>
                  <input value={t.seoTitle} onChange={(e) => setT(tab, { seoTitle: e.target.value })} className={inputCls} placeholder={t.title || "Defaults to the article title"} />
                </Field>
                <Field label="Cover image alt text *" hint="Describe the cover image (required).">
                  <input value={t.coverImageAlt} onChange={(e) => setT(tab, { coverImageAlt: e.target.value })} className={inputCls} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Meta description *" counter={<LenCounter n={(t.seoDescription || t.excerpt).length} range={DESCRIPTION_RANGE} />}>
                    <textarea value={t.seoDescription} onChange={(e) => setT(tab, { seoDescription: e.target.value })} rows={3} className={inputCls} placeholder={t.excerpt || "Defaults to the excerpt"} />
                  </Field>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* ── Sidebar ── */}
        <aside className="space-y-5 lg:sticky lg:top-[172px] lg:max-h-[calc(100vh-190px)] lg:self-start lg:overflow-y-auto lg:pb-4">
          <Card title="Publishing">
            <div className="space-y-3">
              <Field label="Publish date" hint="Leave empty to publish now. A future date schedules the article.">
                <input
                  type="datetime-local"
                  value={toLocalInput(v.publishedAt)}
                  onChange={(e) => set("publishedAt", e.target.value ? new Date(e.target.value).toISOString() : null)}
                  className={inputCls}
                />
              </Field>
              <Field label="Category">
                <select value={v.category} onChange={(e) => set("category", e.target.value)} className={inputCls}>
                  {BLOG_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.en} · {c.ar}</option>)}
                </select>
              </Field>
              <Toggle
                label={<span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-500" /> Featured article</span>}
                description="Shown big at the top of the blog (only one at a time)."
                checked={v.isFeatured}
                onCheckedChange={(c) => set("isFeatured", c)}
              />
              {v.status === "PUBLISHED" && (
                <button type="button" onClick={() => save("ARCHIVED", "Article archived")} className="text-xs text-fg-tertiary underline-offset-2 hover:text-fg hover:underline">
                  Archive (hide from the blog, keep for later)
                </button>
              )}
            </div>
          </Card>

          <Card
            title="Cover image *"
            action={v.coverImageUrl ? (
              <button type="button" onClick={() => set("coverImageUrl", null)} className="text-fg-tertiary hover:text-red-600" title="Remove cover">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          >
            <button
              type="button"
              onClick={() => coverInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); void onCover(e.dataTransfer.files[0]); }}
              className="group relative flex aspect-[1200/630] w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border-default bg-canvas transition-colors hover:border-brand-300"
            >
              {v.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1.5 text-xs text-fg-tertiary">
                  <ImagePlus className="h-6 w-6" />
                  Click or drop an image
                  <span className="text-[11px]">1200×630 recommended</span>
                </span>
              )}
              {coverUploading && (
                <span className="absolute inset-0 flex items-center justify-center bg-white/70"><Loader2 className="h-5 w-5 animate-spin text-brand-600" /></span>
              )}
              {v.coverImageUrl && !coverUploading && (
                <span className="absolute inset-x-0 bottom-0 bg-black/50 py-1.5 text-center text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">Replace</span>
              )}
            </button>
            <input ref={coverInput} type="file" accept="image/*" hidden onChange={(e) => { void onCover(e.target.files?.[0]); e.target.value = ""; }} />
          </Card>

          {t.enabled && <SeoPanel report={reports[tab]} lang={tab} slug={t.slug} />}

          <Card title="Author">
            <div className="grid gap-3">
              <Field label="Name (English)"><input value={v.authorName} onChange={(e) => set("authorName", e.target.value)} className={inputCls} /></Field>
              <Field label="Name (Arabic)"><input dir="rtl" value={v.authorNameAr} onChange={(e) => set("authorNameAr", e.target.value)} className={inputCls} /></Field>
            </div>
          </Card>

          {!isNew && (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete article
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
