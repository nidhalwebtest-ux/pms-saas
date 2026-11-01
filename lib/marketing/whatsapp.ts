/** Binaya sales WhatsApp — one place for the number and link format used across the landing page. */
export const WHATSAPP_NUMBER = "96877804803";
export const WHATSAPP_DISPLAY = "+968 7780 4803";

export function whatsappUrl(prefill?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return prefill ? `${base}?text=${encodeURIComponent(prefill)}` : base;
}
