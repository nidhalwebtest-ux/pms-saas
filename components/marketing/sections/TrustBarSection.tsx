import { getTranslations } from "next-intl/server";
import Container from "../ui/Container";

/* Trust bar — a label over four headline stats. */
type Stat = { n: string; l: string };

export default async function TrustBarSection() {
  const t = await getTranslations("marketing.trust");
  const stats = t.raw("stats") as Stat[];
  return (
    <section data-screen-label="Trust" className="border-b border-gray-200 bg-white">
      <Container className="max-w-[1100px] py-7">
        <p className="mb-5 text-center text-[13px] font-semibold uppercase tracking-[0.04em] text-gray-400">
          {t("label")}
        </p>
        <div className="flex flex-wrap justify-center gap-x-12 gap-y-6 md:gap-x-[72px]">
          {stats.map((s) => (
            <div key={s.l} className="min-w-[110px] text-center">
              <div className="font-mono text-[24px] font-semibold text-brand-500 md:text-[32px]" dir="ltr">
                {s.n}
              </div>
              <div className="mt-[3px] text-[13.5px] text-gray-600">{s.l}</div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
