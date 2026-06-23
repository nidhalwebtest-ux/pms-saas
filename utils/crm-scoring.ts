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

// The playbook scoring rubric text (factor titles + 1/3/5 level labels/descriptions)
// lives in i18n under `admin.scoring.factors.*` — rendered by ScoreSelector/ScoringCard.

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
