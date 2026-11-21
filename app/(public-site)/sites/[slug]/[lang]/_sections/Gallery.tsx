import type { SiteView } from "@/lib/public-site/render";
import Img from "../_components/Img";
import SectionHead from "./SectionHead";

/** Column spans (on the 4-column desktop grid) that fill every row for any photo count. */
function spansFor(n: number): { col: number; big: boolean }[] {
  const tail = (r: number) => (r === 1 ? [4] : r === 2 ? [2, 2] : r === 3 ? [2, 1, 1] : []);
  if (n < 5) return (n === 1 ? [4] : n === 2 ? [2, 2] : n === 3 ? [2, 1, 1] : [1, 1, 1, 1]).map((col) => ({ col, big: false }));
  const m = n - 5; // after the large tile + the 4 small tiles beside it
  return [
    { col: 2, big: true },
    ...Array.from({ length: 4 + (m - (m % 4)) }, () => ({ col: 1, big: false })),
    ...tail(m % 4).map((col) => ({ col, big: false })),
  ];
}
const COL_SPAN: Record<number, string> = { 1: "", 2: "sm:col-span-2", 4: "sm:col-span-4" };

/** Photo mosaic: with 5+ photos the first is large. Server component; images lazy-load (zero client JS). */
export default function Gallery({ v, photos }: { v: SiteView; photos: string[] }) {
  if (photos.length === 0) return null;
  const { dict, theme, siteName } = v;
  const framed = theme.key === "template_2";
  const list = photos.slice(0, 12);
  const spans = spansFor(list.length);
  // 2-column mobile grid: the large tile is full width; if the rest is odd, the last one stretches.
  const mobileOdd = (list.length >= 5 ? list.length - 1 : list.length) % 2 === 1;

  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <SectionHead v={v} eyebrow={dict.more.galleryEyebrow} title={dict.more.galleryTitle} />
      <div className="grid auto-rows-[130px] grid-cols-2 gap-2 sm:auto-rows-[170px] sm:grid-cols-4 sm:gap-3">
        {list.map((src, i) => {
          const { col, big } = spans[i];
          return (
            <div
              key={src}
              className={`relative overflow-hidden bg-slate-200 ${theme.radius} ${framed ? "bg-white p-1 ring-1 ring-stone-300" : ""} ${big ? "col-span-2 row-span-2" : COL_SPAN[col] ?? ""} ${i === list.length - 1 && mobileOdd ? "max-sm:col-span-2" : ""}`}
            >
              <div className={`relative h-full w-full overflow-hidden ${framed ? "" : theme.radius}`}>
                <Img src={src} alt={`${siteName} ${i + 1}`} fill sizes={big ? "(max-width: 640px) 100vw, 50vw" : col === 4 ? "100vw" : "(max-width: 640px) 50vw, 25vw"} className="object-cover transition-transform duration-700 ease-out hover:scale-[1.04]" />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
