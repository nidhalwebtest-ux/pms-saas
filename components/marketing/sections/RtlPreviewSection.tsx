import Container, { SectionHead } from "../ui/Container";

/* ============================================================================
 *  RtlPreview — placeholder
 *  TODO: paste design markup once provided. The drop referenced this
 *  section by name but did not include its body. Renders a labeled
 *  placeholder card so the page composition lands cleanly.
 * ========================================================================= */
export default function RtlPreviewSection() {
  return (
    <section data-screen-label="RTL Preview" className="py-16 md:py-24">
      <Container>
        <SectionHead
          eyebrow="Arabic-first"
          title="Built right-to-left from day one."
          description="Every screen, every form, every report renders correctly in Arabic — not as an afterthought, but as a first-class layout."
        />
        <div className="grid gap-6 md:grid-cols-2" dir="rtl">
          <div className="aspect-[4/3] rounded-xl border border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100 grid place-items-center font-mono text-[10.5px] uppercase tracking-[0.08em] text-gray-400">
            <span className="rounded-full border border-dashed border-gray-300 bg-white/70 px-3 py-1.5">
              RTL dashboard preview
            </span>
          </div>
          <div className="aspect-[4/3] rounded-xl border border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100 grid place-items-center font-mono text-[10.5px] uppercase tracking-[0.08em] text-gray-400">
            <span className="rounded-full border border-dashed border-gray-300 bg-white/70 px-3 py-1.5">
              RTL invoice preview
            </span>
          </div>
        </div>
      </Container>
    </section>
  );
}
