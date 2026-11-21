import { EnvelopeIcon, PhoneIcon, MapPinIcon } from "@heroicons/react/24/outline";
import type { SiteView } from "@/lib/public-site/render";
import { waNumber } from "@/lib/public-site/format";

/** Server component. Surface and text colours come from the template's footer tokens; Classic centres its content. */
export default function SiteFooter({
  v, phone, email, address, instagram, mapsUrl,
}: {
  v: SiteView;
  phone: string | null; email: string | null; address: string | null;
  instagram: string | null; mapsUrl: string | null;
}) {
  const { dict, siteName, theme } = v;
  const f = theme.footer;
  const centered = theme.key === "template_2";
  const wa = waNumber(v.site.whatsappNumber);
  const year = new Date().getUTCFullYear();
  const row = `inline-flex items-center gap-2 ${f.hover}`;

  return (
    <footer id="contact" className={f.wrap}>
      <div className={`mx-auto max-w-6xl gap-8 px-4 py-12 sm:px-6 ${centered ? "flex flex-col items-center text-center" : "grid md:grid-cols-2"}`}>
        <div className={centered ? "flex flex-col items-center" : ""}>
          <h3 className={`text-lg font-bold font-[family-name:var(--font-display)] ${f.name}`} style={theme.key === "template_1" ? { color: "var(--site-primary)" } : undefined}>
            {siteName}
          </h3>
          <h4 className={`mt-4 text-sm font-semibold ${f.heading}`}>{dict.sections.contactTitle}</h4>
          <ul className={`mt-3 space-y-2 text-sm ${f.text} ${centered ? "flex flex-col items-center" : ""}`}>
            {wa && (
              <li>
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className={row}>
                  <PhoneIcon className="h-4 w-4" /> WhatsApp
                </a>
              </li>
            )}
            {phone && <li className="inline-flex items-center gap-2"><PhoneIcon className="h-4 w-4" /><span dir="ltr">{phone}</span></li>}
            {email && <li><a href={`mailto:${email}`} className={row}><EnvelopeIcon className="h-4 w-4" /><span dir="ltr">{email}</span></a></li>}
            {address && <li className="inline-flex items-start gap-2"><MapPinIcon className="mt-0.5 h-4 w-4" />{mapsUrl ? <a href={mapsUrl} target="_blank" rel="noreferrer" className={f.hover}>{address}</a> : address}</li>}
          </ul>
          {instagram && (
            <a href={instagram} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-medium hover:underline" style={{ color: "var(--site-accent)" }}>
              Instagram
            </a>
          )}
        </div>
        <div className={`flex flex-col justify-end ${centered ? "items-center" : "md:items-end md:text-end"}`}>
          <p className={`text-xs ${f.muted}`}>© {year} {siteName}. {dict.footer.rights}.</p>
          <a href="https://binaya.app" target="_blank" rel="noreferrer" className={`mt-1 text-xs ${f.muted} ${f.hover}`}>
            {dict.footer.poweredBy}
          </a>
        </div>
      </div>
    </footer>
  );
}
