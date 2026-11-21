import { MapPinIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import type { SiteView } from "@/lib/public-site/render";
import SectionHead from "./SectionHead";

const httpUrl = (u: string | null) => (u && /^https?:\/\//i.test(u.trim()) ? u.trim() : null);
/** Only Google's own embed URLs can be framed; anything else becomes a link card. */
const isEmbed = (u: string) => /^https:\/\/www\.google\.com\/maps\/embed/i.test(u);

/**
 * Address + map. A Google "embed" URL is framed lazily (no cost until scrolled to); a normal
 * Maps link becomes a stylised card that opens Google Maps — fast, nothing third-party loads.
 */
export default function Location({ v }: { v: SiteView }) {
  const { site, dict, lang, theme } = v;
  const address = (lang === "ar" ? site.addressAr || site.addressEn : site.addressEn || site.addressAr) ?? "";
  const maps = httpUrl(site.googleMapsUrl);
  if (!address && !maps) return null;

  const link = maps && !isEmbed(maps) ? maps : address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
  const btn = `inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 ${theme.btn}`;

  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <SectionHead v={v} eyebrow={dict.more.locationEyebrow} title={dict.more.locationTitle} />
      <div className="grid items-stretch gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className={`flex flex-col justify-center bg-white p-7 ring-1 ${theme.key === "template_2" ? "ring-stone-300" : "ring-slate-900/5"} ${theme.radius}`}>
          <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--site-primary) 10%, #fff)", color: "var(--site-primary)" }}>
            <MapPinIcon className="h-5 w-5" />
          </span>
          {address && <p className="mt-4 text-lg font-medium leading-snug text-slate-900">{address}</p>}
          {link && (
            <a href={link} target="_blank" rel="noreferrer" className={`${btn} mt-6 w-fit`} style={{ background: "var(--site-primary)" }}>
              {maps && !isEmbed(maps) ? dict.more.openMap : dict.more.directions}
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </a>
          )}
        </div>

        {maps && isEmbed(maps) ? (
          <div className={`relative min-h-[260px] overflow-hidden bg-slate-100 ring-1 ring-slate-900/5 ${theme.radius}`}>
            <iframe
              src={maps}
              title={dict.more.locationTitle}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        ) : (
          <a
            href={link ?? undefined}
            target="_blank"
            rel="noreferrer"
            aria-label={dict.more.openMap}
            className={`group relative flex min-h-[220px] items-center justify-center overflow-hidden ring-1 ring-slate-900/5 ${theme.radius}`}
            style={{
              background:
                "linear-gradient(0deg, rgba(255,255,255,.55), rgba(255,255,255,.55)), repeating-linear-gradient(0deg, transparent 0 39px, color-mix(in srgb, var(--site-primary) 14%, transparent) 39px 40px), repeating-linear-gradient(90deg, transparent 0 39px, color-mix(in srgb, var(--site-primary) 14%, transparent) 39px 40px), linear-gradient(135deg, color-mix(in srgb, var(--site-primary) 14%, #fff), color-mix(in srgb, var(--site-accent) 20%, #fff))",
            }}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition group-hover:scale-110" style={{ background: "var(--site-primary)" }}>
              <MapPinIcon className="h-7 w-7" />
            </span>
          </a>
        )}
      </div>
    </section>
  );
}
