import Link from "next/link";
import { getTranslations } from "next-intl/server";
import Container from "./ui/Container";

export default async function MarketingFooter() {
  const t = await getTranslations("marketing.footer");
  const PRODUCT = [
    { href: "/#features", label: t("linkFeatures") },
    { href: "/#pricing",  label: t("linkPricing") },
    { href: "/#how",      label: t("linkHow") },
    { href: "/#faq",      label: t("linkFaq") },
  ];
  const COMPANY = [
    { href: "/about",   label: t("linkAbout") },
    { href: "/contact", label: t("linkContact") },
  ];
  const LEGAL = [
    { href: "/privacy", label: t("linkPrivacy") },
    { href: "/terms",   label: t("linkTerms") },
  ];
  const year = new Date().getFullYear();
  return (
    <footer data-screen-label="Footer" className="border-t border-gray-200 bg-white py-12">
      <Container>
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 text-[17px] font-semibold tracking-tight text-gray-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/binaya-mark.svg" alt="" className="h-[30px] w-[30px]" />
              <span>
                Binaya <span className="font-normal text-gray-500">PMS</span>
              </span>
            </Link>
            <p className="mt-4 max-w-[320px] text-[13.5px] text-gray-600">{t("tagline")}</p>
          </div>
          <FooterCol title={t("productCol")} items={PRODUCT} />
          <FooterCol title={t("companyCol")} items={COMPANY} />
          <FooterCol title={t("legalCol")}   items={LEGAL} />
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-6 font-mono text-[12px] uppercase tracking-[0.06em] text-gray-500">
          <span>{t("copyright", { year })}</span>
          <span>{t("version")}</span>
        </div>
      </Container>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: { href: string; label: string }[] }) {
  return (
    <div>
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">
        {title}
      </p>
      <ul className="mt-4 grid list-none gap-2.5 p-0">
        {items.map((i) => (
          <li key={i.href}>
            <a href={i.href} className="text-[14px] text-gray-700 hover:text-brand-700">
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
