import { getTranslations } from "next-intl/server";

export default async function ComingSoon({ slug }: { slug: string }) {
  const t = await getTranslations("reports");
  const title = t(`items.${slug}` as never);
  return (
    <main className="rpage">
      <div className="crumbs">
        <span>{t("breadcrumbRoot")}</span>
        <svg className="ic-xs sep"><use href="#i-chev-right" /></svg>
        <span className="current">{title}</span>
      </div>
      <div className="rhead">
        <div className="title-block">
          <h1>{title}</h1>
          <p className="sub">{t("beingBuilt")}</p>
        </div>
      </div>
      <div className="state-card">
        <div className="glyph">
          <svg width="28" height="28"><use href="#i-empty" /></svg>
        </div>
        <h3>{t("comingSoonTitle")}</h3>
        <p>{t("comingSoonBody", { name: title })}</p>
      </div>
    </main>
  );
}
