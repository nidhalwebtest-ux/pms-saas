import type { SiteView } from "@/lib/public-site/render";

/** Section eyebrow + title. Classic centres it under a diamond ornament; the others align it to the start. */
export default function SectionHead({ v, eyebrow, title }: { v: SiteView; eyebrow: string; title: string }) {
  const { theme } = v;
  const display = "font-[family-name:var(--font-display)]";
  if (theme.key === "template_2") {
    return (
      <div className="mb-10 text-center">
        <p className={theme.eyebrow} style={{ color: "var(--site-accent)" }}>{eyebrow}</p>
        <h2 className={`${display} ${theme.sectionTitle}`}>{title}</h2>
        <div className="mt-5 flex items-center justify-center gap-3" aria-hidden="true">
          <span className="h-px w-14" style={{ background: "var(--site-accent)" }} />
          <span className="h-1.5 w-1.5 rotate-45" style={{ background: "var(--site-accent)" }} />
          <span className="h-px w-14" style={{ background: "var(--site-accent)" }} />
        </div>
      </div>
    );
  }
  return (
    <div className="mb-8">
      <p className={theme.eyebrow} style={{ color: theme.key === "template_3" ? "var(--site-primary)" : "var(--site-accent)" }}>{eyebrow}</p>
      <h2 className={`${display} ${theme.sectionTitle}`}>{title}</h2>
    </div>
  );
}
