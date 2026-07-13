import { getTranslations } from "next-intl/server";
import Container, { SectionHead } from "../ui/Container";
import { Reveal } from "../ui/Reveal";

/* ============================================================================
 *  RTL / bilingual preview — side-by-side Arabic (RTL) and English (LTR)
 *  reservation cards. Both directions render regardless of the active locale:
 *  this section *is* the demonstration of bilingual support.
 * ========================================================================= */

type Row = { unit: string; guest: string; amt: string; color: string };
type Panel = { label: string; building: string; today: string; rows: Row[] };

export default async function RtlPreviewSection() {
  const t = await getTranslations("marketing.rtl");
  const ar = t.raw("ar") as Panel;
  const en = t.raw("en") as Panel;
  return (
    <section id="rtl" data-screen-label="RTL Preview" className="border-b border-gray-200 bg-gray-50 py-16 md:py-24">
      <Container className="max-w-[1080px]">
        <SectionHead eyebrow={t("eyebrow")} title={t("title")} description={t("sub")} />
        <div className="grid gap-5 md:grid-cols-2">
          <Reveal from="right">
            <PreviewCard dir="rtl" panel={ar} fontClass="font-arabic" />
          </Reveal>
          <Reveal from="left" delay={120}>
            <PreviewCard dir="ltr" panel={en} fontClass="" />
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

function PreviewCard({ dir, panel, fontClass }: { dir: "rtl" | "ltr"; panel: Panel; fontClass: string }) {
  return (
    <div dir={dir} className={`overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_14px_32px_-20px_rgba(15,39,64,.25)] ${fontClass}`}>
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-[11px]">
        <span className="text-[12px] font-bold text-gray-600">{panel.label}</span>
        <span className="font-mono text-[11px] text-gray-400">{panel.building}</span>
      </div>
      <div className="p-[18px]">
        <div className="mb-3 text-[15px] font-bold text-gray-900">{panel.today}</div>
        {panel.rows.map((r, i) => (
          <div
            key={r.unit}
            className={["flex items-center gap-[11px] py-2.5", i < panel.rows.length - 1 ? "border-b border-gray-200" : ""].join(" ")}
          >
            <span className="h-[30px] w-[7px] rounded-[5px]" style={{ background: r.color }} />
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-gray-900">{r.unit}</div>
              <div className="text-[11.5px] text-gray-400">{r.guest}</div>
            </div>
            <span className="font-mono text-[12.5px] font-semibold text-gray-900" dir="ltr">{r.amt}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
