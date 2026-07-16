"use client";

import { useSite } from "@/lib/public-site/context";
import { waNumber } from "@/lib/public-site/format";

/** Always-visible WhatsApp button — the real CTA in Oman. */
export default function WhatsAppFab() {
  const { whatsapp } = useSite();
  const num = waNumber(whatsapp);
  if (!num) return null;

  return (
    <a
      href={`https://wa.me/${num}`}
      target="_blank"
      rel="noreferrer"
      aria-label="WhatsApp"
      className="fixed bottom-5 end-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition hover:scale-105 active:scale-95"
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current">
        <path d="M12 2a10 10 0 00-8.6 15l-1.4 5 5.1-1.3A10 10 0 1012 2zm0 18a8 8 0 01-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1112 20zm4.4-6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.5 6.5 0 01-1.9-1.2 7.3 7.3 0 01-1.3-1.7c-.1-.2 0-.4.1-.5l.4-.4.3-.5c.1-.1 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a1 1 0 00-.7.3A2.8 2.8 0 006 9.3c0 1.7 1.2 3.3 1.4 3.5.2.2 2.4 3.7 5.8 5 .8.3 1.5.5 2 .7.8.2 1.6.2 2.2.1.7-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1 0-.1-.2-.2-.4-.3z" />
      </svg>
    </a>
  );
}
