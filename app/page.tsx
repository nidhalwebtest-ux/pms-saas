"use client";

import { useState } from "react";
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
  CreditCardIcon,
  DocumentChartBarIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon, StarIcon } from "@heroicons/react/24/solid";

// ─── Data ─────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: BuildingOfficeIcon,
    title: "Property & Unit Management",
    desc: "Organise residential buildings, hotels, and commercial spaces. Track every unit with pricing, floor, and availability in one place.",
    color: "blue",
  },
  {
    icon: UserGroupIcon,
    title: "Tenant Management",
    desc: "Maintain complete tenant profiles with contact info, national ID, and full lease history. Instant search across all tenants.",
    color: "purple",
  },
  {
    icon: CalendarDaysIcon,
    title: "Smart Booking Engine",
    desc: "Real-time availability calendar with collision detection. Daily, monthly, and yearly lease frequencies with auto cost calculation.",
    color: "indigo",
  },
  {
    icon: BanknotesIcon,
    title: "Payments & Invoices",
    desc: "Record payments via cash, card, bank transfer, or cheque. Support partial payments, auto invoice allocation, and outstanding balances.",
    color: "green",
  },
  {
    icon: ClipboardDocumentListIcon,
    title: "Expense Tracking",
    desc: "Log all property costs by category — maintenance, utilities, salaries, marketing. Know your net income per property at a glance.",
    color: "orange",
  },
  {
    icon: ChartBarIcon,
    title: "Live Dashboard",
    desc: "Receptionist-ready dashboard with today's arrivals, departures, overdue invoices, occupancy rate, and monthly revenue.",
    color: "teal",
  },
];

const colorMap: Record<string, string> = {
  blue: "bg-blue-100 text-blue-600",
  purple: "bg-purple-100 text-purple-600",
  indigo: "bg-indigo-100 text-indigo-600",
  green: "bg-green-100 text-green-600",
  orange: "bg-orange-100 text-orange-600",
  teal: "bg-teal-100 text-teal-600",
};

const steps = [
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
];

const plans = [
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
];

const testimonials = [
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
];

