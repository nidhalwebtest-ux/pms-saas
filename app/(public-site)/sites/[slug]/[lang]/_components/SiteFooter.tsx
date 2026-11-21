import { EnvelopeIcon, PhoneIcon, MapPinIcon } from "@heroicons/react/24/outline";
import type { SiteView } from "@/lib/public-site/render";
import { waNumber } from "@/lib/public-site/format";

/** Server component. */
export default function SiteFooter({
  v, phone, email, address, instagram, mapsUrl,
}: {
  v: SiteView;
  phone: string | null; email: string | null; address: string | null;
  instagram: string | null; mapsUrl: string | null;
}) {
  const { dict, siteName } = v;
  const wa = waNumber(v.site.whatsappNumber);
  const year = new Date().getUTCFullYear();

  return (
    <footer id="contact" className="mt-16 border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-2">
        <div>
          <h3 className="text-lg font-bold" style={{ color: "var(--site-primary)" }}>{siteName}</h3>
          <h4 className="mt-4 text-sm font-semibold text-slate-800">{dict.sections.contactTitle}</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {wa && (
              <li>
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-slate-900">
                  <PhoneIcon className="h-4 w-4" /> WhatsApp
                </a>
              </li>
            )}
            {phone && <li className="inline-flex items-center gap-2"><PhoneIcon className="h-4 w-4" /><span dir="ltr">{phone}</span></li>}
            {email && <li><a href={`mailto:${email}`} className="inline-flex items-center gap-2 hover:text-slate-900"><EnvelopeIcon className="h-4 w-4" /><span dir="ltr">{email}</span></a></li>}
            {address && <li className="inline-flex items-start gap-2"><MapPinIcon className="mt-0.5 h-4 w-4" />{mapsUrl ? <a href={mapsUrl} target="_blank" rel="noreferrer" className="hover:text-slate-900">{address}</a> : address}</li>}
          </ul>
          {instagram && (
            <a href={instagram} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-medium hover:underline" style={{ color: "var(--site-accent)" }}>
              Instagram
            </a>
          )}
        </div>
        <div className="flex flex-col justify-end md:items-end md:text-end">
          <p className="text-xs text-slate-400">© {year} {siteName}. {dict.footer.rights}.</p>
          <a href="https://binaya.app" target="_blank" rel="noreferrer" className="mt-1 text-xs text-slate-400 hover:text-slate-600">
            {dict.footer.poweredBy}
          </a>
        </div>
      </div>
    </footer>
  );
}
