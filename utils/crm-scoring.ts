/**
 * CRM scoring engine — the playbook's 5-factor qualification framework.
 *
 * Each factor scores 1, 3, or 5. The total (sum, 5–25) maps to a tier:
 *   total >= 20 → Tier 1 (go now), 13–19 → Tier 2 (nurture), < 13 → Tier 3 (later).
 *
 * scoreTotal and tier are NOT stored as DB generated columns — they are computed
 * here and persisted on every write, matching the rest of this codebase (e.g.
 * Invoice.balanceDue). Both the form (live preview) and the server actions import
 * from this single source of truth so scoring can never drift between the two.
 */

export const SCORE_FACTORS = [
  "scoreSize",
  "scoreKhareefActivity",
  "scorePainSignals",
  "scoreDigitalComfort",
  "scoreReachability",
] as const;

export type ScoreFactor = (typeof SCORE_FACTORS)[number];

export type ScoreValue = 1 | 3 | 5;

export type FactorScores = Record<ScoreFactor, number>;

/**
 * Playbook scoring rubric — the exact 1/3/5 meaning of each factor, surfaced in
 * the form so scoring stays consistent. `title` labels the factor; each level
 * carries a short label + the playbook description.
 */
export const SCORING_RUBRIC: Record<
  ScoreFactor,
  { title: string; help: string; levels: Record<ScoreValue, { label: string; desc: string }> }
> = {
  scoreSize: {
    title: "Portfolio size",
    help: "How many units do they manage?",
    levels: {
      1: { label: "Small", desc: "Under 8 units" },
      3: { label: "Medium", desc: "8–20 units" },
      5: { label: "Large", desc: "20+ units / multi-building" },
    },
  },
  scoreKhareefActivity: {
    title: "Khareef activity",
    help: "How active are they in the Jun–Sep peak season?",
    levels: {
      1: { label: "Low", desc: "Mostly long-term / quiet in Khareef" },
      3: { label: "Some", desc: "A few short-term lets during Khareef" },
      5: { label: "High", desc: "Heavy short-term turnover all Khareef" },
    },
  },
  scorePainSignals: {
    title: "Pain signals",
    help: "How visible is their operational pain (manual books, double-bookings, errors)?",
    levels: {
      1: { label: "Faint", desc: "No obvious pain / seems organized" },
      3: { label: "Present", desc: "Some manual/spreadsheet pain mentioned" },
      5: { label: "Strong", desc: "Clear, painful problems they named" },
    },
  },
  scoreDigitalComfort: {
    title: "Digital comfort",
    help: "How comfortable are they adopting a software tool?",
    levels: {
      1: { label: "Low", desc: "Paper-only, resistant to apps" },
      3: { label: "Medium", desc: "Uses WhatsApp/Excel, open to tools" },
      5: { label: "High", desc: "Already uses apps, tech-forward" },
    },
  },
  scoreReachability: {
    title: "Reachability",
    help: "How easily can you reach the decision-maker?",
    levels: {
      1: { label: "Hard", desc: "Gatekept / no direct line" },
      3: { label: "Moderate", desc: "Reachable via staff or eventually" },
      5: { label: "Easy", desc: "Direct line to the owner/decision-maker" },
    },
  },
};

/** Sum of the five factors (each clamped to 1/3/5). */
export function computeScoreTotal(scores: FactorScores): number {
  return SCORE_FACTORS.reduce((sum, f) => sum + normalizeScore(scores[f]), 0);
}

/** Map a score total → tier (1 best, 3 lowest). */
export function computeTier(scoreTotal: number): 1 | 2 | 3 {
  if (scoreTotal >= 20) return 1;
  if (scoreTotal >= 13) return 2;
  return 3;
}

/** Convenience: compute both at once. */
export function computeScoring(scores: FactorScores): {
  scoreTotal: number;
  tier: 1 | 2 | 3;
} {
  const scoreTotal = computeScoreTotal(scores);
  return { scoreTotal, tier: computeTier(scoreTotal) };
}

/** Coerce any input to the nearest valid score value (1/3/5). Defaults to 1. */
export function normalizeScore(v: unknown): ScoreValue {
  const n = Number(v);
  if (n === 5) return 5;
  if (n === 3) return 3;
  return 1;
}
