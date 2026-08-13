"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Phone, Mail, MapPin, MessageSquare, Send, CheckCircle2 } from "lucide-react";
import Container from "../ui/Container";

export default function ContactSection() {
  const locale = useLocale();
  const isAr = locale === "ar";

  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: "", phone: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;
    setSubmitted(true);
  };

  const whatsappUrl = "https://wa.me/96898590405?text=" + encodeURIComponent(
    isAr ? "مرحبًا بناية، أود التحدث مع فريق المبيعات والاستفسار عن النظام." : "Hello Binaya, I would like to speak with sales about Binaya PMS."
  );

  return (
    <section id="contact" data-screen-label="Contact" className="border-b border-gray-200 bg-gray-50/50 py-16 md:py-24">
      <Container className="max-w-[1140px]">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-600">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{isAr ? "تواصل معنا" : "Contact Us"}</span>
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            {isAr ? "نحن هنا لمساعدتك في أتمتة وإدارة مبانيك" : "We're here to help you automate your property operations"}
          </h2>
          <p className="mt-3 text-lg text-gray-600">
            {isAr
              ? "تحدث مباشرة مع فريق خبراء بناية في صلالة وعُمان عبر الواتساب أو الهاتف أو أرسل استفسارك وسنعاود الاتصال بك."
              : "Speak directly with our team in Salalah, Oman via WhatsApp or phone, or send an inquiry below."}
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-12 items-start">
          {/* Direct Contact Cards */}
          <div className="lg:col-span-5 space-y-4">
            {/* WhatsApp Card */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:border-[#25D366] hover:shadow-md"
            >
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-[#25D366]/10 text-[#25D366] transition-colors group-hover:bg-[#25D366] group-hover:text-white">
                <MessageSquare className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-500">{isAr ? "محادثات الواتساب الفورية" : "WhatsApp Direct Chat"}</h3>
                <p className="text-lg font-bold text-gray-900 dir-ltr">+968 9859 0405</p>
                <p className="text-xs text-[#25D366] font-medium mt-0.5">{isAr ? "انقر للمحادثات المباشرة ←" : "Click to chat now →"}</p>
              </div>
            </a>

            {/* Phone Card */}
            <a
              href="tel:+96898590405"
              className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:border-brand-500 hover:shadow-md"
            >
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                <Phone className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-500">{isAr ? "الاتصال المباشر" : "Direct Phone Call"}</h3>
                <p className="text-lg font-bold text-gray-900 dir-ltr">+968 9859 0405</p>
                <p className="text-xs text-brand-600 font-medium mt-0.5">{isAr ? "متاح طوال أيام الأسبوع" : "Available 7 days a week"}</p>
              </div>
            </a>

            {/* Location Card */}
            <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <MapPin className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-500">{isAr ? "الموقع والمقر" : "Location"}</h3>
                <p className="text-base font-bold text-gray-900">
                  {isAr ? "صلالة، محافظة ظفار، سلطنة عُمان 🇴🇲" : "Salalah, Dhofar Governorate, Sultanate of Oman 🇴🇲"}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Inquiry Form */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900">
                {isAr ? "أرسل طلب استفسار أو تجربة" : "Send an Inquiry or Request Demo"}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {isAr ? "اترك بياناتك وسيتواصل معك فريقنا خلال أقل من ساعتين." : "Leave your details and our team will get back to you within 2 hours."}
              </p>

              {submitted ? (
                <div className="mt-6 rounded-2xl bg-emerald-50 border border-emerald-200 p-6 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                  <h4 className="mt-3 text-lg font-bold text-emerald-900">
                    {isAr ? "تم استلام استفسارك بنجاح!" : "Inquiry Received Successfully!"}
                  </h4>
                  <p className="mt-1 text-sm text-emerald-700">
                    {isAr ? "شكراً لتواصلك معنا. سيتواصل معك أحد مستشاري بناية قريباً." : "Thank you for reaching out. A Binaya advisor will contact you shortly."}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      {isAr ? "الاسم الكامل *" : "Full Name *"}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={isAr ? "مثال: أحمد الرواحي" : "e.g. Ahmed Al-Rawahi"}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      {isAr ? "رقم الهاتف / الواتساب *" : "Phone / WhatsApp Number *"}
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder={isAr ? "مثال: +968 9859 0405" : "e.g. +968 9859 0405"}
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      {isAr ? "تفاصيل الاستفسار أو عدد المباني" : "Inquiry Details / Number of Buildings"}
                    </label>
                    <textarea
                      rows={3}
                      placeholder={isAr ? "أخبرنا باحتياجاتك أو عدد المباني والوحدات..." : "Tell us about your property management needs..."}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 py-3.5 text-base font-bold text-white shadow-md transition-all hover:bg-brand-600 active:scale-95"
                  >
                    <span>{isAr ? "إرسال الاستفسار" : "Submit Inquiry"}</span>
                    <Send className="h-4 w-4 rtl:rotate-180" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
