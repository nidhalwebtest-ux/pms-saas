"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { useSite } from "@/lib/public-site/context";
import { waNumber } from "@/lib/public-site/format";
import { submitBookingRequest } from "./actions";

export default function BookingForm({
  unitId, unitName, startDate, endDate, guests,
}: {
  unitId: string; unitName: string; startDate: string; endDate: string; guests: number;
}) {
  const { dict, slug, whatsapp, lang } = useSite();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wa = waNumber(whatsapp);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) { setError(dict.booking.required); return; }
    setBusy(true); setError(null);
    const res = await submitBookingRequest({
      slug, unitId, startDate, endDate, guests,
      guestName: name, guestPhone: phone, guestEmail: email, notes,
    });
    setBusy(false);
    if (res.ok) setDone(true);
    else setError(dict.booking.failed);
  };

  if (done) {
    const msg =
      (lang === "ar"
        ? `طلب حجز — ${unitName}\nمن ${startDate} إلى ${endDate} · ${guests} ضيوف\nالاسم: ${name}`
        : `Booking request — ${unitName}\n${startDate} → ${endDate} · ${guests} guests\nName: ${name}`);
    return (
      <div className="rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <CheckCircleIcon className="h-9 w-9 text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">{dict.booking.successTitle}</h2>
        <p className="mx-auto mt-2 max-w-sm text-slate-600">{dict.booking.successMsg}</p>
        <div className="mt-6 flex flex-col items-center gap-2">
          {wa && (
            <a
              href={`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
            >
              {dict.booking.whatsappCta}
            </a>
          )}
          <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-800">{dict.booking.backToSite}</Link>
        </div>
      </div>
    );
  }

  const field = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[color:var(--site-primary)] focus:ring-2 focus:ring-[color:var(--site-primary)]/20";

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">{dict.booking.details}</h2>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-600">{dict.booking.name} <span className="text-red-500">*</span></span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={field} required />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-600">{dict.booking.phone} <span className="text-red-500">*</span></span>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} dir="ltr" required />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-600">{dict.booking.email}</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} dir="ltr" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-600">{dict.booking.notes}</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={field} />
      </label>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl py-3 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
        style={{ background: "var(--site-primary)" }}
      >
        {busy ? dict.booking.submitting : dict.booking.submit}
      </button>
    </form>
  );
}
