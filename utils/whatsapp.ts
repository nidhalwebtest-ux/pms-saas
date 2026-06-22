/**
 * WhatsApp helpers. Prospect phones are stored loosely (the founder types what
 * they see); we normalize to digits for wa.me links. Oman country code is 968.
 */

const OMAN_CC = "968";

/**
 * Best-effort normalize a phone string to bare international digits for wa.me.
 * - strips spaces, dashes, parens, leading "+"/"00"
 * - if it looks like a bare 8-digit Omani number, prepends 968
 * Returns "" when there are no usable digits.
 */
export function waNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  let digits = phone.replace(/[^\d]/g, "");
  if (!digits) return "";
  // 00<cc> international prefix → drop the 00
  if (digits.startsWith("00")) digits = digits.slice(2);
  // bare local Omani number (8 digits, typically starting 7 or 9) → add CC
  if (digits.length === 8) digits = OMAN_CC + digits;
  return digits;
}

/** Build a click-to-WhatsApp URL, optionally with a prefilled message. */
export function waLink(phone: string | null | undefined, message?: string): string | null {
  const num = waNumber(phone);
  if (!num) return null;
  const base = `https://wa.me/${num}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
