/* ============================================================================
 *  Curated lists for realistic Omani test data — names, surnames, Arabic
 *  variants, nationalities, sources. Hand-picked rather than faker-random so
 *  the seeded data feels authentic, not stochastic noise.
 * ========================================================================= */

export const MALE_FIRST = [
  "Ahmed", "Ali", "Mohammed", "Salim", "Khalid", "Mansour", "Hamad", "Saif",
  "Sultan", "Yousef", "Tariq", "Hassan", "Hussein", "Faisal", "Omar", "Abdullah",
  "Nasser", "Rashid", "Issa", "Said", "Talal", "Walid", "Marwan", "Adnan",
  "Fahad", "Bader", "Ibrahim", "Jamil", "Karim", "Majid", "Saud", "Suhail",
  "Tamim", "Waleed", "Yahya", "Zaid", "Nabil", "Mazen", "Khaled", "Ammar",
];

export const FEMALE_FIRST = [
  "Reem", "Fatima", "Aisha", "Mariam", "Sara", "Layla", "Noor", "Huda",
  "Halima", "Khadija", "Salma", "Amal", "Asma", "Buthaina", "Hanan", "Rania",
  "Maha", "Najwa", "Samira", "Wafa", "Zahra", "Zainab", "Hessa", "Lubna",
  "Munira", "Nadia", "Rim", "Salwa", "Shaikha", "Yasmin", "Asilah", "Dalal",
];

export const SURNAMES = [
  "Al Balushi", "Al Hinai", "Al Khalili", "Al Saadi", "Al Riyami", "Al Maamari",
  "Al Hashmi", "Al Lawati", "Al Battashi", "Al Habsi", "Al Shukaili", "Al Wahaibi",
  "Al Zadjali", "Al Kindi", "Al Farsi", "Al Busaidi", "Al Mahrouqi", "Al Rawahi",
  "Al Bahri", "Al Rashdi", "Al Jabri", "Al Harthi", "Al Maskari", "Al Toobi",
  "Al Mawali", "Al Subhi", "Al Ghassani", "Al Mughairi", "Al Nadabi", "Al Mahri",
];

/* Arabic variants used for the 10 tenants flagged with `fullNameArabic`. */
export const ARABIC_NAMES = [
  { full: "أحمد البلوشي",   en: "Ahmed Al Balushi" },
  { full: "ريم الهنائي",     en: "Reem Al Hinai" },
  { full: "سالم الخليلي",    en: "Salim Al Khalili" },
  { full: "فاطمة السعدي",    en: "Fatima Al Saadi" },
  { full: "محمد الرياميي",  en: "Mohammed Al Riyami" },
  { full: "عائشة المعمري",  en: "Aisha Al Maamari" },
  { full: "خالد الهاشمي",    en: "Khalid Al Hashmi" },
  { full: "مريم اللواتي",    en: "Mariam Al Lawati" },
  { full: "منصور الحبسي",   en: "Mansour Al Habsi" },
  { full: "سارة الفارسي",    en: "Sara Al Farsi" },
];

/* Nationalities by approximate distribution: 60% Omani / 20% GCC neighbours
 * / 10% Yemeni / 10% other. The seeder feeds these into `weighted()`. */
export const NATIONALITY_WEIGHTS: ReadonlyArray<readonly [string, number]> = [
  ["Omani",     60],
  ["Saudi",     10],
  ["Emirati",   10],
  ["Yemeni",    10],
  ["Indian",     3],
  ["Pakistani",  3],
  ["Egyptian",   2],
  ["British",    1],
  ["Filipino",   1],
];

export const RESERVATION_SOURCES: ReadonlyArray<readonly [string, number]> = [
  ["walk_in",  35],
  ["referral", 20],
  ["online",   25],
  ["agent",    10],
  ["returning", 10],
];

/* Common Salalah corporate / government names used for non-individual tenants. */
export const CORPORATE_NAMES = [
  "Dhofar Tourism Co.",
  "Salalah Mills Co.",
  "Khareef Travel Agency",
  "Oman Refreshments Co.",
  "Frankincense Tours",
  "Al Marsah Engineering",
  "Salalah Free Zone",
];

export const GOVERNMENT_NAMES = [
  "Ministry of Tourism — Dhofar",
  "Royal Oman Police — Salalah",
  "Diwan of Royal Court Office",
];

/* Reject reasons used in the expenses scenario. */
export const REJECT_REASONS = [
  "Receipt photo unreadable",
  "Amount exceeds monthly cap",
  "Wrong category selected",
  "Duplicate of EXP earlier this month",
  "Personal expense, not work-related",
  "Missing approval from manager",
  "Vendor not on approved list",
  "Resubmit with VAT breakdown",
];

/* Property address fragments — used to give each test building a plausible
 * street + neighbourhood without hand-rolling fully unique addresses. */
export const NEIGHBOURHOODS = [
  "Al Haffa",
  "Al Dahariz",
  "Salalah City Center",
  "Al Saadah",
  "Al Awqadain",
];
