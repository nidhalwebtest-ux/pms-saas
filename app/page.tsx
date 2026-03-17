"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  BuildingOfficeIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  CheckIcon,
  Bars3Icon,
  XMarkIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  BoltIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon, StarIcon } from "@heroicons/react/24/solid";

// ─── Types ────────────────────────────────────────────────────────────────────

type Lang = "en" | "ar";

// ─── Animation ────────────────────────────────────────────────────────────────

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function AnimateIn({
  children,
  delay = 0,
  className = "",
  from = "bottom",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  from?: "bottom" | "left" | "right";
}) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView
          ? "none"
          : from === "left"
            ? "translateX(-30px)"
            : from === "right"
              ? "translateX(30px)"
              : "translateY(30px)",
        transition: `opacity 0.65s cubic-bezier(.4,0,.2,1) ${delay}ms, transform 0.65s cubic-bezier(.4,0,.2,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Feature icons (order matches both EN & AR items arrays) ──────────────────

const featureIcons = [
  BuildingOfficeIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
];

const colorMap: Record<string, string> = {
  blue: "bg-blue-100 text-blue-600",
  purple: "bg-purple-100 text-purple-600",
  indigo: "bg-indigo-100 text-indigo-600",
  green: "bg-green-100 text-green-600",
  orange: "bg-orange-100 text-orange-600",
  teal: "bg-teal-100 text-teal-600",
};

// ─── Translations ─────────────────────────────────────────────────────────────

const T = {
  en: {
    nav: {
      features: "Features",
      howItWorks: "How it works",
      pricing: "Pricing",
      contact: "Contact",
      login: "Log in",
      getStarted: "Get started free",
      switchLang: "عربي",
    },
    hero: {
      badge: "Built for Oman. Ready for the world.",
      h1a: "Property Management",
      h1b: "Made Simple",
      desc: "OmRent gives your team a single, powerful workspace to manage properties, handle bookings, track payments, and monitor performance — from any device.",
      startFree: "Start for free",
      exploreFeatures: "Explore features",
      noCreditCard: "No credit card required",
      liveIn: "Live in under 3 minutes",
    },
    stats: [
      { value: "500+", label: "Properties Managed" },
      { value: "12,000+", label: "Reservations Processed" },
      { value: "99.9%", label: "Uptime Guaranteed" },
      { value: "3 min", label: "Average Setup Time" },
    ],
    features: {
      label: "Everything you need",
      h2: "One platform, full control",
      desc: "From the first booking to the final payment — OmRent handles every step of your property operations.",
      items: [
        {
          title: "Property & Unit Management",
          desc: "Organise residential buildings, hotels, and commercial spaces. Track every unit with pricing, floor, and availability in one place.",
          color: "blue",
        },
        {
          title: "Tenant Management",
          desc: "Maintain complete tenant profiles with contact info, national ID, and full lease history. Instant search across all tenants.",
          color: "purple",
        },
        {
          title: "Smart Booking Engine",
          desc: "Real-time availability calendar with collision detection. Daily, monthly, and yearly lease frequencies with auto cost calculation.",
          color: "indigo",
        },
        {
          title: "Payments & Invoices",
          desc: "Record payments via cash, card, bank transfer, or cheque. Support partial payments, auto invoice allocation, and outstanding balances.",
          color: "green",
        },
        {
          title: "Expense Tracking",
          desc: "Log all property costs by category — maintenance, utilities, salaries, marketing. Know your net income per property at a glance.",
          color: "orange",
        },
        {
          title: "Live Dashboard",
          desc: "Receptionist-ready dashboard with today's arrivals, departures, overdue invoices, occupancy rate, and monthly revenue.",
          color: "teal",
        },
      ],
    },
    howItWorks: {
      label: "Get up and running",
      h2: "Live in 3 simple steps",
      desc: "No lengthy onboarding. No IT team required. Start managing your portfolio today.",
      steps: [
        {
          number: "01",
          title: "Create your workspace",
          desc: "Sign up and set up your organisation in under 2 minutes. No credit card required to get started.",
        },
        {
          number: "02",
          title: "Add properties & units",
          desc: "Add your buildings and individual units with pricing. Our guided setup walks you through every field.",
        },
        {
          number: "03",
          title: "Start managing",
          desc: "Record tenants, create reservations, track payments, and monitor your portfolio from one beautiful dashboard.",
        },
      ],
      cta: "Get started — it's free",
    },
    pricing: {
      label: "Simple pricing",
      h2: "Plans that grow with you",
      desc: "Start free, upgrade when you need. No hidden fees, no contracts. Cancel anytime.",
      currency: "OMR / month",
      mostPopular: "Most Popular",
      bottomNote: "All plans include SSL encryption, data backups, and free updates.",
      customPlan: "Need a custom plan?",
      plans: [
        {
          name: "Free",
          price: "0",
          desc: "For individuals just getting started.",
          highlight: false,
          features: [
            "1 property",
            "Up to 10 units",
            "Tenant management",
            "Reservations & check-ins",
            "Basic payment tracking",
            "Dashboard overview",
          ],
          cta: "Get started free",
          href: "/login",
        },
        {
          name: "Starter",
          price: "15",
          desc: "For growing property portfolios.",
          highlight: true,
          features: [
            "Up to 5 properties",
            "Unlimited units",
            "Everything in Free",
            "Invoice generation",
            "Expense tracking",
            "Team access (3 users)",
          ],
          cta: "Start free trial",
          href: "/login",
        },
        {
          name: "Pro",
          price: "35",
          desc: "For large portfolios & agencies.",
          highlight: false,
          features: [
            "Unlimited properties",
            "Unlimited units",
            "Everything in Starter",
            "Advanced reports",
            "Priority support",
            "Unlimited team members",
          ],
          cta: "Contact sales",
          href: "#contact",
        },
      ],
    },
    testimonials: {
      label: "Trusted by managers",
      h2: "What our customers say",
      items: [
        {
          name: "Ahmed Al-Rashidi",
          role: "Property Manager, Salalah",
          avatar: "A",
          rating: 5,
          text: "OmRent transformed how I manage my 3 residential buildings. The booking engine alone saves me hours every week. Checking in guests is now a matter of seconds.",
        },
        {
          name: "Sara Al-Balushi",
          role: "Hotel Owner, Muscat",
          avatar: "S",
          rating: 5,
          text: "The overdue invoice alerts are a game changer. I used to chase tenants manually — now I can see exactly who owes what and record payments on the spot.",
        },
        {
          name: "Mohammed Al-Hajri",
          role: "Real Estate Agency, Dhofar",
          avatar: "M",
          rating: 5,
          text: "Clean interface, fast performance, and everything my receptionists need on one screen. The occupancy rate dashboard is the first thing we check every morning.",
        },
      ],
    },
    contact: {
      label: "Get in touch",
      h2a: "Let's talk about your",
      h2b: "portfolio",
      desc: "Whether you have a single apartment or 50 buildings, we'd love to show you how OmRent can simplify your operations.",
      emailLabel: "Email",
      phoneLabel: "Phone",
      locationLabel: "Location",
      emailValue: "hello@omrent.com",
      phoneValue: "+968 9000 0000",
      locationValue: "Salalah, Dhofar, Oman",
      chips: [
        "Free setup assistance",
        "Arabic & English support",
        "Data migration help",
        "Custom onboarding",
      ],
      formTitle: "Send us a message",
      formDesc: "We typically respond within a few hours.",
      nameLabel: "Full name",
      namePlaceholder: "Ahmed Al-Rashidi",
      emailFieldLabel: "Email",
      emailPlaceholder: "ahmed@example.com",
      companyLabel: "Company / Property name",
      companyPlaceholder: "Salalah Real Estate Co.",
      messageLabel: "Message",
      messagePlaceholder: "Tell us about your properties and what you're looking for...",
      submit: "Send message",
      successTitle: "Message sent!",
      successDesc: "We'll get back to you within 24 hours.",
      sendAnother: "Send another message",
    },
    cta: {
      h2: "Ready to take control of your portfolio?",
      desc: "Join property managers across Oman who use OmRent to save time, reduce errors, and grow their business.",
      startFree: "Start for free — no card needed",
      talkToTeam: "Talk to our team",
    },
    footer: {
      tagline: "Modern property management for Oman and beyond.",
      product: "Product",
      company: "Company",
      account: "Account",
      productLinks: [
        ["Features", "#features"],
        ["Pricing", "#pricing"],
        ["How it works", "#how-it-works"],
      ] as [string, string][],
      companyLinks: [
        ["About", "#"],
        ["Contact", "#contact"],
        ["Privacy Policy", "#"],
      ] as [string, string][],
      accountLinks: [
        ["Log in", "/login"],
        ["Sign up free", "/login"],
        ["Dashboard", "/dashboard"],
      ] as [string, string][],
      security: "SSL secured · Data hosted in EU · GDPR compliant",
      allRights: "All rights reserved.",
    },
  },
  ar: {
    nav: {
      features: "المميزات",
      howItWorks: "كيف يعمل",
      pricing: "الأسعار",
      contact: "تواصل معنا",
      login: "تسجيل الدخول",
      getStarted: "ابدأ مجاناً",
      switchLang: "English",
    },
    hero: {
      badge: "صُنع لعُمان. جاهز للعالم.",
      h1a: "إدارة العقارات",
      h1b: "بكل سهولة",
      desc: "تمنح OmRent فريقك مساحة عمل قوية وموحدة لإدارة العقارات ومعالجة الحجوزات وتتبع المدفوعات ومراقبة الأداء — من أي جهاز.",
      startFree: "ابدأ مجاناً",
      exploreFeatures: "استكشف المميزات",
      noCreditCard: "لا حاجة لبطاقة ائتمان",
      liveIn: "جاهز في أقل من 3 دقائق",
    },
    stats: [
      { value: "500+", label: "عقار مُدار" },
      { value: "12,000+", label: "حجز معالج" },
      { value: "99.9%", label: "ضمان وقت التشغيل" },
      { value: "3 دقائق", label: "متوسط وقت الإعداد" },
    ],
    features: {
      label: "كل ما تحتاجه",
      h2: "منصة واحدة، تحكم كامل",
      desc: "من أول حجز حتى آخر دفعة — OmRent يتولى كل خطوة في عملياتك العقارية.",
      items: [
        {
          title: "إدارة العقارات والوحدات",
          desc: "نظّم المباني السكنية والفنادق والمساحات التجارية. تتبع كل وحدة بالتسعير والطابق والإتاحة في مكان واحد.",
          color: "blue",
        },
        {
          title: "إدارة المستأجرين",
          desc: "احتفظ بملفات كاملة للمستأجرين مع معلومات الاتصال والهوية الوطنية وتاريخ الإيجار الكامل. بحث فوري عبر جميع المستأجرين.",
          color: "purple",
        },
        {
          title: "محرك الحجز الذكي",
          desc: "تقويم إتاحة فوري مع كشف التعارضات. ترددات إيجار يومية وشهرية وسنوية مع حساب تلقائي للتكلفة.",
          color: "indigo",
        },
        {
          title: "المدفوعات والفواتير",
          desc: "سجّل المدفوعات نقداً أو بطاقة أو تحويل بنكي أو شيك. دعم المدفوعات الجزئية والتخصيص التلقائي للفواتير والأرصدة المستحقة.",
          color: "green",
        },
        {
          title: "تتبع المصروفات",
          desc: "سجّل جميع تكاليف العقارات حسب الفئة — صيانة، مرافق، رواتب، تسويق. اعرف صافي دخلك لكل عقار بلمحة.",
          color: "orange",
        },
        {
          title: "لوحة البيانات المباشرة",
          desc: "لوحة تحكم مناسبة للموظفين مع قادمين اليوم، المغادرين، الفواتير المتأخرة، معدل الإشغال، والإيرادات الشهرية.",
          color: "teal",
        },
      ],
    },
    howItWorks: {
      label: "ابدأ الآن",
      h2: "جاهز في 3 خطوات بسيطة",
      desc: "لا تهيئة مطوّلة. لا حاجة لفريق تقني. ابدأ إدارة محفظتك اليوم.",
      steps: [
        {
          number: "01",
          title: "أنشئ مساحة عملك",
          desc: "سجّل وأعدّ مؤسستك في أقل من دقيقتين. لا حاجة لبطاقة ائتمان للبدء.",
        },
        {
          number: "02",
          title: "أضف العقارات والوحدات",
          desc: "أضف مبانيك والوحدات الفردية بالتسعير. يرشدك الإعداد خلال كل حقل.",
        },
        {
          number: "03",
          title: "ابدأ الإدارة",
          desc: "سجّل المستأجرين وأنشئ الحجوزات وتابع المدفوعات وراقب محفظتك من لوحة تحكم رائعة.",
        },
      ],
      cta: "ابدأ — إنه مجاني",
    },
    pricing: {
      label: "أسعار بسيطة",
      h2: "خطط تنمو معك",
      desc: "ابدأ مجاناً، ارقِّ عند الحاجة. لا رسوم خفية، لا عقود. إلغاء في أي وقت.",
      currency: "ر.ع. / شهرياً",
      mostPopular: "الأكثر شعبية",
      bottomNote: "جميع الخطط تشمل تشفير SSL، نسخ احتياطي للبيانات، وتحديثات مجانية.",
      customPlan: "تحتاج خطة مخصصة؟",
      plans: [
        {
          name: "مجاني",
          price: "0",
          desc: "للأفراد المبتدئين.",
          highlight: false,
          features: [
            "عقار واحد",
            "حتى 10 وحدات",
            "إدارة المستأجرين",
            "الحجوزات وتسجيل الوصول",
            "تتبع المدفوعات الأساسي",
            "نظرة عامة على اللوحة",
          ],
          cta: "ابدأ مجاناً",
          href: "/login",
        },
        {
          name: "المبتدئ",
          price: "15",
          desc: "لمحافظ العقارات النامية.",
          highlight: true,
          features: [
            "حتى 5 عقارات",
            "وحدات غير محدودة",
            "كل شيء في المجاني",
            "إنشاء الفواتير",
            "تتبع المصروفات",
            "وصول الفريق (3 مستخدمين)",
          ],
          cta: "ابدأ التجربة المجانية",
          href: "/login",
        },
        {
          name: "الاحترافي",
          price: "35",
          desc: "للمحافظ الكبيرة والوكالات.",
          highlight: false,
          features: [
            "عقارات غير محدودة",
            "وحدات غير محدودة",
            "كل شيء في المبتدئ",
            "تقارير متقدمة",
            "دعم أولوي",
            "أعضاء فريق غير محدودين",
          ],
          cta: "تواصل مع المبيعات",
          href: "#contact",
        },
      ],
    },
    testimonials: {
      label: "موثوق من قبل المديرين",
      h2: "ما يقوله عملاؤنا",
      items: [
        {
          name: "أحمد الرشيدي",
          role: "مدير عقارات، صلالة",
          avatar: "أ",
          rating: 5,
          text: "OmRent غيّر طريقة إدارتي لمبانيي السكنية الثلاثة. محرك الحجز وحده يوفر علي ساعات كل أسبوع. تسجيل الضيوف أصبح في ثوانٍ.",
        },
        {
          name: "سارة البلوشي",
          role: "صاحبة فندق، مسقط",
          avatar: "س",
          rating: 5,
          text: "تنبيهات الفواتير المتأخرة رائعة جداً. كنت أطارد المستأجرين يدوياً — الآن أرى بالضبط من يدين بماذا وأسجّل المدفوعات على الفور.",
        },
        {
          name: "محمد الحجري",
          role: "وكالة عقارية، ظفار",
          avatar: "م",
          rating: 5,
          text: "واجهة نظيفة وأداء سريع وكل ما يحتاجه موظفو الاستقبال في شاشة واحدة. نسبة الإشغال في اللوحة هي أول ما نتحقق منه كل صباح.",
        },
      ],
    },
    contact: {
      label: "تواصل معنا",
      h2a: "لنتحدث عن",
      h2b: "محفظتك",
      desc: "سواء كان لديك شقة واحدة أو 50 مبنى، يسعدنا إظهار كيف يمكن لـ OmRent تبسيط عملياتك.",
      emailLabel: "البريد الإلكتروني",
      phoneLabel: "الهاتف",
      locationLabel: "الموقع",
      emailValue: "hello@omrent.com",
      phoneValue: "+968 9000 0000",
      locationValue: "صلالة، ظفار، عُمان",
      chips: [
        "مساعدة إعداد مجانية",
        "دعم عربي وإنجليزي",
        "مساعدة ترحيل البيانات",
        "تهيئة مخصصة",
      ],
      formTitle: "أرسل لنا رسالة",
      formDesc: "نرد عادةً خلال بضع ساعات.",
      nameLabel: "الاسم الكامل",
      namePlaceholder: "أحمد الرشيدي",
      emailFieldLabel: "البريد الإلكتروني",
      emailPlaceholder: "ahmed@example.com",
      companyLabel: "اسم الشركة / العقار",
      companyPlaceholder: "شركة صلالة العقارية",
      messageLabel: "الرسالة",
      messagePlaceholder: "أخبرنا عن عقاراتك وما الذي تبحث عنه...",
      submit: "إرسال الرسالة",
      successTitle: "تم إرسال الرسالة!",
      successDesc: "سنتواصل معك خلال 24 ساعة.",
      sendAnother: "أرسل رسالة أخرى",
    },
    cta: {
      h2: "هل أنت مستعد للسيطرة على محفظتك؟",
      desc: "انضم لمديري العقارات في عُمان الذين يستخدمون OmRent لتوفير الوقت وتقليل الأخطاء وتنمية أعمالهم.",
      startFree: "ابدأ مجاناً — لا بطاقة مطلوبة",
      talkToTeam: "تحدث مع فريقنا",
    },
    footer: {
      tagline: "إدارة عقارات حديثة لعُمان وما وراءها.",
      product: "المنتج",
      company: "الشركة",
      account: "الحساب",
      productLinks: [
        ["المميزات", "#features"],
        ["الأسعار", "#pricing"],
        ["كيف يعمل", "#how-it-works"],
      ] as [string, string][],
      companyLinks: [
        ["من نحن", "#"],
        ["تواصل معنا", "#contact"],
        ["سياسة الخصوصية", "#"],
      ] as [string, string][],
      accountLinks: [
        ["تسجيل الدخول", "/login"],
        ["تسجيل مجاني", "/login"],
        ["لوحة التحكم", "/dashboard"],
      ] as [string, string][],
      security: "مؤمّن بـ SSL · البيانات في الاتحاد الأوروبي · متوافق مع GDPR",
      allRights: "جميع الحقوق محفوظة.",
    },
  },
};

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar({
  lang,
  setLang,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = T[lang].nav;

  const navLinks: [string, string][] = [
    [t.features, "#features"],
    [t.howItWorks, "#how-it-works"],
    [t.pricing, "#pricing"],
    [t.contact, "#contact"],
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-base">O</span>
          </div>
          <span className="text-xl font-bold text-gray-900 tracking-tight">OmRent</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              {label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {t.switchLang}
          </button>
          <Link
            href="/login"
            className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            {t.login}
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            {t.getStarted}
          </Link>
        </div>

        <button
          className="md:hidden p-2 text-gray-600"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-6 pb-6 pt-4 space-y-4">
          {navLinks.map(([label, href]) => (
            <a
              key={label}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="block text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              {label}
            </a>
          ))}
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => { setLang(lang === "en" ? "ar" : "en"); setMobileOpen(false); }}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              {t.switchLang}
            </button>
            <Link
              href="/login"
              className="text-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              {t.login}
            </Link>
            <Link
              href="/login"
              className="text-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {t.getStarted}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ lang }: { lang: Lang }) {
  const t = T[lang].hero;
  return (
    <section className="relative min-h-screen bg-slate-950 overflow-hidden flex items-center pt-16">
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-indigo-600/15 blur-3xl" />
      <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-2xl" />

      <div className="relative mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5">
              <BoltIcon className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-300">{t.badge}</span>
            </div>

            <h1 className="text-5xl font-bold leading-tight tracking-tight text-white lg:text-6xl">
              {t.h1a}{" "}
              <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                {t.h1b}
              </span>
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-slate-400 max-w-lg">{t.desc}</p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-500 transition-all hover:shadow-blue-500/40 hover:-translate-y-0.5"
              >
                {t.startFree}
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/10 transition-all"
              >
                {t.exploreFeatures}
              </a>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-6">
              {[
                { icon: ShieldCheckIcon, text: t.noCreditCard },
                { icon: BoltIcon, text: t.liveIn },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-500">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Dashboard mockup */}
          <div className="relative hidden lg:block">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
              <div className="bg-slate-800 px-4 py-3 flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/70" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
                  <div className="h-3 w-3 rounded-full bg-green-500/70" />
                </div>
                <div className="flex-1">
                  <div className="mx-auto h-6 w-56 rounded-md bg-slate-700 flex items-center justify-center">
                    <span className="text-xs text-slate-400">app.omrent.com/dashboard</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Good morning, Ahmed!</p>
                    <p className="text-xs text-slate-500">Monday, March 16, 2026</p>
                  </div>
                  <div className="h-7 w-28 rounded-lg bg-blue-600 flex items-center justify-center">
                    <span className="text-xs font-medium text-white">+ New Reservation</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Revenue", value: "12,450 OMR", color: "green" },
                    { label: "Occupancy", value: "87%", color: "blue" },
                    { label: "Arrivals", value: "3 today", color: "purple" },
                    { label: "Overdue", value: "2 inv.", color: "red" },
                  ].map((c) => (
                    <div key={c.label} className="bg-slate-800 rounded-lg p-2.5">
                      <p className="text-xs text-slate-500 mb-1">{c.label}</p>
                      <p
                        className={`text-sm font-bold ${
                          c.color === "green"
                            ? "text-green-400"
                            : c.color === "blue"
                              ? "text-blue-400"
                              : c.color === "purple"
                                ? "text-purple-400"
                                : "text-red-400"
                        }`}
                      >
                        {c.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-800 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <p className="text-xs font-semibold text-white">Arrivals Today</p>
                    <span className="rounded-full bg-green-500/20 px-1.5 py-0.5 text-xs text-green-400">3</span>
                  </div>
                  {[
                    { name: "Ahmed Al-Rashidi", unit: "Room 101", status: "Confirmed", color: "blue" },
                    { name: "Sara Al-Balushi", unit: "Suite 203", status: "Pending", color: "yellow" },
                    { name: "M. Al-Hajri", unit: "Room 305", status: "Confirmed", color: "blue" },
                  ].map((row) => (
                    <div key={row.name} className="flex items-center justify-between py-2 border-t border-slate-700/50">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <span className="text-xs font-medium text-blue-400">{row.name[0]}</span>
                        </div>
                        <span className="text-xs text-slate-300">{row.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">{row.unit}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            row.color === "blue" ? "bg-blue-500/20 text-blue-400" : "bg-yellow-500/20 text-yellow-400"
                          }`}
                        >
                          {row.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400">⚠</div>
                    <p className="text-xs text-red-300">
                      <span className="font-semibold">2 overdue invoices</span> need attention — collect payment today.
                    </p>
                    <span className="ml-auto text-xs font-medium text-red-400 whitespace-nowrap cursor-pointer hover:underline">
                      Pay →
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -left-8 top-1/3 rounded-xl bg-white px-3 py-2 shadow-xl">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                  <BanknotesIcon className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900">Payment received</p>
                  <p className="text-xs text-gray-500">250.000 OMR · Cash</p>
                </div>
              </div>
            </div>

            <div className="absolute -right-6 bottom-1/3 rounded-xl bg-white px-3 py-2 shadow-xl">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <KeyIcon className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900">New check-in</p>
                  <p className="text-xs text-gray-500">Room 205 · Suite</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function Stats({ lang }: { lang: Lang }) {
  const stats = T[lang].stats;
  return (
    <section className="bg-blue-600 py-14">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <dl className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {stats.map((s, i) => (
            <AnimateIn key={s.label} delay={i * 80} className="text-center">
              <dt className="text-4xl font-bold text-white">{s.value}</dt>
              <dd className="mt-1 text-sm font-medium text-blue-200">{s.label}</dd>
            </AnimateIn>
          ))}
        </dl>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

function Features({ lang }: { lang: Lang }) {
  const t = T[lang].features;
  return (
    <section id="features" className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <AnimateIn className="mx-auto max-w-2xl text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 mb-3">{t.label}</p>
          <h2 className="text-4xl font-bold tracking-tight text-gray-900">{t.h2}</h2>
          <p className="mt-4 text-lg text-gray-500">{t.desc}</p>
        </AnimateIn>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {t.items.map((f, i) => {
            const Icon = featureIcons[i];
            return (
              <AnimateIn key={f.title} delay={i * 80}>
                <div className="group relative rounded-2xl border border-gray-100 bg-white p-7 shadow-sm hover:shadow-md hover:border-blue-100 transition-all duration-200 h-full">
                  <div className={`mb-4 inline-flex rounded-xl p-3 ${colorMap[f.color]}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-500">{f.desc}</p>
                </div>
              </AnimateIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── How it Works ─────────────────────────────────────────────────────────────

function HowItWorks({ lang }: { lang: Lang }) {
  const t = T[lang].howItWorks;
  return (
    <section id="how-it-works" className="bg-gray-50 py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <AnimateIn className="mx-auto max-w-2xl text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 mb-3">{t.label}</p>
          <h2 className="text-4xl font-bold tracking-tight text-gray-900">{t.h2}</h2>
          <p className="mt-4 text-lg text-gray-500">{t.desc}</p>
        </AnimateIn>

        <div className="relative grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="absolute top-12 left-1/4 right-1/4 hidden h-px bg-gradient-to-r from-blue-200 via-blue-300 to-blue-200 md:block" />

          {t.steps.map((step, i) => (
            <AnimateIn key={step.number} delay={i * 120} className="relative text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-blue-100 bg-white shadow-md">
                <span className="text-2xl font-bold text-blue-600">{step.number}</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-sm leading-relaxed text-gray-500 max-w-xs mx-auto">{step.desc}</p>
            </AnimateIn>
          ))}
        </div>

        <AnimateIn className="mt-14 text-center" delay={400}>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-all hover:-translate-y-0.5"
          >
            {t.cta}
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </AnimateIn>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function Pricing({ lang }: { lang: Lang }) {
  const t = T[lang].pricing;
  return (
    <section id="pricing" className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <AnimateIn className="mx-auto max-w-2xl text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 mb-3">{t.label}</p>
          <h2 className="text-4xl font-bold tracking-tight text-gray-900">{t.h2}</h2>
          <p className="mt-4 text-lg text-gray-500">{t.desc}</p>
        </AnimateIn>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-stretch">
          {t.plans.map((plan, i) => (
            <AnimateIn key={plan.name} delay={i * 100} className="flex flex-col">
              <div
                className={`relative flex flex-col flex-1 rounded-2xl p-8 ${
                  plan.highlight
                    ? "bg-blue-600 shadow-2xl shadow-blue-500/30 ring-2 ring-blue-600 scale-105"
                    : "bg-white shadow-sm ring-1 ring-gray-200"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-gradient-to-r from-blue-400 to-indigo-400 px-4 py-1 text-xs font-semibold text-white shadow-md">
                      {t.mostPopular}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className={`text-lg font-semibold ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                    {plan.name}
                  </h3>
                  <p className={`mt-1 text-sm ${plan.highlight ? "text-blue-200" : "text-gray-500"}`}>{plan.desc}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className={`text-5xl font-bold ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                      {plan.price}
                    </span>
                    <span className={`text-sm font-medium ${plan.highlight ? "text-blue-200" : "text-gray-500"}`}>
                      {t.currency}
                    </span>
                  </div>
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-3">
                      <CheckCircleIcon
                        className={`mt-0.5 h-5 w-5 flex-shrink-0 ${plan.highlight ? "text-blue-200" : "text-blue-500"}`}
                      />
                      <span className={`text-sm ${plan.highlight ? "text-blue-100" : "text-gray-600"}`}>{feat}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={plan.href}
                  className={`block rounded-xl px-6 py-3 text-center text-sm font-semibold transition-all hover:-translate-y-0.5 ${
                    plan.highlight
                      ? "bg-white text-blue-600 hover:bg-blue-50 shadow-md"
                      : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            </AnimateIn>
          ))}
        </div>

        <AnimateIn className="mt-10 text-center" delay={350}>
          <p className="text-sm text-gray-400">
            {t.bottomNote}{" "}
            <a href="#contact" className="text-blue-600 hover:underline">
              {t.customPlan}
            </a>
          </p>
        </AnimateIn>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

function Testimonials({ lang }: { lang: Lang }) {
  const t = T[lang].testimonials;
  return (
    <section className="bg-gray-50 py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <AnimateIn className="mx-auto max-w-2xl text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 mb-3">{t.label}</p>
          <h2 className="text-4xl font-bold tracking-tight text-gray-900">{t.h2}</h2>
        </AnimateIn>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {t.items.map((item, i) => (
            <AnimateIn key={item.name} delay={i * 100}>
              <div className="flex flex-col rounded-2xl bg-white p-7 shadow-sm ring-1 ring-gray-100 h-full">
                <div className="mb-4 flex gap-1">
                  {Array.from({ length: item.rating }).map((_, j) => (
                    <StarIcon key={j} className="h-4 w-4 text-yellow-400" />
                  ))}
                </div>
                <p className="flex-1 text-sm leading-relaxed text-gray-600 italic">&ldquo;{item.text}&rdquo;</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
                    <span className="text-sm font-bold text-white">{item.avatar}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.role}</p>
                  </div>
                </div>
              </div>
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Contact ──────────────────────────────────────────────────────────────────

function Contact({ lang }: { lang: Lang }) {
  const t = T[lang].contact;
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  const contactInfo = [
    { icon: EnvelopeIcon, label: t.emailLabel, value: t.emailValue },
    { icon: PhoneIcon, label: t.phoneLabel, value: t.phoneValue },
    { icon: MapPinIcon, label: t.locationLabel, value: t.locationValue },
  ];

  return (
    <section id="contact" className="bg-slate-950 py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:items-start">
          <AnimateIn from="left">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-400 mb-3">{t.label}</p>
            <h2 className="text-4xl font-bold tracking-tight text-white">
              {t.h2a}{" "}
              <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                {t.h2b}
              </span>
            </h2>
            <p className="mt-4 text-lg text-slate-400">{t.desc}</p>

            <dl className="mt-10 space-y-6">
              {contactInfo.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
                    <Icon className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
                    <p className="text-sm font-medium text-slate-300">{value}</p>
                  </div>
                </div>
              ))}
            </dl>

            <div className="mt-10 flex flex-wrap gap-2">
              {t.chips.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1 text-xs font-medium text-slate-400"
                >
                  <CheckIcon className="h-3 w-3 text-blue-400" />
                  {tag}
                </span>
              ))}
            </div>
          </AnimateIn>

          <AnimateIn from="right">
            <div className="rounded-2xl bg-white p-8 shadow-2xl">
              {sent ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <CheckCircleIcon className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">{t.successTitle}</h3>
                  <p className="mt-2 text-sm text-gray-500">{t.successDesc}</p>
                  <button
                    onClick={() => { setSent(false); setForm({ name: "", email: "", company: "", message: "" }); }}
                    className="mt-6 text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    {t.sendAnother}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{t.formTitle}</h3>
                    <p className="mt-1 text-sm text-gray-500">{t.formDesc}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-700">
                        {t.nameLabel} <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder={t.namePlaceholder}
                        className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-700">
                        {t.emailFieldLabel} <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                        placeholder={t.emailPlaceholder}
                        className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-700">{t.companyLabel}</label>
                    <input
                      type="text"
                      value={form.company}
                      onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
                      placeholder={t.companyPlaceholder}
                      className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-700">
                      {t.messageLabel} <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={form.message}
                      onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                      placeholder={t.messagePlaceholder}
                      className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-all hover:-translate-y-0.5 active:translate-y-0"
                  >
                    {t.submit}
                  </button>
                </form>
              )}
            </div>
          </AnimateIn>
        </div>
      </div>
    </section>
  );
}

// ─── CTA Banner ───────────────────────────────────────────────────────────────

function CtaBanner({ lang }: { lang: Lang }) {
  const t = T[lang].cta;
  return (
    <section className="bg-blue-600 py-20">
      <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
        <AnimateIn>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{t.h2}</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-blue-100">{t.desc}</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-blue-600 shadow-lg hover:bg-blue-50 transition-all hover:-translate-y-0.5"
            >
              {t.startFree}
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <a
              href="#contact"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white hover:bg-white/20 transition-all"
            >
              {t.talkToTeam}
            </a>
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer({ lang }: { lang: Lang }) {
  const t = T[lang].footer;
  return (
    <footer className="bg-slate-950 border-t border-slate-800 py-12">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-base">O</span>
              </div>
              <span className="text-lg font-bold text-white">OmRent</span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed max-w-xs">{t.tagline}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">{t.product}</p>
            <ul className="space-y-2.5">
              {t.productLinks.map(([label, href]) => (
                <li key={label}>
                  <a href={href} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">{label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">{t.company}</p>
            <ul className="space-y-2.5">
              {t.companyLinks.map(([label, href]) => (
                <li key={label}>
                  <a href={href} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">{label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">{t.account}</p>
            <ul className="space-y-2.5">
              {t.accountLinks.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} OmRent. {t.allRights}
          </p>
          <div className="flex items-center gap-1 text-xs text-slate-600">
            <ShieldCheckIcon className="h-3.5 w-3.5" />
            <span>{t.security}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>("en");
  return (
    <div className="scroll-smooth bg-white" dir={lang === "ar" ? "rtl" : "ltr"}>
      <Navbar lang={lang} setLang={setLang} />
      <Hero lang={lang} />
      <Stats lang={lang} />
      <Features lang={lang} />
      <HowItWorks lang={lang} />
      <Pricing lang={lang} />
      <Testimonials lang={lang} />
      <CtaBanner lang={lang} />
      <Contact lang={lang} />
      <Footer lang={lang} />
    </div>
  );
}
