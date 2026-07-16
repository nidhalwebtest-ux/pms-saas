/**
 * Self-contained i18n for the PUBLIC site — deliberately independent of the
 * app's next-intl/NEXT_LOCALE cookie so a visitor's language is driven by the
 * site (default + their toggle), never by the operator's dashboard locale.
 */

export type SiteLang = "ar" | "en";

const en = {
  nav: { home: "Home", buildings: "Stays", contact: "Contact", book: "Book now" },
  hero: {
    checkIn: "Check-in", checkOut: "Check-out", guests: "Guests",
    guest: "guest", guestsPlural: "guests", search: "Search availability",
  },
  common: {
    from: "from", perNight: "/ night", night: "night", nights: "nights",
    viewDetails: "View details", available: "Available", soldOut: "Not available",
    bedrooms: "Bedrooms", bathrooms: "Bathrooms", sleeps: "Sleeps", amenities: "Amenities",
    allStays: "All stays", units: "units", unit: "unit", backHome: "Back to home",
    total: "Total", loading: "Loading…",
  },
  sections: {
    featured: "Featured stays", about: "About us",
    khareefTitle: "Khareef season is here", khareefSubtitle: "Cool, green and misty — book your Salalah escape.",
    contactTitle: "Get in touch", exploreStays: "Explore stays",
    featuredEyebrow: "Where to stay", aboutEyebrow: "Our story", stayCount: "{count} places to stay",
  },
  highlights: {
    location: { t: "Prime locations", d: "Minutes from the beach & the Khareef greenery" },
    booking: { t: "Effortless booking", d: "Reserve in seconds, confirm on WhatsApp" },
    price: { t: "Honest prices", d: "Transparent seasonal rates, no surprises" },
    care: { t: "Local hospitality", d: "A warm Omani welcome, every stay" },
  },
  search: {
    title: "Available for your dates", resultsFor: "{count} stays available",
    none: "No stays available for these dates.", tryOther: "Try different dates.",
    request: "Request booking", forNights: "for {n} nights", editSearch: "Edit search",
    pickDates: "Pick your dates to see availability and prices.",
  },
  unit: {
    overview: "Overview", pricing: "Pricing", selectDates: "Select dates to see the total for your stay.",
    requestThis: "Request this stay", inBuilding: "In {name}",
  },
  building: { unitsHere: "Stays in this building", noUnits: "No stays published yet." },
  booking: {
    title: "Request your stay", recap: "Your stay", details: "Your details",
    name: "Full name", phone: "Phone / WhatsApp", email: "Email (optional)",
    guestsCount: "Number of guests", notes: "Notes (optional)",
    submit: "Send booking request", submitting: "Sending…",
    successTitle: "Request received", successMsg: "Thank you! The property will review your request and confirm shortly.",
    whatsappCta: "Message us on WhatsApp", required: "This field is required", failed: "Could not send your request. Please try again.",
    backToSite: "Back to the site",
  },
  footer: { poweredBy: "Powered by Binaya", rights: "All rights reserved" },
  lang: { toggle: "العربية" },
};

const ar: typeof en = {
  nav: { home: "الرئيسية", buildings: "الإقامات", contact: "تواصل", book: "احجز الآن" },
  hero: {
    checkIn: "تسجيل الدخول", checkOut: "تسجيل الخروج", guests: "الضيوف",
    guest: "ضيف", guestsPlural: "ضيوف", search: "ابحث عن المتاح",
  },
  common: {
    from: "من", perNight: "/ ليلة", night: "ليلة", nights: "ليالٍ",
    viewDetails: "عرض التفاصيل", available: "متاح", soldOut: "غير متاح",
    bedrooms: "غرف النوم", bathrooms: "الحمامات", sleeps: "يتسع لـ", amenities: "المرافق",
    allStays: "كل الإقامات", units: "وحدة", unit: "وحدة", backHome: "العودة للرئيسية",
    total: "الإجمالي", loading: "جارٍ التحميل…",
  },
  sections: {
    featured: "إقامات مميزة", about: "من نحن",
    khareefTitle: "موسم الخريف هنا", khareefSubtitle: "أجواء باردة وخضرة وضباب — احجز إقامتك في صلالة.",
    contactTitle: "تواصل معنا", exploreStays: "استكشف الإقامات",
    featuredEyebrow: "أين تقيم", aboutEyebrow: "قصتنا", stayCount: "{count} أماكن للإقامة",
  },
  highlights: {
    location: { t: "مواقع مميزة", d: "دقائق من الشاطئ وخضرة الخريف" },
    booking: { t: "حجز سهل", d: "احجز في ثوانٍ وأكّد عبر واتساب" },
    price: { t: "أسعار واضحة", d: "أسعار موسمية شفافة بلا مفاجآت" },
    care: { t: "ضيافة محلية", d: "ترحيب عُماني دافئ في كل إقامة" },
  },
  search: {
    title: "المتاح لتواريخك", resultsFor: "{count} إقامة متاحة",
    none: "لا توجد إقامات متاحة لهذه التواريخ.", tryOther: "جرّب تواريخ أخرى.",
    request: "طلب الحجز", forNights: "لمدة {n} ليالٍ", editSearch: "تعديل البحث",
    pickDates: "اختر تواريخك لعرض التوفر والأسعار.",
  },
  unit: {
    overview: "نظرة عامة", pricing: "الأسعار", selectDates: "اختر التواريخ لعرض إجمالي إقامتك.",
    requestThis: "اطلب هذه الإقامة", inBuilding: "في {name}",
  },
  building: { unitsHere: "الإقامات في هذا المبنى", noUnits: "لا توجد إقامات منشورة بعد." },
  booking: {
    title: "اطلب إقامتك", recap: "إقامتك", details: "بياناتك",
    name: "الاسم الكامل", phone: "الهاتف / واتساب", email: "البريد الإلكتروني (اختياري)",
    guestsCount: "عدد الضيوف", notes: "ملاحظات (اختياري)",
    submit: "إرسال طلب الحجز", submitting: "جارٍ الإرسال…",
    successTitle: "تم استلام الطلب", successMsg: "شكرًا لك! ستراجع المنشأة طلبك وتؤكده قريبًا.",
    whatsappCta: "راسلنا على واتساب", required: "هذا الحقل مطلوب", failed: "تعذّر إرسال طلبك. يرجى المحاولة مرة أخرى.",
    backToSite: "العودة إلى الموقع",
  },
  footer: { poweredBy: "مدعوم من بناية", rights: "جميع الحقوق محفوظة" },
  lang: { toggle: "English" },
};

export type PublicDict = typeof en;
export const PUBLIC_DICT: Record<SiteLang, PublicDict> = { en, ar };
export const getDict = (lang: SiteLang): PublicDict => PUBLIC_DICT[lang];

/** Tiny interpolation helper: fill("{n} nights", { n: 3 }). */
export function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
