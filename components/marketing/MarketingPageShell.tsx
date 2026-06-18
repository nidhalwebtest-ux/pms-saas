import type { ReactNode } from "react";
import MarketingNavbar from "./MarketingNavbar";
import MarketingFooter from "./MarketingFooter";
import Container from "./ui/Container";

/**
 * Shared shell for static marketing/legal pages (About, Contact, Privacy,
 * Terms). Reuses the landing navbar + footer so these pages stay on-brand,
 * with a simple titled content column. Content is passed as children.
 */
export default function MarketingPageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-hidden">
      <MarketingNavbar />
      <main id="top" className="bg-white">
        <header className="border-b border-gray-200 bg-gradient-to-b from-brand-50/60 to-white">
          <Container className="py-14 sm:py-20">
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-gray-600">
                {subtitle}
              </p>
            )}
          </Container>
        </header>
        <Container className="py-12 sm:py-16">
          <div className="max-w-2xl space-y-6 text-[15px] leading-relaxed text-gray-700 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-gray-900 [&_a]:text-brand-600 [&_a:hover]:text-brand-700 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:ps-5">
            {children}
          </div>
        </Container>
      </main>
      <MarketingFooter />
    </div>
  );
}
