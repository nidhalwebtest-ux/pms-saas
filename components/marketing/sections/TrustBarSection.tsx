import Container from "../ui/Container";

const LOGOS = [
  { glyph: "SP", name: "Salalah Plaza" },
  { glyph: "MR", name: "Mirbat Resort" },
  { glyph: "HR", name: "Haffa Residences" },
  { glyph: "DH", name: "Dhofar Homes" },
  { glyph: "AS", name: "Al Saada Suites" },
];

export default function TrustBarSection() {
  return (
    <section data-screen-label="Trust" className="border-y border-gray-200 bg-gray-50 py-9">
      <Container className="flex flex-wrap items-center justify-center gap-8">
        <span className="font-mono text-[12px] uppercase tracking-[0.06em] text-gray-500">
          Used by property managers across Salalah
        </span>
        <div className="flex flex-wrap justify-center gap-9">
          {LOGOS.map((l) => (
            <span
              key={l.glyph}
              className="inline-flex items-center gap-2.5 text-[15px] font-medium tracking-tight text-gray-500 opacity-85"
            >
              <span className="grid h-7 w-7 place-items-center rounded-md bg-gray-200 font-mono text-[11px] font-semibold text-gray-600">
                {l.glyph}
              </span>
              {l.name}
            </span>
          ))}
        </div>
      </Container>
    </section>
  );
}
