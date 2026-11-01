"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Container from "../../ui/Container";
import { MarketingButton } from "../../ui/MarketingButton";
import { BinayaMark } from "../BinayaMark";
import { DuoIcon } from "../icons";
import { Laptop, Phone } from "../Device";
import { SCREENS } from "@/lib/marketing/screens";
import { whatsappUrl, WHATSAPP_DISPLAY } from "@/lib/marketing/whatsapp";
import s from "../landing.module.css";

/* Landing v2 · section 8 — the video's end card + contact (scene 11). Replaces the old final CTA and
 * contact sections. The form is honest: it does not "submit" anywhere — it opens WhatsApp with the
 * visitor's name, phone and message written, ready to send to the sales number. */

export function EndCard() {
  const t = useTranslations("marketing.endcard");
  const tNav = useTranslations("marketing.nav");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next = { name: name.trim() ? undefined : t("nameError"), phone: phone.trim() ? undefined : t("phoneError") };
    setErrors(next);
    if (next.name || next.phone) return;
    const text = [t("template", { name: name.trim(), phone: phone.trim() }), message.trim()].filter(Boolean).join("\n");
    window.open(whatsappUrl(text), "_blank", "noopener,noreferrer");
  };

  const field =
    "mt-1.5 block w-full rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-[16px] text-white placeholder:text-white/45 outline-none transition-colors focus:border-[#85B7EB] focus:bg-white/15";

  return (
    <section id="contact" data-screen-label="End card" className={`${s.root} ${s.story} scroll-mt-16`}>
      {/* the video's end-card backdrop: the bedroom photo, darkened under the navy */}
      <div aria-hidden="true" className="absolute inset-0 -z-[1]">
        <Image src="/marketing/photos/bedroom.webp" alt="" fill sizes="100vw" quality={70} className="object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B1F3A] via-[#0B1F3A]/85 to-[#0B1F3A]" />
      </div>
      <div className={s.hex} aria-hidden="true" />

      <Container wide className="relative py-20 md:py-28">
        {/* logo lockup, line and the two actions */}
        <div className="flex flex-col items-center text-center">
          <div dir="ltr" className="flex items-center gap-4">
            <BinayaMark size={64} className="h-14 w-14 md:h-16 md:w-16" />
            <span className="text-[56px] font-semibold leading-none tracking-[-0.03em] md:text-[72px] [font-family:var(--font-poppins),sans-serif]">
              Binaya
            </span>
          </div>
          <p className="mt-6 max-w-[620px] text-[18px] leading-[1.7] text-white/80 md:text-[21px]">{t("sub")}</p>
          <div className="mt-8 flex w-full max-w-[560px] flex-col gap-3 sm:flex-row">
            <a
              href={whatsappUrl(tNav("whatsappText"))}
              target="_blank"
              rel="noopener noreferrer"
              data-cta="endcard-whatsapp"
              className={`${s.ctaGold} inline-flex h-14 flex-1 items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl px-6 text-[18px] font-bold`}
            >
              <DuoIcon name="whatsappLogo" size={24} duo="#0B1F3A" duoOpacity={0.18} />
              {t("ctaWhatsapp")}
            </a>
            <div className="flex-1">
              <MarketingButton href="/login?mode=signup" variant="secondary" size="xl" fullWidth>
                {t("ctaSignup")}
              </MarketingButton>
            </div>
          </div>
          <ul className="mt-6 flex list-none flex-wrap justify-center gap-2.5 p-0 text-[15px] font-semibold md:text-[16px]">
            <li className={`${s.glass} inline-flex items-center gap-2 rounded-full px-4 py-2`}>
              <DuoIcon name="globe" size={20} className="text-[#85B7EB]" />
              <bdi dir="ltr">binaya.app</bdi>
            </li>
            <li className={`${s.glass} inline-flex items-center gap-2 rounded-full px-4 py-2`}>
              <DuoIcon name="whatsappLogo" size={20} className="text-[#85B7EB]" />
              {t("whatsappChip")} <bdi dir="ltr">{WHATSAPP_DISPLAY}</bdi>
            </li>
            <li className={`${s.glass} inline-flex items-center gap-2 rounded-full px-4 py-2`}>
              <DuoIcon name="mapPin" size={20} className="text-[#85B7EB]" />
              {t("location")}
            </li>
          </ul>
        </div>

        {/* devices (real screens) + the WhatsApp form */}
        <div className="mt-16 grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14">
          <div className="relative mx-auto w-full max-w-[620px]" role="img" aria-label={t("devicesAlt")}>
            <Laptop>
              <Image src={SCREENS.dashboard.src} alt="" fill sizes="(min-width: 1024px) 620px, 92vw" unoptimized className="object-cover object-top" />
            </Laptop>
            <div className="absolute -bottom-6 w-[30%] ltr:-right-2 rtl:-left-2">
              <Phone>
                <Image src={SCREENS.invoice.src} alt="" fill sizes="190px" unoptimized className="object-cover object-top" />
              </Phone>
            </div>
          </div>

          <form onSubmit={onSubmit} noValidate className={`${s.glass} p-6 md:p-8`}>
            <h3 className="text-[22px] font-bold md:text-[24px]">{t("formTitle")}</h3>
            <label className="mt-5 block text-[15px] font-semibold text-white/85">
              {t("name")}
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={!!errors.name} className={field} />
              {errors.name && <span role="alert" className="mt-1 block text-[14px] text-red-300">{errors.name}</span>}
            </label>
            <label className="mt-4 block text-[15px] font-semibold text-white/85">
              {t("phone")}
              <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" dir="ltr" aria-invalid={!!errors.phone} className={`${field} rtl:text-right`} />
              {errors.phone && <span role="alert" className="mt-1 block text-[14px] text-red-300">{errors.phone}</span>}
            </label>
            <label className="mt-4 block text-[15px] font-semibold text-white/85">
              {t("message")}
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className={`${field} resize-none`} />
            </label>
            <button
              type="submit"
              data-cta="endcard-form"
              className={`${s.ctaGold} mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[17px] font-bold`}
            >
              <DuoIcon name="whatsappLogo" size={22} duo="#0B1F3A" duoOpacity={0.18} />
              {t("send")}
            </button>
            <p className="mt-3 text-center text-[14px] text-white/65">{t("note")}</p>
          </form>
        </div>
      </Container>
    </section>
  );
}
