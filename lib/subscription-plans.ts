/**
 * Default SaaS plan catalogue (Roadmap item 4).
 *
 * These are the SEED values for the SubscriptionPlan table — after setup the
 * database is the source of truth and the super-admin edits plans there. Kept
 * in code so a fresh environment (and scripts/subscriptions-setup.ts) can
 * create the same catalogue.
 *
 * Starter / Pro (Growth) / Ultimate are the flat tiers previously shown on the
 * landing page (LegacyFlatTierPricingSection, removed in 751cf11). Free is the
 * fallback plan an organization drops to when its trial or paid period ends.
 *
 * Money is integer baisa (1 OMR = 1000 baisa). Prices are PER MONTH for each
 * billing cycle: 6-month = 10% off monthly, yearly = the old yearly price.
 */

export type PlanSeed = {
  key: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  priceMonthlyBaisa: number;
  priceSemiannualBaisa: number;
  priceYearlyBaisa: number;
  maxBuildings: number | null;
  maxUnits: number | null;
  maxUsers: number | null;
  featureWebsite: boolean;
  featureWhatsapp: boolean;
  featureOnlinePayments: boolean;
  featureAiAssistant: boolean;
  bulletsEn: string[];
  bulletsAr: string[];
  isPublic: boolean;
  isFeatured: boolean;
  sortOrder: number;
};

const omr = (n: number) => Math.round(n * 1000);
/** 6-month billing = 10% off the monthly price (per month), integer baisa. */
const semiannual = (monthlyOmr: number) => Math.round((omr(monthlyOmr) * 90) / 100);

export const DEFAULT_PLANS: PlanSeed[] = [
  {
    key: "free",
    nameEn: "Free",
    nameAr: "المجانية",
    descriptionEn: "One building and up to 5 units — free forever",
    descriptionAr: "مبنى واحد وحتى 5 وحدات — مجانًا للأبد",
    priceMonthlyBaisa: 0,
    priceSemiannualBaisa: 0,
    priceYearlyBaisa: 0,
    maxBuildings: 1,
    maxUnits: 5,
    maxUsers: 1,
    featureWebsite: false,
    featureWhatsapp: false,
    featureOnlinePayments: false,
    featureAiAssistant: false,
    bulletsEn: ["1 Building", "Up to 5 Units", "1 User", "Unlimited Reservations & Invoices"],
    bulletsAr: ["مبنى واحد", "حتى 5 وحدات", "مستخدم واحد", "حجوزات وفواتير غير محدودة"],
    isPublic: true,
    isFeatured: false,
    sortOrder: 0,
  },
  {
    key: "starter",
    nameEn: "Starter",
    nameAr: "المبتدئ",
    descriptionEn: "Ideal for single hotels and smaller furnished-apartment portfolios",
    descriptionAr: "مثالية للفنادق والشقق المفروشة الفردية والصغيرة",
    priceMonthlyBaisa: omr(15),
    priceSemiannualBaisa: semiannual(15),
    priceYearlyBaisa: omr(10),
    maxBuildings: 1,
    maxUnits: 20,
    maxUsers: 2,
    featureWebsite: false,
    featureWhatsapp: false,
    featureOnlinePayments: false,
    featureAiAssistant: false,
    bulletsEn: ["1 Building", "1 to 20 Units", "2 Users", "Unlimited Tenants", "Unlimited Reservations", "Unlimited Payments & Invoices", "Unlimited Expenses & Reports"],
    bulletsAr: ["مبنى واحد", "من 1 إلى 20 وحدة", "مستخدمان اثنان", "مستأجرون غير محدودين", "حجوزات غير محدودة", "مدفوعات وفواتير غير محدودة", "مصروفات وتقارير غير محدودة"],
    isPublic: true,
    isFeatured: false,
    sortOrder: 10,
  },
  {
    key: "growth",
    nameEn: "Pro / Growth",
    nameAr: "النمو الاحترافي",
    descriptionEn: "Most popular plan for growing hotel and furnished-apartment portfolios",
    descriptionAr: "الخطة الأكثر شعبية للفنادق والشقق المفروشة المتنامية",
    priceMonthlyBaisa: omr(30),
    priceSemiannualBaisa: semiannual(30),
    priceYearlyBaisa: omr(25),
    maxBuildings: 5,
    maxUnits: null,
    maxUsers: 5,
    featureWebsite: true,
    featureWhatsapp: false,
    featureOnlinePayments: false,
    featureAiAssistant: false,
    bulletsEn: ["5 Buildings", "Unlimited Units", "5 Users", "Unlimited Tenants", "Unlimited Reservations & Payments", "Unlimited Expenses & Reports", "Public Booking Website"],
    bulletsAr: ["5 مبانٍ", "وحدات غير محدودة", "5 مستخدمين", "مستأجرون غير محدودين", "حجوزات ومدفوعات غير محدودة", "مصروفات وتقارير غير محدودة", "موقع حجز إلكتروني خاص"],
    isPublic: true,
    isFeatured: true,
    sortOrder: 20,
  },
  {
    key: "ultimate",
    nameEn: "Ultimate",
    nameAr: "الشاملة",
    descriptionEn: "Full solution with AI assistant, WhatsApp, and online payments",
    descriptionAr: "حل متكامل مع الذكاء الاصطناعي وربط الواتساب والدفع الإلكتروني",
    priceMonthlyBaisa: omr(75),
    priceSemiannualBaisa: semiannual(75),
    priceYearlyBaisa: omr(60),
    maxBuildings: null,
    maxUnits: null,
    maxUsers: null,
    featureWebsite: true,
    featureWhatsapp: true,
    featureOnlinePayments: true,
    featureAiAssistant: true,
    bulletsEn: ["Unlimited Buildings", "Unlimited Users", "Unlimited Tenants, Reservations, Payments & Expenses", "Public Booking Website with Online Payments", "AI Assistant", "Direct WhatsApp Integration", "AI Chatbot for Website & WhatsApp"],
    bulletsAr: ["مبانٍ غير محدودة", "مستخدمون غير محدودين", "مستأجرون وحجوزات ومدفوعات ومصروفات غير محدودة", "موقع حجز إلكتروني مع دفع إلكتروني", "مساعد الذكاء الاصطناعي", "ربط الواتساب المباشر", "روبوت محادثة ذكي للموقع والواتساب"],
    isPublic: true,
    isFeatured: false,
    sortOrder: 30,
  },
];
