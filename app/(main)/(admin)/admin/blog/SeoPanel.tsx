"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, CircleAlert, CircleX, Lock } from "lucide-react";
import type { SeoCheck, SeoReport } from "@/lib/blog/seo";
import { DESCRIPTION_RANGE, TITLE_RANGE } from "@/lib/blog/seo";
import { SITE_URL } from "@/lib/blog/config";

const GRADE = {
  good: { ring: "#16a34a", text: "text-green-700", bg: "bg-green-50", label: "Good" },
  ok: { ring: "#ea580c", text: "text-orange-700", bg: "bg-orange-50", label: "Needs work" },
  poor: { ring: "#dc2626", text: "text-red-700", bg: "bg-red-50", label: "Poor" },
} as const;

export function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const grade = score >= 80 ? "good" : score >= 50 ? "ok" : "poor";
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-label={`SEO score ${score} of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={GRADE[grade].ring} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} className="transition-[stroke-dashoffset] duration-500"
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="rotate-90 fill-fg text-[15px] font-bold" style={{ transformOrigin: "center" }}>
        {score}
      </text>
    </svg>
  );
}

/** Small coloured score pill for lists / tabs. */
export function ScorePill({ score }: { score: number }) {
  const g = GRADE[score >= 80 ? "good" : score >= 50 ? "ok" : "poor"];
  return <span className={`inline-flex min-w-[2.25rem] justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${g.bg} ${g.text}`}>{score}</span>;
}

function CheckRow({ c }: { c: SeoCheck }) {
  const Icon = c.status === "pass" ? CheckCircle2 : c.status === "warn" ? CircleAlert : CircleX;
  const color = c.status === "pass" ? "text-green-600" : c.status === "warn" ? "text-orange-500" : "text-red-500";
  return (
    <li className="flex gap-2.5 py-2">
      <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${color}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-snug text-fg">{c.label}</p>
        {c.status !== "pass" && <p className="mt-0.5 text-xs leading-snug text-fg-tertiary">{c.hint}</p>}
      </div>
      {!c.required && <span className="text-[11px] tabular-nums text-fg-tertiary">{c.points}/{c.weight}</span>}
    </li>
  );
}

function Counter({ n, range }: { n: number; range: readonly [number, number] }) {
  const ok = n >= range[0] && n <= range[1];
  return <span className={`tabular-nums ${ok ? "text-green-700" : n > range[1] ? "text-red-600" : "text-fg-tertiary"}`}>{n}/{range[1]}</span>;
}

export default function SeoPanel({ report, lang, slug }: { report: SeoReport; lang: "en" | "ar"; slug: string }) {
  const [showPassed, setShowPassed] = useState(false);
  const g = GRADE[report.grade];
  const required = report.checks.filter((c) => c.required);
  const scored = report.checks.filter((c) => !c.required);
  const todo = scored.filter((c) => c.status !== "pass");
  const done = scored.filter((c) => c.status === "pass");
  const host = SITE_URL.replace(/^https?:\/\//, "");

  return (
    <section className="rounded-2xl border border-border-default bg-surface">
      <div className="flex items-center gap-4 border-b border-border-default p-4">
        <ScoreRing score={report.score} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">SEO score · {lang === "ar" ? "Arabic" : "English"}</p>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${g.bg} ${g.text}`}>{g.label}</span>
          <p className="mt-1 text-xs text-fg-tertiary">Aim for 80+ before publishing.</p>
        </div>
      </div>

      {/* Google result preview */}
      <div className="border-b border-border-default p-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-tertiary">Google preview</p>
        <div dir={lang === "ar" ? "rtl" : "ltr"} className="rounded-xl border border-border-default bg-white p-3">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/binaya-mark.svg" alt="" className="h-6 w-6 rounded-full border border-gray-200 bg-white p-0.5" />
            <div className="min-w-0 leading-tight">
              <p className="text-[12px] text-[#202124]">Binaya</p>
              <p dir="ltr" className="truncate text-[11px] text-[#4d5156]">{host} › blog › {lang} › {slug || "…"}</p>
            </div>
          </div>
          <p className="mt-1.5 line-clamp-2 text-[17px] leading-snug text-[#1a0dab]">{report.effectiveTitle || "Article title"}</p>
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-[#4d5156]">
            {report.effectiveDescription || "Write a meta description — it's the text Google shows under the title."}
          </p>
        </div>
        <div className="mt-2 flex justify-between text-[11px]">
          <span>Title <Counter n={report.effectiveTitle.length} range={TITLE_RANGE} /></span>
          <span>Description <Counter n={report.effectiveDescription.length} range={DESCRIPTION_RANGE} /></span>
        </div>
      </div>

      <div className="p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-tertiary">
          <Lock className="h-3 w-3" /> Required to publish
        </p>
        <ul className="mt-1 divide-y divide-border-default">
          {required.map((c) => <CheckRow key={c.id} c={c} />)}
        </ul>

        {todo.length > 0 && (
          <>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-fg-tertiary">Improve ranking ({todo.length})</p>
            <ul className="mt-1 divide-y divide-border-default">
              {todo.map((c) => <CheckRow key={c.id} c={c} />)}
            </ul>
          </>
        )}

        {done.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowPassed((v) => !v)}
              className="mt-4 flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-fg-tertiary hover:text-fg-secondary"
            >
              Passed ({done.length})
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showPassed ? "rotate-180" : ""}`} />
            </button>
            {showPassed && (
              <ul className="mt-1 divide-y divide-border-default">
                {done.map((c) => <CheckRow key={c.id} c={c} />)}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