const stats = [
  { value: "500+", label: "Properties Managed" },
  { value: "12,000+", label: "Reservations Processed" },
  { value: "99.9%", label: "Uptime Guaranteed" },
  { value: "3 min", label: "Average Setup Time" },
];

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-base">O</span>
          </div>
          <span className="text-xl font-bold text-gray-900 tracking-tight">
            OmRent
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {[
            ["Features", "#features"],
            ["How it works", "#how-it-works"],
            ["Pricing", "#pricing"],
            ["Contact", "#contact"],
          ].map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              {label}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            Get started free
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 text-gray-600"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? (
            <XMarkIcon className="h-6 w-6" />
          ) : (
            <Bars3Icon className="h-6 w-6" />
          )}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-6 pb-6 pt-4 space-y-4">
          {[
            ["Features", "#features"],
            ["How it works", "#how-it-works"],
            ["Pricing", "#pricing"],
            ["Contact", "#contact"],
          ].map(([label, href]) => (
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
            <Link
              href="/login"
              className="text-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Log in
            </Link>
            <Link
              href="/login"
              className="text-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Get started free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative min-h-screen bg-slate-950 overflow-hidden flex items-center pt-16">
      {/* Background glow orbs */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-indigo-600/15 blur-3xl" />
      <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-2xl" />

      <div className="relative mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
          {/* Left: copy */}
          <div>
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5">
              <BoltIcon className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-300">
                Built for Oman. Ready for the world.
              </span>
            </div>

            <h1 className="text-5xl font-bold leading-tight tracking-tight text-white lg:text-6xl">
              Property Management{" "}
              <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                Made Simple
              </span>
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-slate-400 max-w-lg">
              OmRent gives your team a single, powerful workspace to manage
              properties, handle bookings, track payments, and monitor
              performance — from any device.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-500 transition-all hover:shadow-blue-500/40 hover:-translate-y-0.5"
              >
                Start for free
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/10 transition-all"
              >
                Explore features
              </a>
            </div>

            {/* Trust signals */}
            <div className="mt-10 flex flex-wrap items-center gap-6">
              {[
                { icon: ShieldCheckIcon, text: "No credit card required" },
                { icon: BoltIcon, text: "Live in under 3 minutes" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-500">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Dashboard mockup */}
          <div className="relative hidden lg:block">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
              {/* Browser chrome */}
              <div className="bg-slate-800 px-4 py-3 flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/70" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
                  <div className="h-3 w-3 rounded-full bg-green-500/70" />
                </div>
                <div className="flex-1">
                  <div className="mx-auto h-6 w-56 rounded-md bg-slate-700 flex items-center justify-center">
                    <span className="text-xs text-slate-400">
                      app.omrent.com/dashboard
                    </span>
                  </div>
                </div>
              </div>

              {/* Dashboard body */}
              <div className="bg-slate-900 p-5 space-y-4">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Good morning, Ahmed!
                    </p>
                    <p className="text-xs text-slate-500">
                      Monday, March 16, 2026
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-7 w-28 rounded-lg bg-blue-600 flex items-center justify-center">
                      <span className="text-xs font-medium text-white">
                        + New Reservation
                      </span>
                    </div>
                  </div>
                </div>

                {/* KPI cards */}
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

                {/* Arrivals panel */}
                <div className="bg-slate-800 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <p className="text-xs font-semibold text-white">
                      Arrivals Today
                    </p>
                    <span className="rounded-full bg-green-500/20 px-1.5 py-0.5 text-xs text-green-400">
                      3
                    </span>
                  </div>
                  {[
                    { name: "Ahmed Al-Rashidi", unit: "Room 101", status: "Confirmed", color: "blue" },
                    { name: "Sara Al-Balushi", unit: "Suite 203", status: "Pending", color: "yellow" },
                    { name: "M. Al-Hajri", unit: "Room 305", status: "Confirmed", color: "blue" },
                  ].map((row) => (
                    <div
                      key={row.name}
                      className="flex items-center justify-between py-2 border-t border-slate-700/50"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <span className="text-xs font-medium text-blue-400">
                            {row.name[0]}
                          </span>
                        </div>
                        <span className="text-xs text-slate-300">
                          {row.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">
                          {row.unit}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            row.color === "blue"
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-yellow-500/20 text-yellow-400"
                          }`}
                        >
                          {row.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Overdue invoices */}
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400">
                      ⚠
                    </div>
                    <p className="text-xs text-red-300">
                      <span className="font-semibold">2 overdue invoices</span>{" "}
                      need attention — collect payment today.
                    </p>
                    <span className="ml-auto text-xs font-medium text-red-400 whitespace-nowrap cursor-pointer hover:underline">
                      Pay →
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -left-8 top-1/3 rounded-xl bg-white px-3 py-2 shadow-xl">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                  <BanknotesIcon className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900">
                    Payment received
                  </p>
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
                  <p className="text-xs font-semibold text-gray-900">
                    New check-in
                  </p>
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

function Stats() {
  return (
    <section className="bg-blue-600 py-14">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <dl className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <dt className="text-4xl font-bold text-white">{s.value}</dt>
              <dd className="mt-1 text-sm font-medium text-blue-200">
                {s.label}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

function Features() {
  return (
    <section id="features" className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 mb-3">
            Everything you need
          </p>
          <h2 className="text-4xl font-bold tracking-tight text-gray-900">
            One platform, full control
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            From the first booking to the final payment — OmRent handles every
            step of your property operations.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group relative rounded-2xl border border-gray-100 bg-white p-7 shadow-sm hover:shadow-md hover:border-blue-100 transition-all duration-200"
            >
              <div
                className={`mb-4 inline-flex rounded-xl p-3 ${colorMap[f.color]}`}
              >
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How it Works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-gray-50 py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 mb-3">
            Get up and running
          </p>
          <h2 className="text-4xl font-bold tracking-tight text-gray-900">
            Live in 3 simple steps
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            No lengthy onboarding. No IT team required. Start managing your
            portfolio today.
          </p>
        </div>

        <div className="relative grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Connector line */}
          <div className="absolute top-12 left-1/4 right-1/4 hidden h-px bg-gradient-to-r from-blue-200 via-blue-300 to-blue-200 md:block" />

          {steps.map((step, i) => (
            <div key={step.number} className="relative text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-blue-100 bg-white shadow-md">
                <span className="text-2xl font-bold text-blue-600">
                  {step.number}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-gray-500 max-w-xs mx-auto">
                {step.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-14 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-all hover:-translate-y-0.5"
          >
            Get started — it&apos;s free
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function Pricing() {
  return (
    <section id="pricing" className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 mb-3">
            Simple pricing
          </p>
          <h2 className="text-4xl font-bold tracking-tight text-gray-900">
            Plans that grow with you
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            Start free, upgrade when you need. No hidden fees, no contracts.
            Cancel anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-stretch">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl p-8 ${
                plan.highlight
                  ? "bg-blue-600 shadow-2xl shadow-blue-500/30 ring-2 ring-blue-600 scale-105"
                  : "bg-white shadow-sm ring-1 ring-gray-200"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-gradient-to-r from-blue-400 to-indigo-400 px-4 py-1 text-xs font-semibold text-white shadow-md">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3
                  className={`text-lg font-semibold ${plan.highlight ? "text-white" : "text-gray-900"}`}
                >
                  {plan.name}
                </h3>
                <p
                  className={`mt-1 text-sm ${plan.highlight ? "text-blue-200" : "text-gray-500"}`}
                >
                  {plan.desc}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span
                    className={`text-5xl font-bold ${plan.highlight ? "text-white" : "text-gray-900"}`}
                  >
                    {plan.price}
                  </span>
                  <span
                    className={`text-sm font-medium ${plan.highlight ? "text-blue-200" : "text-gray-500"}`}
                  >
                    OMR / month
                  </span>
                </div>
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-3">
                    <CheckCircleIcon
                      className={`mt-0.5 h-5 w-5 flex-shrink-0 ${plan.highlight ? "text-blue-200" : "text-blue-500"}`}
                    />
                    <span
                      className={`text-sm ${plan.highlight ? "text-blue-100" : "text-gray-600"}`}
                    >
                      {feat}
                    </span>
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
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-gray-400">
          All plans include SSL encryption, data backups, and free updates.{" "}
          <a href="#contact" className="text-blue-600 hover:underline">
            Need a custom plan?
          </a>
        </p>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

function Testimonials() {
  return (
    <section className="bg-gray-50 py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 mb-3">
            Trusted by managers
          </p>
          <h2 className="text-4xl font-bold tracking-tight text-gray-900">
            What our customers say
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="flex flex-col rounded-2xl bg-white p-7 shadow-sm ring-1 ring-gray-100"
            >
              {/* Stars */}
              <div className="mb-4 flex gap-1">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <StarIcon key={i} className="h-4 w-4 text-yellow-400" />
                ))}
              </div>

              {/* Quote */}
              <p className="flex-1 text-sm leading-relaxed text-gray-600 italic">
                &ldquo;{t.text}&rdquo;
              </p>

              {/* Author */}
              <div className="mt-6 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
                  <span className="text-sm font-bold text-white">
                    {t.avatar}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {t.name}
                  </p>
                  <p className="text-xs text-gray-500">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Contact ──────────────────────────────────────────────────────────────────

function Contact() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <section id="contact" className="bg-slate-950 py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:items-start">
          {/* Left: info */}
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-400 mb-3">
              Get in touch
            </p>
            <h2 className="text-4xl font-bold tracking-tight text-white">
              Let&apos;s talk about your{" "}
              <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                portfolio
              </span>
            </h2>
            <p className="mt-4 text-lg text-slate-400">
              Whether you have a single apartment or 50 buildings, we&apos;d
              love to show you how OmRent can simplify your operations.
            </p>

            <dl className="mt-10 space-y-6">
              {[
                {
                  icon: EnvelopeIcon,
                  label: "Email",
                  value: "hello@omrent.com",
                },
                {
                  icon: PhoneIcon,
                  label: "Phone",
                  value: "+968 9000 0000",
                },
                {
                  icon: MapPinIcon,
                  label: "Location",
                  value: "Salalah, Dhofar, Oman",
                },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
                    <Icon className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                      {label}
                    </p>
                    <p className="text-sm font-medium text-slate-300">
                      {value}
                    </p>
                  </div>
                </div>
              ))}
            </dl>

            {/* Feature chips */}
            <div className="mt-10 flex flex-wrap gap-2">
              {[
                "Free setup assistance",
                "Arabic & English support",
                "Data migration help",
                "Custom onboarding",
              ].map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1 text-xs font-medium text-slate-400"
                >
                  <CheckIcon className="h-3 w-3 text-blue-400" />
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Right: form */}
          <div className="rounded-2xl bg-white p-8 shadow-2xl">
            {sent ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircleIcon className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Message sent!
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  We&apos;ll get back to you within 24 hours.
                </p>
                <button
                  onClick={() => {
                    setSent(false);
                    setForm({ name: "", email: "", company: "", message: "" });
                  }}
                  className="mt-6 text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Send us a message
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    We typically respond within a few hours.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-700">
                      Full name <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={form.name}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, name: e.target.value }))
                      }
                      placeholder="Ahmed Al-Rashidi"
                      className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-700">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, email: e.target.value }))
                      }
                      placeholder="ahmed@example.com"
                      className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">
                    Company / Property name
                  </label>
                  <input
                    type="text"
                    value={form.company}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, company: e.target.value }))
                    }
                    placeholder="Salalah Real Estate Co."
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={form.message}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, message: e.target.value }))
                    }
                    placeholder="Tell us about your properties and what you're looking for..."
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  Send message
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── CTA Banner ───────────────────────────────────────────────────────────────

function CtaBanner() {
  return (
    <section className="bg-blue-600 py-20">
      <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Ready to take control of your portfolio?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-blue-100">
          Join property managers across Oman who use OmRent to save time, reduce
          errors, and grow their business.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-blue-600 shadow-lg hover:bg-blue-50 transition-all hover:-translate-y-0.5"
          >
            Start for free — no card needed
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <a
            href="#contact"
            className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white hover:bg-white/20 transition-all"
          >
            Talk to our team
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-slate-800 py-12">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-base">O</span>
              </div>
              <span className="text-lg font-bold text-white">OmRent</span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
              Modern property management for Oman and beyond.
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
              Product
            </p>
            <ul className="space-y-2.5">
              {[
                ["Features", "#features"],
                ["Pricing", "#pricing"],
                ["How it works", "#how-it-works"],
              ].map(([label, href]) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
              Company
            </p>
            <ul className="space-y-2.5">
              {[
                ["About", "#"],
                ["Contact", "#contact"],
                ["Privacy Policy", "#"],
              ].map(([label, href]) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
              Account
            </p>
            <ul className="space-y-2.5">
              {[
                ["Log in", "/login"],
                ["Sign up free", "/login"],
                ["Dashboard", "/dashboard"],
              ].map(([label, href]) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-800 pt-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} OmRent. All rights reserved.
          </p>
          <div className="flex items-center gap-1 text-xs text-slate-600">
            <ShieldCheckIcon className="h-3.5 w-3.5" />
            <span>SSL secured · Data hosted in EU · GDPR compliant</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="scroll-smooth bg-white">
      <Navbar />
      <Hero />
      <Stats />
      <Features />
      <HowItWorks />
      <Pricing />
      <Testimonials />
      <CtaBanner />
      <Contact />
      <Footer />
    </div>
  );
}
