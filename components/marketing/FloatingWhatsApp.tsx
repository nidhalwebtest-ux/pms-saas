"use client";

import { useLocale } from "next-intl";
import { MessageSquare } from "lucide-react";

export default function FloatingWhatsApp() {
  const locale = useLocale();
  const isAr = locale === "ar";

  const whatsappUrl = "https://wa.me/96877804803?text=" + encodeURIComponent(
    isAr ? "مرحبًا بناية، أود الاستفسار عن نظام إدارة الأملاك." : "Hello Binaya, I would like to inquire about Binaya PMS."
  );

  return (
    <div className="fixed bottom-6 end-6 z-50 flex items-center gap-3">
      {/* Tooltip Label */}
      <span className="hidden sm:inline-flex rounded-xl bg-gray-900 px-3.5 py-2 text-xs font-bold text-white shadow-lg backdrop-blur-md border border-white/10 animate-bounce">
        {isAr ? "تواصل معنا عبر واتساب 👋" : "Chat with us on WhatsApp 👋"}
      </span>

      {/* Floating Button */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={isAr ? "تواصل عبر الواتساب" : "Chat on WhatsApp"}
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_10px_25px_-5px_rgba(37,211,102,0.5)] transition-all duration-300 hover:scale-110 hover:shadow-[0_15px_30px_-5px_rgba(37,211,102,0.7)] active:scale-95"
      >
        {/* Pulsing ring */}
        <span className="absolute -inset-1 animate-ping rounded-full bg-[#25D366]/40 opacity-75" />

        {/* WhatsApp Icon */}
        <svg
          className="h-7 w-7 fill-current relative z-10 transition-transform duration-300 group-hover:rotate-12"
          viewBox="0 0 24 24"
        >
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.642-.981z" />
        </svg>
      </a>
    </div>
  );
}
