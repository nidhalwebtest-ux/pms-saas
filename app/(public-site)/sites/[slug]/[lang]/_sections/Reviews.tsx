import { StarIcon } from "@heroicons/react/24/solid";
import type { SiteView } from "@/lib/public-site/render";
import type { Review } from "@/lib/public-site/sections";
import SectionHead from "./SectionHead";

const BAND: Record<string, string> = {
  template_1: "border-y border-black/5 bg-black/[0.015]",
  template_2: "border-y border-stone-300 bg-[#f3efe4]",
  template_3: "bg-slate-50",
};

/** Guest reviews entered by the operator. Shows the visitor's language, falling back to the other. */
export default function Reviews({ v, reviews }: { v: SiteView; reviews: Review[] }) {
  if (reviews.length === 0) return null;
  const { dict, lang, theme } = v;
  const centered = theme.key === "template_2";
  const cols = reviews.length === 1 ? "max-w-2xl mx-auto" : reviews.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3";

  return (
    <section className={BAND[theme.key]}>
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <SectionHead v={v} eyebrow={dict.more.reviewsEyebrow} title={dict.more.reviewsTitle} />
        <div className={`grid gap-5 ${cols}`}>
          {reviews.map((r, i) => {
            const text = lang === "ar" ? r.textAr || r.textEn : r.textEn || r.textAr;
            return (
              <figure key={i} className={`flex flex-col bg-white p-6 ring-1 ${theme.key === "template_2" ? "ring-stone-300" : "ring-slate-900/5"} ${theme.radius} ${centered ? "items-center text-center" : ""}`}>
                <div className="flex gap-0.5" role="img" aria-label={`${r.rating}/5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <StarIcon key={n} className="h-4 w-4" style={{ color: n <= r.rating ? "var(--site-accent)" : "#e2e8f0" }} />
                  ))}
                </div>
                <blockquote dir="auto" className={`mt-4 flex-1 leading-relaxed text-slate-600 ${centered ? "font-[family-name:var(--font-display)] text-lg italic" : ""}`}>
                  “{text}”
                </blockquote>
                <figcaption className="mt-5 text-sm font-bold text-slate-900">{r.name}</figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
