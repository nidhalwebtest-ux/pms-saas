import { ArrowRight, Play, CheckCircle2, Users } from "lucide-react";
import Container from "../ui/Container";
import { MarketingButton } from "../ui/MarketingButton";
import { HeroDashboardMock } from "../mocks";

export default function HeroSection() {
  return (
    <section
      data-screen-label="Hero"
      className="hero-bg relative overflow-hidden pt-[72px] pb-24"
    >
      <Container className="relative z-10 grid items-center gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/15 bg-brand-50 px-3 py-1.5 ps-2 font-mono text-[12px] font-medium uppercase tracking-wider text-brand-700">
            <span className="relative inline-block h-3.5 w-3.5 rounded-full bg-brand-500">
              <span className="absolute inset-1 rounded-full bg-white" />
            </span>
            Property management software · Salalah
          </span>

          <h1 className="mt-6 mb-5 text-[44px] font-semibold leading-[1.02] tracking-[-0.03em] text-balance md:text-[60px]">
            Run your buildings{" "}
            <span className="bg-gradient-to-br from-brand-600 via-brand-500 to-khareef-700 bg-clip-text text-transparent">
              like a pro
            </span>
            , not a spreadsheet.
          </h1>

          <p className="mb-8 max-w-[540px] text-[19px] leading-[1.55] text-gray-600 text-pretty">
            Binaya helps property managers in Salalah handle reservations, payments, and
            operations across every building — in one place. Free for one building. Ready in 20 minutes.
          </p>

          <div className="mb-6 flex flex-wrap gap-3">
            <MarketingButton href="#trial" variant="primary" size="xl">
              Start free trial
              <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" strokeWidth={1.75} />
            </MarketingButton>
            <MarketingButton href="#demo" variant="secondary" size="xl">
              <Play className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
              Watch 2-min demo
            </MarketingButton>
          </div>

          <TrustList />
          <SocialProof />
        </div>

        <HeroVisual />
      </Container>
    </section>
  );
}

function TrustList() {
  const items = [
    "No credit card required",
    "Free for 1 building",
    "Set up in 20 minutes",
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-[13.5px] text-gray-600">
      {items.map((label) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className="grid h-4 w-4 place-items-center rounded-full bg-success-50 text-[11px] font-bold text-success-700">
            ✓
          </span>
          {label}
        </span>
      ))}
    </div>
  );
}

function SocialProof() {
  const avatars = [
    { label: "AB", cls: "bg-brand-100 text-brand-700" },
    { label: "RA", cls: "bg-[oklch(0.92_0.05_175)] text-khareef-700" },
    { label: "JM", cls: "bg-[oklch(0.95_0.04_80)] text-warning-700" },
    { label: "SK", cls: "bg-[oklch(0.94_0.04_25)] text-error-500" },
  ];
  return (
    <div className="mt-7 flex items-center gap-3 text-[13px] text-gray-500">
      <span className="inline-flex">
        {avatars.map((a, i) => (
          <span
            key={a.label}
            className={[
              "grid h-7 w-7 place-items-center rounded-full border-2 border-white text-[11px] font-semibold",
              i > 0 ? "-ms-2" : "",
              a.cls,
            ].join(" ")}
          >
            {a.label}
          </span>
        ))}
      </span>
      Trusted by property managers across Salalah, Mirbat &amp; Al Haffa
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="relative [perspective:1600px]">
      {/* Floating card top */}
      <div className="absolute -top-[18px] -start-8 z-20 flex motion-safe:animate-float items-center gap-2.5 rounded-md border border-gray-200 bg-white px-3.5 py-3 shadow-lg sm:flex">
        <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-success-50 text-success-700">
          <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
        </span>
        <div>
          <strong className="block text-[13px] font-semibold text-gray-900">
            Reservation confirmed
          </strong>
          <span className="font-mono text-[11.5px] text-gray-500">BNY-04812 · OMR 303.765</span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[14px] border border-gray-200 bg-white shadow-xl [transform:rotateY(-4deg)_rotateX(2deg)_rotate(0.4deg)] origin-center rtl:[transform:rotateY(4deg)_rotateX(2deg)_rotate(-0.4deg)]">
        <div className="flex items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-3 py-2.5">
          <i className="h-2.5 w-2.5 rounded-full bg-[oklch(0.78_0.16_25)]" />
          <i className="h-2.5 w-2.5 rounded-full bg-[oklch(0.82_0.14_80)]" />
          <i className="h-2.5 w-2.5 rounded-full bg-[oklch(0.78_0.14_155)]" />
          <span className="mx-auto max-w-[320px] flex-1 rounded-md border border-gray-200 bg-white px-3 py-1 text-center font-mono text-[11px] text-gray-500">
            app.binaya.om / dashboard
          </span>
        </div>
        <HeroDashboardMock />
      </div>

      <div className="absolute -bottom-[22px] -end-7 z-20 flex motion-safe:animate-float-delayed items-center gap-2.5 rounded-md border border-gray-200 bg-white px-3.5 py-3 shadow-lg">
        <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
          <Users className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div>
          <strong className="block text-[13px] font-semibold text-gray-900">Khareef forecast</strong>
          <span className="font-mono text-[11.5px] text-gray-500">94% occupancy · 21 Jun</span>
        </div>
      </div>
    </div>
  );
}
