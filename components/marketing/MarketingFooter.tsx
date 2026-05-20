import Link from "next/link";
import Container from "./ui/Container";

/* ============================================================================
 *  Marketing footer — placeholder body. TODO: paste real link sets / legal
 *  copy when the design hand-off lands. Stub keeps the same three-column
 *  shape as the original landing so the page bottom is presentable.
 * ========================================================================= */

const PRODUCT = [
  { href: "#features", label: "Features" },
  { href: "#pricing",  label: "Pricing" },
  { href: "#how",      label: "How it works" },
  { href: "#faq",      label: "FAQ" },
];
const COMPANY = [
  { href: "#about",   label: "About" },
  { href: "#blog",    label: "Blog" },
  { href: "#contact", label: "Contact" },
];
const LEGAL = [
  { href: "#privacy", label: "Privacy" },
  { href: "#terms",   label: "Terms" },
];

export default function MarketingFooter() {
  return (
    <footer data-screen-label="Footer" className="border-t border-gray-200 bg-white py-12">
      <Container>
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Link href="#top" className="inline-flex items-center gap-2.5 text-[17px] font-semibold tracking-tight text-gray-900">
              <span className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-brand-500 text-[15px] font-semibold text-white shadow-brand">
                B
              </span>
              <span>
                Binaya <span className="font-normal text-gray-500">PMS</span>
              </span>
            </Link>
            <p className="mt-4 max-w-[320px] text-[13.5px] text-gray-600">
              Property management software built in Salalah for the way Omani
              property managers actually work.
            </p>
          </div>
          <FooterCol title="Product" items={PRODUCT} />
          <FooterCol title="Company" items={COMPANY} />
          <FooterCol title="Legal"   items={LEGAL} />
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-6 font-mono text-[12px] uppercase tracking-[0.06em] text-gray-500">
          <span>© {new Date().getFullYear()} Binaya PMS. Made in Salalah.</span>
          <span>v0.1 · marketing preview</span>
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
